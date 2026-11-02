/* =============================================================================
   049 — rh.sp_sincroniza_saldos_vacaciones con bitacora y correo de error
   Base   : Lefarma (produccion)
   Fecha  : 2026-11-02
   -----------------------------------------------------------------------------
   CAMBIOS vs la version anterior (respaldo en
   utilities/backup_sp_sincroniza_saldos_vacaciones_20261102.sql)

   1. FUENTE CORREGIDA. Antes leia vwEmpleados.vacacionesxantiguedad, que en la
      vista es coalesce(sv.dias_generados, 0) sobre esta misma tabla (via
      OPENQUERY a Lefarma). Era un ciclo: leia la tabla y escribia el mismo
      valor, por eso el job corria todos los dias sin cambiar nada.
      Ahora usa vwEmpleados.vacacionesxantiguedadASumar, la formula por
      antiguedad que ya vive en la vista:
          0 anios            -> 0
          1 a 5 anios        -> 10 + anios*2          (12, 14, 16, 18, 20)
          6 anios o mas      -> 22 + ceil((anios-10)/5)*2  (22, 24, 26, 28...)
      fn_ObtenerAñosTranscurridos compara mes y dia contra hire_date, asi que
      el salto de dias ocurre solo el dia del aniversario del empleado.

   2. BITACORA en rh.log_sincronizacion_saldos: una fila por corrida con
      estatus EN_PROCESO / OK / ERROR, contadores y datos del error.

   3. CORREO DE ERROR: en el CATCH, con numero, mensaje, linea y procedimiento.
      Va en su propio TRY/CATCH para que un fallo del correo no tape el error
      original. Exito y error se mandan a 21@ y 6@grupolefarma.com.mx.
      Se envia por app.sp_enviar_correo (Python/smtplib) con la cuenta
      autorizaciones@ y nombre visible 'noreplay', igual que los avisos de
      sincronizacion de usuarios. Al final se hace THROW para que el job de
      SQL Agent se marque en rojo (antes siempre decia "succeeded").

   4. ACCESO: la vista se lee con nombre de cuatro partes
      ([ESFR-DOCTS].Asistencias.dbo.vwEmpleados) en lugar de OPENQUERY. Es el
      mismo linked server, pero sin SQL embebido como cadena.

   5. fecha_modificacion se actualiza cuando el SP cambia dias_generados.
      id_usuario_modificacion se deja NULL: es una corrida del sistema, no de
      una persona.

   -----------------------------------------------------------------------------
   PENDIENTE (decision de negocio, no incluida aqui)
     El saldo sigue siendo por ANIO CALENDARIO y dias_tomados NO se reinicia
     en el aniversario. Para un ciclo aniversario-a-aniversario hay que agregar
     fecha_inicio/fecha_fin al modelo y ajustar las consultas de la app.
   ========================================================================== */

-- IMPORTANTE: rh.saldos_vacaciones_anuales tiene una columna calculada
-- persistida (dias_pendientes). El SP debe compilarse con ANSI_NULLS y
-- QUOTED_IDENTIFIER en ON, o el UPDATE falla con el error 1934.
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

