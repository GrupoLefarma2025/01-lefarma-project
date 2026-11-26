SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

CREATE OR ALTER PROCEDURE rh.sp_sincroniza_saldos_vacaciones
    @correo_notifica VARCHAR(256) = '21@grupolefarma.com.mx; 6@grupolefarma.com.mx',
    @correo_error    VARCHAR(256) = '21@grupolefarma.com.mx; 6@grupolefarma.com.mx'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @hoy        DATE = CAST(SYSDATETIME() AS DATE),
            @anio       INT = YEAR(CAST(SYSDATETIME() AS DATE)),
            @inicio     DATETIME2(3) = SYSDATETIME(),
            @id_log     INT,
            @total_rh   INT = 0,
            @mapeados   INT = 0,
            @creados    INT = 0,
            @actualizados INT = 0,
            @vencidos   INT = 0,
            @omitidos   INT = 0;

    INSERT INTO rh.log_sincronizacion_saldos (fecha_inicio, anio, estatus)
    VALUES (@inicio, @anio, 'EN_PROCESO');

    SET @id_log = SCOPE_IDENTITY();

    BEGIN TRY
        IF OBJECT_ID('tempdb..#rh') IS NOT NULL DROP TABLE #rh;
        CREATE TABLE #rh (
            correo       VARCHAR(512) COLLATE DATABASE_DEFAULT NOT NULL,
            fechaingreso DATE NOT NULL
        );

        INSERT INTO #rh (correo, fechaingreso)
        SELECT correo, CAST(fechaingreso AS DATE)
        FROM [ESFR-DOCTS].Asistencias.dbo.vwEmpleados
        WHERE correo IS NOT NULL
          AND LTRIM(RTRIM(correo)) <> ''
          AND fechaingreso IS NOT NULL;

        UPDATE #rh SET correo = LTRIM(RTRIM(correo));

        IF OBJECT_ID('tempdb..#mapa') IS NOT NULL DROP TABLE #mapa;
        CREATE TABLE #mapa (
            IdUsuario    INT          NOT NULL PRIMARY KEY,
            id_empresa   INT          NOT NULL,
            correo       VARCHAR(512) NOT NULL,
            fechaingreso DATE         NOT NULL
        );

        ;WITH rh_unicos AS (
            SELECT correo, MAX(fechaingreso) AS fechaingreso
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
        INSERT INTO #mapa (IdUsuario, id_empresa, correo, fechaingreso)
        SELECT u.IdUsuario, d.id_empresa, r.correo, r.fechaingreso
        FROM rh_unicos r
        INNER JOIN usuarios_correo u ON u.correo = r.correo AND u.rn = 1
        INNER JOIN Lefarma.config.usuario_detalle d
            ON d.id_usuario = u.IdUsuario AND d.activo = 1;

        SET @total_rh = (SELECT COUNT(DISTINCT correo) FROM #rh);
        SET @mapeados = (SELECT COUNT(*) FROM #mapa);
        SET @omitidos = @total_rh - @mapeados;

        BEGIN TRAN;

        INSERT INTO rh.saldos_vacaciones_periodos
        (
            id_usuario,
            id_empresa,
            fecha_inicio_periodo,
            fecha_fin_periodo,
            fecha_limite_disfrute,
            numero_periodo,
            dias_generados,
            dias_ajustados_arrastre,
            activo,
            fecha_creacion
        )
        SELECT
            m.IdUsuario,
            m.id_empresa,
            p.inicio,
            p.fin,
            p.limite_disfrute,
            p.numero,
            rh.fn_dias_vacaciones_por_antiguedad(p.numero),
            ISNULL((
                SELECT SUM(h.dias_total - h.dias_aplicados)
                FROM rh.saldos_vacaciones_arrastre h
                WHERE h.id_usuario = m.IdUsuario AND h.activo = 1
            ), 0),
            1,
            GETDATE()
        FROM #mapa m
        CROSS APPLY rh.fn_periodo_vacaciones(m.fechaingreso, @hoy) p
        WHERE NOT EXISTS (
            SELECT 1
            FROM rh.saldos_vacaciones_periodos s
            WHERE s.id_usuario = m.IdUsuario AND s.fecha_inicio_periodo = p.inicio
        );

        SET @creados = @@ROWCOUNT;

        UPDATE s
        SET s.dias_generados = rh.fn_dias_vacaciones_por_antiguedad(p.numero),
            s.dias_ajustados_arrastre = ISNULL((
                SELECT SUM(h.dias_total - h.dias_aplicados)
                FROM rh.saldos_vacaciones_arrastre h
                WHERE h.id_usuario = s.id_usuario AND h.activo = 1
            ), 0),
            s.fecha_modificacion = SYSDATETIME()
        FROM rh.saldos_vacaciones_periodos s
        INNER JOIN #mapa m ON m.IdUsuario = s.id_usuario
        CROSS APPLY rh.fn_periodo_vacaciones(m.fechaingreso, @hoy) p
        WHERE s.activo = 1
          AND s.fecha_inicio_periodo = p.inicio
          AND (
              s.dias_generados <> rh.fn_dias_vacaciones_por_antiguedad(p.numero)
              OR s.dias_ajustados_arrastre <> ISNULL((
                  SELECT SUM(h.dias_total - h.dias_aplicados)
                  FROM rh.saldos_vacaciones_arrastre h
                  WHERE h.id_usuario = s.id_usuario AND h.activo = 1
              ), 0)
          );

        SET @actualizados = @@ROWCOUNT;

        UPDATE s
        SET s.dias_ajustados_arrastre = 0,
            s.fecha_modificacion = SYSDATETIME()
        FROM rh.saldos_vacaciones_periodos s
        INNER JOIN #mapa m ON m.IdUsuario = s.id_usuario
        CROSS APPLY rh.fn_periodo_vacaciones(m.fechaingreso, @hoy) p
        WHERE s.activo = 1
          AND s.fecha_inicio_periodo <> p.inicio
          AND s.dias_ajustados_arrastre <> 0;

        UPDATE s
        SET s.dias_vencidos = s.dias_generados + s.dias_compensados + s.dias_ajustados - s.dias_tomados,
            s.fecha_modificacion = SYSDATETIME()
        FROM rh.saldos_vacaciones_periodos s
        WHERE s.activo = 1
          AND s.fecha_limite_disfrute < @hoy
          AND (s.dias_generados + s.dias_compensados + s.dias_ajustados - s.dias_tomados) > s.dias_vencidos;

        SET @vencidos = @@ROWCOUNT;

        INSERT INTO rh.snapshot_saldos_vacaciones
        (
            fecha_snapshot,
            id_saldo,
            id_usuario,
            id_empresa,
            anio,
            fecha_inicio_periodo,
            fecha_fin_periodo,
            fecha_limite_disfrute,
            numero_periodo,
            dias_generados,
            dias_vencidos,
            dias_compensados,
            dias_ajustados,
            dias_tomados,
            dias_pendientes,
            id_log
        )
        SELECT
            @hoy,
            s.id_saldo,
            s.id_usuario,
            s.id_empresa,
            YEAR(s.fecha_inicio_periodo),
            s.fecha_inicio_periodo,
            s.fecha_fin_periodo,
            s.fecha_limite_disfrute,
            s.numero_periodo,
            s.dias_generados,
            s.dias_vencidos,
            s.dias_compensados,
            s.dias_ajustados + s.dias_ajustados_arrastre,
            s.dias_tomados,
            s.dias_pendientes,
            @id_log
        FROM rh.saldos_vacaciones_periodos s
        WHERE s.activo = 1
          AND NOT EXISTS (
              SELECT 1
              FROM rh.snapshot_saldos_vacaciones x
              WHERE x.fecha_snapshot = @hoy AND x.id_saldo = s.id_saldo
          );

        COMMIT TRAN;

        UPDATE rh.log_sincronizacion_saldos
        SET fecha_fin = SYSDATETIME(),
            duracion_ms = DATEDIFF(MILLISECOND, @inicio, SYSDATETIME()),
            estatus = 'OK',
            total_rh = @total_rh,
            creados = @creados,
            actualizados = @actualizados,
            omitidos = @omitidos
        WHERE id_log = @id_log;

        IF @correo_notifica IS NOT NULL
           AND LTRIM(RTRIM(@correo_notifica)) <> ''
           AND (@creados + @actualizados + @vencidos) > 0
        BEGIN
            BEGIN TRY
                DECLARE @asunto NVARCHAR(500) =
                    CONCAT('[Lefarma] Saldos de vacaciones por período: ',
                           @creados, ' creados, ', @actualizados, ' actualizados, ',
                           @vencidos, ' vencidos, ', @omitidos, ' omitidos');

                DECLARE @html NVARCHAR(MAX) =
                    N'<p>Sincronización de <b>rh.saldos_vacaciones_periodos</b> por aniversario.</p>' +
                    N'<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:13px">' +
                    N'<tr style="background:#f0f0f0"><th>Concepto</th><th>Valor</th></tr>' +
                    N'<tr><td>Fecha</td><td>' + CONVERT(NVARCHAR(19), SYSDATETIME(), 120) + N'</td></tr>' +
                    N'<tr><td>Creados</td><td align="center">' + CAST(@creados AS NVARCHAR(10)) + N'</td></tr>' +
                    N'<tr><td>Actualizados</td><td align="center">' + CAST(@actualizados AS NVARCHAR(10)) + N'</td></tr>' +
                    N'<tr><td>Vencidos</td><td align="center">' + CAST(@vencidos AS NVARCHAR(10)) + N'</td></tr>' +
                    N'<tr><td>Omitidos</td><td align="center">' + CAST(@omitidos AS NVARCHAR(10)) + N'</td></tr></table>' +
                    N'<p style="color:#666;font-size:12px">Bitácora: rh.log_sincronizacion_saldos, id_log ' + CAST(@id_log AS NVARCHAR(20)) + N'.</p>';

                EXEC Asokam.app.sp_enviar_correo
                     @correo_remitente = 'autorizaciones@grupolefarma.com.mx',
                     @nombre_remitente = N'noreplay',
                     @asunto = @asunto,
                     @destinatarios = @correo_notifica,
                     @body_html = @html;
            END TRY
            BEGIN CATCH
            END CATCH
        END

        SELECT
            @anio AS anio,
            @total_rh AS total_rh,
            @creados AS creados,
            @actualizados AS actualizados,
            @vencidos AS vencidos,
            @omitidos AS omitidos,
            @id_log AS id_log;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        DECLARE @num_error INT = ERROR_NUMBER(),
                @msg_error NVARCHAR(4000) = ERROR_MESSAGE(),
                @line_error INT = ERROR_LINE(),
                @proc_error NVARCHAR(256) = ERROR_PROCEDURE();

        BEGIN TRY
            UPDATE rh.log_sincronizacion_saldos
            SET fecha_fin = SYSDATETIME(),
                duracion_ms = DATEDIFF(MILLISECOND, @inicio, SYSDATETIME()),
                estatus = 'ERROR',
                numero_error = @num_error,
                mensaje_error = @msg_error,
                linea_error = @line_error,
                procedure_error = @proc_error
            WHERE id_log = @id_log;
        END TRY
        BEGIN CATCH
        END CATCH

        IF @correo_error IS NOT NULL AND LTRIM(RTRIM(@correo_error)) <> ''
        BEGIN
            BEGIN TRY
                DECLARE @asunto_err NVARCHAR(500) =
                    CONCAT('[Lefarma] ERROR sincronización saldos vacaciones (log #', @id_log, ')');

                DECLARE @html_err NVARCHAR(MAX) =
                    N'<p>Falló la sincronización de <b>rh.saldos_vacaciones_periodos</b>.</p>' +
                    N'<p>Error ' + CAST(@num_error AS NVARCHAR(20)) + N': ' + @msg_error + N'</p>' +
                    N'<p>Bitácora: rh.log_sincronizacion_saldos, id_log ' + CAST(@id_log AS NVARCHAR(20)) + N'.</p>';

                EXEC Asokam.app.sp_enviar_correo
                     @correo_remitente = 'autorizaciones@grupolefarma.com.mx',
                     @nombre_remitente = N'noreplay',
                     @asunto = @asunto_err,
                     @destinatarios = @correo_error,
                     @body_html = @html_err;
            END TRY
            BEGIN CATCH
            END CATCH
        END;

        THROW;
    END CATCH
END;
GO
