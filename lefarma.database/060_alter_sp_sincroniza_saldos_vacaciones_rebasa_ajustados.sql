/* =============================================================================
   060 — rh.sp_sincroniza_saldos_vacaciones: replay diario, snapshot y rebase
   Base   : Lefarma (produccion)
   Fecha  : 2026-11-24
   -----------------------------------------------------------------------------
   REBASE
   Cuando la generacion por antiguedad sube, el SP anterior actualizaba solo
   dias_generados y dejaba intacto dias_ajustados. En la carga inicial
   dias_ajustados quedo como puente para que el saldo coincidiera con el Excel:
       dias_ajustados = saldo_excel - dias_generados
   Al cambiar la generacion, el puente viejo seguia compensando la generacion
   nueva y el saldo solo subia la diferencia, no el anio completo.
   Ahora, si el empleado no tiene ajustes manuales (historial_ajustes NULL o
   vacio) y la generacion sube, el SP suma la generacion anterior a
   dias_ajustados antes de reemplazar dias_generados:
       A_nuevo = A_viejo + G_viejo
       G_nuevo = generacion de la vista
   Si la generacion baja o el empleado tiene historial de ajustes manuales, el
   SP solo actualiza dias_generados: el ajuste manual es absoluto y no se puede
   separar del puente de carga. Esos casos los revisa RH.

   REPLAY
   Al iniciar, busca la ultima corrida OK en rh.log_sincronizacion_saldos.
   Recorre desde el dia siguiente hasta hoy (tope 31 dias) y, por cada fecha,
   calcula el estado con el que amanece cada usuario:
     - generacion por antiguedad a esa fecha (no la de hoy);
     - dias tomados, ajustados, vencidos y compensados del historial (062);
     - rebase del ajuste si la generacion subio y no hay ajuste manual.
   Inserta el snapshot de esa fecha si no existe. El historial manda para
   dias_tomados: no se recontan solicitudes, para no duplicar el dia que ya
   quedo incluido en el ajuste de carga.
   Despues actualiza la fila de hoy: toma dias_generados de la vista, rebasa
   dias_ajustados si la generacion subio y no toca dias_tomados. La foto de hoy
   se toma antes de ese update; los cambios que ocurren durante el dia se ven
   en la foto del dia siguiente.
   Si el hueco supera 31 dias, se recorta y se registra el replay efectivo.
   Esta version NO corrige a los empleados que ya pasaron por su aniversario
   antes de la ultima corrida OK: su dias_generados ya coincide con la vista y
   el replay no lo detecta. Esa correccion va en el UPDATE unico del caso.

   SNAPSHOT
   rh.snapshot_saldos_vacaciones (script 063) guarda una fila por usuario y dia
   con generados, vencidos, compensados, ajustados, tomados y pendientes. La
   clave (fecha_snapshot, id_saldo) evita duplicados si el job corre dos veces.
   Cada fila lleva el id_log de la corrida que la genero.

   La generacion sigue siendo anual y dias_tomados no se reinicia; el saldo
   acumulado vive en dias_ajustados.
   El SP define el contexto 'vacaciones_comentario' para que el trigger del
   historial (062) guarde el motivo en notas.
   ========================================================================== */

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