ALTER PROCEDURE rh.sp_sincroniza_saldos_vacaciones
    @anio            INT = NULL,                              -- NULL = anio en curso
    @correo_notifica VARCHAR(256) = '21@grupolefarma.com.mx; 6@grupolefarma.com.mx', -- NULL o '' = no enviar correo de exito
    @correo_error    VARCHAR(256) = '21@grupolefarma.com.mx; 6@grupolefarma.com.mx'  -- NULL o '' = no enviar correo de error
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @anio = ISNULL(@anio, YEAR(GETDATE()));

    DECLARE @id_log       INT,
            @inicio       DATETIME2(3) = SYSDATETIME(),
            @total_rh     INT = 0,
            @mapeados     INT = 0,
            @omitidos     INT = 0,
            @creados      INT = 0,
            @actualizados INT = 0;

    --- 0) Bitacora: se abre ANTES de la transaccion para que el ROLLBACK no la borre
    INSERT INTO rh.log_sincronizacion_saldos (fecha_inicio, anio, estatus)
    VALUES (@inicio, @anio, 'EN_PROCESO');

    SET @id_log = SCOPE_IDENTITY();

    BEGIN TRY
        --- 1) Staging RH (formula por antiguedad, no el saldo guardado)
        IF OBJECT_ID('tempdb..#rh') IS NOT NULL DROP TABLE #rh;
        CREATE TABLE #rh (
            correo     VARCHAR(512) COLLATE DATABASE_DEFAULT NOT NULL,
            vacaciones DECIMAL(9,2) NULL
        );

        -- Nombre de cuatro partes en lugar de OPENQUERY: mismo linked server,
        -- pero el texto queda legible y la vista se resuelve del lado remoto.
        INSERT INTO #rh (correo, vacaciones)
        SELECT correo, vacacionesxantiguedadASumar
        FROM [ESFR-DOCTS].Asistencias.dbo.vwEmpleados
        WHERE correo IS NOT NULL
          AND LTRIM(RTRIM(correo)) <> ''
          AND vacacionesxantiguedadASumar IS NOT NULL;

        UPDATE #rh SET correo = LTRIM(RTRIM(correo));

        --- 2) Mapeo correo -> usuario -> empresa
        IF OBJECT_ID('tempdb..#mapa') IS NOT NULL DROP TABLE #mapa;
        CREATE TABLE #mapa (
            IdUsuario  INT          NOT NULL PRIMARY KEY,
            id_empresa INT          NOT NULL,
            correo     VARCHAR(512) NOT NULL,
            vacaciones DECIMAL(9,2) NOT NULL
        );

        ;WITH rh_unicos AS (   -- correos duplicados en RH: se conserva el mayor
            SELECT correo, MAX(vacaciones) AS vacaciones
            FROM #rh
            GROUP BY correo
        ),
        usuarios_correo AS (   -- correos duplicados en app.usuarios: menor IdUsuario
            SELECT u.IdUsuario,
                   LTRIM(RTRIM(u.Correo)) COLLATE DATABASE_DEFAULT AS correo,
                   ROW_NUMBER() OVER (
                       PARTITION BY LTRIM(RTRIM(u.Correo)) COLLATE DATABASE_DEFAULT
                       ORDER BY u.IdUsuario) AS rn
            FROM Asokam.app.usuarios u
            WHERE u.Correo IS NOT NULL AND LTRIM(RTRIM(u.Correo)) <> ''
        )
        INSERT INTO #mapa (IdUsuario, id_empresa, correo, vacaciones)
        SELECT u.IdUsuario, d.id_empresa, r.correo, r.vacaciones
        FROM rh_unicos r
        JOIN usuarios_correo u ON u.correo = r.correo AND u.rn = 1
        JOIN Lefarma.config.usuario_detalle d
             ON d.id_usuario = u.IdUsuario AND d.activo = 1;

        SET @total_rh = (SELECT COUNT(DISTINCT correo) FROM #rh);
        SET @mapeados = (SELECT COUNT(*) FROM #mapa);
        SET @omitidos = @total_rh - @mapeados;

        --- 3) Upsert (solo dias_generados)
        BEGIN TRAN;

        UPDATE s
           SET s.dias_generados      = m.vacaciones,
               s.fecha_modificacion  = SYSDATETIME()
        FROM rh.saldos_vacaciones_anuales AS s
        JOIN #mapa AS m ON m.IdUsuario = s.id_usuario
        WHERE s.anio = @anio
          AND s.activo = 1
          AND s.dias_generados <> m.vacaciones;

        SET @actualizados = @@ROWCOUNT;

        INSERT INTO rh.saldos_vacaciones_anuales
            (id_usuario, id_empresa, anio, dias_generados, dias_vencidos, dias_compensados,
             dias_ajustados, dias_tomados, activo, fecha_creacion)
        SELECT m.IdUsuario, m.id_empresa, @anio, m.vacaciones, 0, 0, 0, 0, 1, GETDATE()
        FROM #mapa AS m
        WHERE NOT EXISTS (
            SELECT 1 FROM rh.saldos_vacaciones_anuales AS s
            WHERE s.id_usuario = m.IdUsuario AND s.anio = @anio AND s.activo = 1);

        SET @creados = @@ROWCOUNT;

        COMMIT TRAN;

        --- 4) Cierre de bitacora
        UPDATE rh.log_sincronizacion_saldos
           SET fecha_fin     = SYSDATETIME(),
               duracion_ms   = DATEDIFF(MILLISECOND, @inicio, SYSDATETIME()),
               estatus       = 'OK',
               total_rh      = @total_rh,
               creados       = @creados,
               actualizados  = @actualizados,
               omitidos      = @omitidos
         WHERE id_log = @id_log;

        --- 5) Aviso de exito (solo si hubo cambios)
        IF @correo_notifica IS NOT NULL
           AND LTRIM(RTRIM(@correo_notifica)) <> ''
           AND (@creados + @actualizados) > 0
        BEGIN
            BEGIN TRY
                DECLARE @asunto NVARCHAR(500) =
                    CONCAT('[Lefarma] Saldos de vacaciones ', @anio, ': ',
                           @creados, ' creados, ', @actualizados, ' actualizados, ', @omitidos, ' omitidos');

                DECLARE @html NVARCHAR(MAX) =
                    N'<p>Sincronizacion de <b>rh.saldos_vacaciones_anuales</b> desde RH (vwEmpleados).</p>' +
                    N'<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:13px">' +
                    N'<tr style="background:#f0f0f0"><th>Anio</th><th>Creados</th><th>Actualizados</th><th>Omitidos</th><th>Duracion</th></tr>' +
                    N'<tr><td align="center">' + CAST(@anio AS NVARCHAR(4)) + N'</td>' +
                    N'<td align="center">' + CAST(@creados AS NVARCHAR(10)) + N'</td>' +
                    N'<td align="center">' + CAST(@actualizados AS NVARCHAR(10)) + N'</td>' +
                    N'<td align="center">' + CAST(@omitidos AS NVARCHAR(10)) + N'</td>' +
                    N'<td align="center">' + CAST(DATEDIFF(MILLISECOND, @inicio, SYSDATETIME()) AS NVARCHAR(20)) + N' ms</td></tr></table>' +
                    N'<p style="color:#666;font-size:12px">Bitacora: rh.log_sincronizacion_saldos, id_log ' + CAST(@id_log AS NVARCHAR(20)) + N'.<br>' +
                    N'Omitidos = empleados de RH sin correo, sin antiguedad, sin usuario en Asokam o sin usuario_detalle activo. ' +
                    N'Solo se actualiza dias_generados; dias_pendientes se recalcula solo.</p>';

                EXEC Asokam.app.sp_enviar_correo
                     @correo_remitente = 'autorizaciones@grupolefarma.com.mx',
                     @nombre_remitente = N'noreplay',
                     @asunto           = @asunto,
                     @destinatarios    = @correo_notifica,
                     @body_html        = @html;
            END TRY
            BEGIN CATCH
                -- El aviso de exito no debe marcar la corrida como fallida
            END CATCH
        END

        --- 6) Resumen para ejecucion manual
        SELECT @anio         AS anio,
               @total_rh     AS total_rh,
               @creados      AS creados,
               @actualizados AS actualizados,
               @omitidos     AS omitidos,
               @id_log       AS id_log,
               @correo_notifica AS correo_notifica;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        DECLARE @num_error  INT            = ERROR_NUMBER(),
                @msg_error  NVARCHAR(4000) = ERROR_MESSAGE(),
                @line_error INT            = ERROR_LINE(),
                @proc_error NVARCHAR(256)  = ERROR_PROCEDURE();

        BEGIN TRY
            UPDATE rh.log_sincronizacion_saldos
               SET fecha_fin       = SYSDATETIME(),
                   duracion_ms     = DATEDIFF(MILLISECOND, @inicio, SYSDATETIME()),
                   estatus         = 'ERROR',
                   numero_error    = @num_error,
                   mensaje_error   = @msg_error,
                   linea_error     = @line_error,
                   procedure_error = @proc_error
             WHERE id_log = @id_log;
        END TRY
        BEGIN CATCH
            SET @msg_error = LEFT(@msg_error + N' | No se pudo actualizar la bitacora: ' + ERROR_MESSAGE(), 4000);
        END CATCH

        IF @correo_error IS NOT NULL AND LTRIM(RTRIM(@correo_error)) <> ''
        BEGIN
            BEGIN TRY
                DECLARE @asunto_err NVARCHAR(500) =
                    CONCAT('[Lefarma] ERROR sincronizacion saldos vacaciones ', @anio,
                           ' (log #', @id_log, ')');

                DECLARE @html_err NVARCHAR(MAX) =
                    N'<p>Fallo la sincronizacion de <b>rh.saldos_vacaciones_anuales</b>.</p>' +
                    N'<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:13px">' +
                    N'<tr style="background:#f0f0f0"><th>Dato</th><th>Valor</th></tr>' +
                    N'<tr><td>Fecha</td><td>' + CONVERT(NVARCHAR(19), SYSDATETIME(), 120) + N'</td></tr>' +
                    N'<tr><td>Servidor</td><td>' + @@SERVERNAME + N'</td></tr>' +
                    N'<tr><td>Anio</td><td>' + CAST(@anio AS NVARCHAR(4)) + N'</td></tr>' +
                    N'<tr><td>Bitacora</td><td>rh.log_sincronizacion_saldos, id_log ' + CAST(@id_log AS NVARCHAR(20)) + N'</td></tr>' +
                    N'<tr><td>Error</td><td>' + CAST(@num_error AS NVARCHAR(20)) + N'</td></tr>' +
                    N'<tr><td>Mensaje</td><td>' + @msg_error + N'</td></tr>' +
                    N'<tr><td>Linea</td><td>' + ISNULL(CAST(@line_error AS NVARCHAR(20)), N'-') + N'</td></tr>' +
                    N'<tr><td>Procedimiento</td><td>' + ISNULL(@proc_error, N'-') + N'</td></tr>' +
                    N'</table>' +
                    N'<p style="color:#666;font-size:12px">El proceso no se reintenta solo. Revisa el historial del job ' +
                    N'SP_Jobs_SincronizaSaldosVacaciones y corrige la causa antes de la siguiente corrida.</p>';

                EXEC Asokam.app.sp_enviar_correo
                     @correo_remitente = 'autorizaciones@grupolefarma.com.mx',
                     @nombre_remitente = N'noreplay',
                     @asunto           = @asunto_err,
                     @destinatarios    = @correo_error,
                     @body_html        = @html_err;
            END TRY
            BEGIN CATCH
                -- Si falla el correo, prevalece el error original (THROW de abajo)
            END CATCH
        END;

        THROW;   -- el job de SQL Agent debe quedar marcado como fallido
    END CATCH
END
