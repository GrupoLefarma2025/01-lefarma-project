/* ============================================================================
   Grupo Lefarma — Sincronización diaria de saldos de vacaciones

   OBJETIVO
   --------
   Mantener rh.saldos_vacaciones_anuales.dias_generados al día con RH
   (vwEmpleados.vacacionesxantiguedad) para el año en curso (o el indicado).
   
   ------
   EXEC Lefarma.rh.sp_sincroniza_saldos_vacaciones;                                -- año en curso, con correo
   EXEC Lefarma.rh.sp_sincroniza_saldos_vacaciones @anio = 2026, @correo_notifica = NULL;  -- sin correo

   ============================================================================ */

CREATE   PROCEDURE rh.sp_sincroniza_saldos_vacaciones
    @anio            INT = NULL,                             -- NULL = año en curso
    @correo_notifica VARCHAR(256) = '21@grupolefarma.com.mx'  -- NULL o '' = no enviar correo
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @anio = ISNULL(@anio, YEAR(GETDATE()));

    --- 1, Staging RH
    IF OBJECT_ID('tempdb..#rh') IS NOT NULL DROP TABLE #rh;
    CREATE TABLE #rh (
        correo     VARCHAR(512) COLLATE DATABASE_DEFAULT NOT NULL,
        vacaciones DECIMAL(9,2) NULL
    );

    INSERT INTO #rh (correo, vacaciones)
    SELECT correo, vacacionesxantiguedad
    FROM OPENQUERY([ESFR-DOCTS], 'SELECT correo, vacacionesxantiguedad
                                  FROM Asistencias.dbo.vwEmpleados
                                  WHERE correo IS NOT NULL AND LTRIM(RTRIM(correo)) <> ''''
                                    AND vacacionesxantiguedad IS NOT NULL');

    UPDATE #rh SET correo = LTRIM(RTRIM(correo));

    --- 2, Mapeo correo -> usuario -> empresa  
    IF OBJECT_ID('tempdb..#mapa') IS NOT NULL DROP TABLE #mapa;
    CREATE TABLE #mapa (
        IdUsuario INT          NOT NULL PRIMARY KEY,
        id_empresa INT         NOT NULL,
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

    DECLARE @total_rh    INT = (SELECT COUNT(DISTINCT correo) FROM #rh);
    DECLARE @mapeados    INT = (SELECT COUNT(*) FROM #mapa);
    DECLARE @omitidos    INT = @total_rh - @mapeados;
    DECLARE @creados     INT = 0;
    DECLARE @actualizados INT = 0;

    --- 3, Upsert (solo dias_generados) ----------------------------------- */
    BEGIN TRAN;

    UPDATE s
       SET s.dias_generados = m.vacaciones
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

    --- 4, Notificación si hubo cambios 
    IF @correo_notifica IS NOT NULL
       AND LTRIM(RTRIM(@correo_notifica)) <> ''
       AND (@creados + @actualizados) > 0
    BEGIN
        DECLARE @asunto NVARCHAR(500) =
            CONCAT('[Lefarma] Saldos de vacaciones ', @anio, ': ',
                   @creados, ' creados, ', @actualizados, ' actualizados, ', @omitidos, ' omitidos');

        DECLARE @html NVARCHAR(MAX) =
            N'<p>Sincronización de <b>rh.saldos_vacaciones_anuales</b> desde RH (vwEmpleados).</p>' +
            N'<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:13px">' +
            N'<tr style="background:#f0f0f0"><th>Año</th><th>Creados</th><th>Actualizados</th><th>Omitidos</th></tr>' +
            N'<tr><td align="center">' + CAST(@anio AS NVARCHAR(4)) + N'</td>' +
            N'<td align="center">' + CAST(@creados AS NVARCHAR(10)) + N'</td>' +
            N'<td align="center">' + CAST(@actualizados AS NVARCHAR(10)) + N'</td>' +
            N'<td align="center">' + CAST(@omitidos AS NVARCHAR(10)) + N'</td></tr></table>' +
            N'<p style="color:#666;font-size:12px">Omitidos = empleados de RH sin correo/antigüedad, ' +
            N'sin usuario en Asokam o sin usuario_detalle activo. Solo se actualiza dias_generados; ' +
            N'dias_pendientes se recalcula solo.</p>';

        EXEC Asokam.app.sp_enviar_correo
             @correo_remitente = 'autorizaciones@grupolefarma.com.mx',
             @asunto           = @asunto,
             @destinatarios    = @correo_notifica,
             @body_html        = @html;
    END

    --- Resumen
    SELECT @anio AS anio,
           @total_rh AS total_rh,
           @creados AS creados,
           @actualizados AS actualizados,
           @omitidos AS omitidos,
           @correo_notifica AS correo_notifica;
END