ALTER PROCEDURE rh.sp_sincroniza_saldos_vacaciones
    @anio            INT = NULL,
    @correo_notifica VARCHAR(256) = '21@grupolefarma.com.mx; 6@grupolefarma.com.mx',
    @correo_error    VARCHAR(256) = '21@grupolefarma.com.mx; 6@grupolefarma.com.mx'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @hoy DATE = CAST(SYSDATETIME() AS DATE);
    SET @anio = ISNULL(@anio, YEAR(@hoy));

    DECLARE @id_log         INT,
            @inicio         DATETIME2(3) = SYSDATETIME(),
            @ultima_ok      DATE,
            @fecha_desde    DATE,
            @dias_replay    INT = 0,
            @total_rh       INT = 0,
            @mapeados       INT = 0,
            @omitidos       INT = 0,
            @creados        INT = 0,
            @actualizados   INT = 0;

    INSERT INTO rh.log_sincronizacion_saldos (fecha_inicio, anio, estatus)
    VALUES (@inicio, @anio, 'EN_PROCESO');

    SET @id_log = SCOPE_IDENTITY();

    BEGIN TRY
        IF OBJECT_ID('tempdb..#rh') IS NOT NULL DROP TABLE #rh;
        CREATE TABLE #rh (
            correo       VARCHAR(512) COLLATE DATABASE_DEFAULT NOT NULL,
            fechaingreso DATE NOT NULL,
            vacaciones   DECIMAL(9,2) NULL
        );

        INSERT INTO #rh (correo, fechaingreso, vacaciones)
        SELECT correo, CAST(fechaingreso AS DATE), vacacionesxantiguedadASumar
        FROM [ESFR-DOCTS].Asistencias.dbo.vwEmpleados
        WHERE correo IS NOT NULL
          AND LTRIM(RTRIM(correo)) <> ''
          AND fechaingreso IS NOT NULL
          AND vacacionesxantiguedadASumar IS NOT NULL;

        UPDATE #rh SET correo = LTRIM(RTRIM(correo));

        IF OBJECT_ID('tempdb..#mapa') IS NOT NULL DROP TABLE #mapa;
        CREATE TABLE #mapa (
            IdUsuario    INT          NOT NULL PRIMARY KEY,
            id_empresa   INT          NOT NULL,
            correo       VARCHAR(512) NOT NULL,
            fechaingreso DATE         NOT NULL,
            vacaciones   DECIMAL(9,2) NOT NULL
        );

        ;WITH rh_unicos AS (
            SELECT correo,
                   MAX(fechaingreso) AS fechaingreso,
                   MAX(vacaciones) AS vacaciones
            FROM #rh
            GROUP BY correo
        ),
        usuarios_correo AS (
            SELECT u.IdUsuario,
                   LTRIM(RTRIM(u.Correo)) COLLATE DATABASE_DEFAULT AS correo,
                   ROW_NUMBER() OVER (
                       PARTITION BY LTRIM(RTRIM(u.Correo)) COLLATE DATABASE_DEFAULT
                       ORDER BY u.IdUsuario) AS rn
            FROM Asokam.app.usuarios u
            WHERE u.Correo IS NOT NULL AND LTRIM(RTRIM(u.Correo)) <> ''
        )
        INSERT INTO #mapa (IdUsuario, id_empresa, correo, fechaingreso, vacaciones)
        SELECT u.IdUsuario, d.id_empresa, r.correo, r.fechaingreso, r.vacaciones
        FROM rh_unicos r
        JOIN usuarios_correo u ON u.correo = r.correo AND u.rn = 1
        JOIN Lefarma.config.usuario_detalle d
             ON d.id_usuario = u.IdUsuario AND d.activo = 1;

        SET @total_rh = (SELECT COUNT(DISTINCT correo) FROM #rh);
        SET @mapeados = (SELECT COUNT(*) FROM #mapa);
        SET @omitidos = @total_rh - @mapeados;

        SELECT @ultima_ok = CAST(MAX(fecha_fin) AS DATE)
        FROM rh.log_sincronizacion_saldos
        WHERE estatus = 'OK'
          AND fecha_fin IS NOT NULL
          AND anio = @anio;

        SET @fecha_desde = CASE
            WHEN @ultima_ok IS NULL THEN @hoy
            WHEN DATEADD(DAY, 1, @ultima_ok) > @hoy THEN @hoy
            ELSE DATEADD(DAY, 1, @ultima_ok)
        END;

        IF DATEDIFF(DAY, @fecha_desde, @hoy) > 30
            SET @fecha_desde = DATEADD(DAY, -30, @hoy);

        IF OBJECT_ID('tempdb..#fechas') IS NOT NULL DROP TABLE #fechas;
        CREATE TABLE #fechas (fecha DATE NOT NULL PRIMARY KEY);

        ;WITH n AS (
            SELECT TOP (DATEDIFF(DAY, @fecha_desde, @hoy) + 1)
                   ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n
            FROM sys.all_objects
        )
        INSERT INTO #fechas (fecha)
        SELECT DATEADD(DAY, n, @fecha_desde)
        FROM n;

        SET @dias_replay = (SELECT COUNT(*) FROM #fechas);

        EXEC sys.sp_set_session_context
             @key = N'vacaciones_comentario',
             @value = N'Sincronizacion automatica de saldos por aniversario';

        BEGIN TRAN;

        INSERT INTO rh.saldos_vacaciones_anuales
            (id_usuario, id_empresa, anio, dias_generados, dias_vencidos, dias_compensados,
             dias_ajustados, dias_tomados, activo, fecha_creacion)
        SELECT m.IdUsuario, m.id_empresa, @anio, m.vacaciones, 0, 0, 0, 0, 1, GETDATE()
        FROM #mapa AS m
        WHERE NOT EXISTS (
            SELECT 1 FROM rh.saldos_vacaciones_anuales AS s
            WHERE s.id_usuario = m.IdUsuario AND s.anio = @anio AND s.activo = 1);

        SET @creados = @@ROWCOUNT;

        INSERT INTO rh.snapshot_saldos_vacaciones
            (fecha_snapshot, id_saldo, id_usuario, id_empresa, anio,
             dias_generados, dias_vencidos, dias_compensados, dias_ajustados,
             dias_tomados, dias_pendientes, id_log)
        SELECT f.fecha, s.id_saldo, s.id_usuario, s.id_empresa, s.anio,
               snap.dias_generados, snap.dias_vencidos, snap.dias_compensados,
               snap.dias_ajustados, snap.dias_tomados, snap.dias_pendientes, @id_log
        FROM #fechas AS f
        CROSS JOIN #mapa AS m
        JOIN rh.saldos_vacaciones_anuales AS s
          ON s.id_usuario = m.IdUsuario
         AND s.anio = @anio
         AND s.activo = 1
        CROSS APPLY (
            SELECT DATEADD(DAY, -1, f.fecha) AS fecha_estado
        ) AS e
        CROSS APPLY (
            SELECT CASE
                       WHEN e.fecha_estado < m.fechaingreso THEN 0
                       ELSE DATEDIFF(YEAR, m.fechaingreso, e.fecha_estado)
                            - CASE
                                  WHEN MONTH(e.fecha_estado) < MONTH(m.fechaingreso)
                                       OR (MONTH(e.fecha_estado) = MONTH(m.fechaingreso)
                                           AND DAY(e.fecha_estado) < DAY(m.fechaingreso))
                                      THEN 1
                                  ELSE 0
                              END
                   END AS antiguedad
        ) AS a
        CROSS APPLY (
            SELECT CASE
                       WHEN a.antiguedad <= 0 THEN CAST(0 AS DECIMAL(9,2))
                       WHEN a.antiguedad BETWEEN 1 AND 5 THEN CAST(10 + a.antiguedad * 2 AS DECIMAL(9,2))
                       ELSE CAST(22 + CEILING((a.antiguedad - 10) / 5.0) * 2 AS DECIMAL(9,2))
                   END AS generacion
        ) AS g
        OUTER APPLY (
            SELECT TOP 1
                   h.dias_generados_despues,
                   h.dias_vencidos_despues,
                   h.dias_compensados_despues,
                   h.dias_ajustados_despues,
                   h.dias_tomados_despues
            FROM rh.historial_saldos_vacaciones AS h
            WHERE h.id_saldo = s.id_saldo
              AND h.fecha_cambio < CASE
                                        WHEN f.fecha = @hoy THEN @inicio
                                        ELSE CAST(f.fecha AS DATETIME2(3))
                                    END
            ORDER BY h.fecha_cambio DESC, h.id_cambio DESC
        ) AS h
        CROSS APPLY (
            SELECT
                CASE
                    WHEN f.fecha = CAST(s.fecha_creacion AS DATE)
                        THEN COALESCE(h.dias_generados_despues, s.dias_generados)
                    WHEN NULLIF(s.historial_ajustes, N'') IS NOT NULL
                        THEN COALESCE(h.dias_generados_despues, s.dias_generados)
                    WHEN h.dias_generados_despues IS NULL
                        THEN g.generacion
                    WHEN g.generacion > h.dias_generados_despues
                        THEN g.generacion
                    ELSE h.dias_generados_despues
                END AS dias_generados,
                CASE
                    WHEN f.fecha = CAST(s.fecha_creacion AS DATE)
                        THEN COALESCE(h.dias_ajustados_despues, s.dias_ajustados)
                    WHEN NULLIF(s.historial_ajustes, N'') IS NOT NULL
                        THEN COALESCE(h.dias_ajustados_despues, s.dias_ajustados)
                    WHEN h.dias_ajustados_despues IS NULL
                        THEN s.dias_ajustados
                    WHEN g.generacion > h.dias_generados_despues
                        THEN h.dias_ajustados_despues + h.dias_generados_despues
                    ELSE h.dias_ajustados_despues
                END AS dias_ajustados,
                COALESCE(h.dias_tomados_despues, s.dias_tomados) AS dias_tomados,
                COALESCE(h.dias_vencidos_despues, s.dias_vencidos) AS dias_vencidos,
                COALESCE(h.dias_compensados_despues, s.dias_compensados) AS dias_compensados
        ) AS base
        CROSS APPLY (
            SELECT base.dias_generados,
                   base.dias_vencidos,
                   base.dias_compensados,
                   base.dias_ajustados,
                   base.dias_tomados,
                   (base.dias_generados + base.dias_compensados + base.dias_ajustados
                    - base.dias_vencidos) - base.dias_tomados AS dias_pendientes
        ) AS snap
        WHERE f.fecha >= CAST(s.fecha_creacion AS DATE)
          AND NOT EXISTS (
              SELECT 1
              FROM rh.snapshot_saldos_vacaciones AS x
              WHERE x.fecha_snapshot = f.fecha
                AND x.id_saldo = s.id_saldo
          );

        UPDATE s
           SET s.dias_ajustados = CASE
                                      WHEN NULLIF(s.historial_ajustes, N'') IS NULL
                                           AND m.vacaciones > s.dias_generados
                                          THEN s.dias_ajustados + s.dias_generados
                                      ELSE s.dias_ajustados
                                  END,
               s.dias_generados = m.vacaciones,
               s.fecha_modificacion = SYSDATETIME()
        FROM rh.saldos_vacaciones_anuales AS s
        JOIN #mapa AS m ON m.IdUsuario = s.id_usuario
        WHERE s.anio = @anio
          AND s.activo = 1
          AND s.dias_generados <> m.vacaciones;

        SET @actualizados = @@ROWCOUNT;

        COMMIT TRAN;

        EXEC sys.sp_set_session_context
             @key = N'vacaciones_comentario',
             @value = NULL;

        UPDATE rh.log_sincronizacion_saldos
           SET fecha_fin     = SYSDATETIME(),
               duracion_ms   = DATEDIFF(MILLISECOND, @inicio, SYSDATETIME()),
               estatus       = 'OK',
               total_rh      = @total_rh,
               creados       = @creados,
               actualizados  = @actualizados,
               omitidos      = @omitidos
         WHERE id_log = @id_log;

        IF @correo_notifica IS NOT NULL
           AND LTRIM(RTRIM(@correo_notifica)) <> ''
           AND (@creados + @actualizados) > 0
        BEGIN
            BEGIN TRY
                DECLARE @asunto NVARCHAR(500) =
                    CONCAT('[Lefarma] Saldos de vacaciones ', @anio, ': ',
                           @creados, ' creados, ', @actualizados, ' actualizados, ',
                           @omitidos, ' omitidos, ', @dias_replay, ' dias replay');

                DECLARE @html NVARCHAR(MAX) =
                    N'<p>Sincronizacion de <b>rh.saldos_vacaciones_anuales</b> desde RH (vwEmpleados).</p>' +
                    N'<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:13px">' +
                    N'<tr style="background:#f0f0f0"><th>Anio</th><th>Creados</th><th>Actualizados</th><th>Omitidos</th><th>Dias replay</th><th>Duracion</th></tr>' +
                    N'<tr><td align="center">' + CAST(@anio AS NVARCHAR(4)) + N'</td>' +
                    N'<td align="center">' + CAST(@creados AS NVARCHAR(10)) + N'</td>' +
                    N'<td align="center">' + CAST(@actualizados AS NVARCHAR(10)) + N'</td>' +
                    N'<td align="center">' + CAST(@omitidos AS NVARCHAR(10)) + N'</td>' +
                    N'<td align="center">' + CAST(@dias_replay AS NVARCHAR(10)) + N'</td>' +
                    N'<td align="center">' + CAST(DATEDIFF(MILLISECOND, @inicio, SYSDATETIME()) AS NVARCHAR(20)) + N' ms</td></tr></table>' +
                    N'<p style="color:#666;font-size:12px">Bitacora: rh.log_sincronizacion_saldos, id_log ' + CAST(@id_log AS NVARCHAR(20)) + N'.<br>' +
                    N'Snapshot diario: rh.snapshot_saldos_vacaciones, ' + CAST(@dias_replay AS NVARCHAR(10)) + N' dia(s) revisado(s).<br>' +
                    N'Omitidos = empleados de RH sin correo, sin antiguedad, sin usuario en Asokam o sin usuario_detalle activo. ' +
                    N'Se actualiza dias_generados y, cuando no hay ajustes manuales, dias_ajustados conserva el saldo arrastrado.</p>';

                EXEC Asokam.app.sp_enviar_correo
                     @correo_remitente = 'autorizaciones@grupolefarma.com.mx',
                     @nombre_remitente = N'noreplay',
                     @asunto           = @asunto,
                     @destinatarios    = @correo_notifica,
                     @body_html        = @html;
            END TRY
            BEGIN CATCH
            END CATCH
        END

        SELECT @anio         AS anio,
               @total_rh     AS total_rh,
               @creados      AS creados,
               @actualizados AS actualizados,
               @omitidos     AS omitidos,
               @dias_replay  AS dias_replay,
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
            END CATCH
        END;

        EXEC sys.sp_set_session_context
             @key = N'vacaciones_comentario',
             @value = NULL;

        THROW;
    END CATCH
END
