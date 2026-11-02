/* ============================================================================
   Validación previa del trigger app.trg_Documentos_Update_Estatus
   Destino: Asokam (producción)
   Solo lectura: no crea ni modifica objetos.
   ============================================================================ */

SET NOCOUNT ON;

/* 1) Objetos requeridos */
SELECT v.Base, v.Tipo, v.Objeto,
       CASE
           WHEN v.Tipo = 'TABLA'
                AND OBJECT_ID(v.Objeto, N'U') IS NOT NULL THEN N'OK'
           WHEN v.Tipo = 'PROCEDIMIENTO'
                AND OBJECT_ID(v.Objeto, N'P') IS NOT NULL THEN N'OK'
           WHEN v.Tipo = 'TRIGGER'
                AND OBJECT_ID(v.Objeto, N'TR') IS NOT NULL THEN N'OK'
           ELSE N'MISSING'
       END AS Estado
FROM (VALUES
    (N'Asokam', N'TABLA',        N'app.Documentos'),
    (N'Asokam', N'TABLA',        N'app.DocumentosInterfaseSolicitud'),
    (N'Asokam', N'TABLA',        N'app.DocumentosInterfaseOC'),
    (N'Asokam', N'TABLA',        N'app.LogNotificacionDocumento'),
    (N'Asokam', N'TABLA',        N'app.ConcentradoRespuestaOCLog'),
    (N'Asokam', N'PROCEDIMIENTO', N'dbo.sp_EnviarRespuestaCurl'),
    (N'msdb',   N'PROCEDIMIENTO', N'msdb.dbo.sp_send_dbmail'),
    (N'Lefarma', N'TABLA',       N'Lefarma.rh.envios_solicitudes'),
    (N'Lefarma', N'TABLA',       N'Lefarma.operaciones.envios_concentrado'),
    (N'Asokam', N'TRIGGER',      N'app.trg_Documentos_Update_Estatus')
) v(Base, Tipo, Objeto)
ORDER BY v.Base, v.Objeto;

/* 2) Columnas requeridas en Asokam */
SELECT v.Tabla, v.Columna,
       CASE
           WHEN EXISTS (
               SELECT 1
               FROM sys.columns c
               WHERE c.object_id = OBJECT_ID(v.Tabla)
                 AND c.name = v.Columna
           ) THEN N'OK'
           ELSE N'MISSING'
       END AS Estado
FROM (VALUES
    (N'app.Documentos', N'Id'),
    (N'app.Documentos', N'Estatus'),
    (N'app.Documentos', N'ComentariosDecision'),

    (N'app.DocumentosInterfaseSolicitud', N'id_documento_firmar'),
    (N'app.DocumentosInterfaseSolicitud', N'id_envio'),

    (N'app.DocumentosInterfaseOC', N'IdDocumentoFirmar'),
    (N'app.DocumentosInterfaseOC', N'id_envio_concentrado'),

    (N'app.LogNotificacionDocumento', N'id_log'),
    (N'app.LogNotificacionDocumento', N'fecha'),
    (N'app.LogNotificacionDocumento', N'id_documento'),
    (N'app.LogNotificacionDocumento', N'estatus'),
    (N'app.LogNotificacionDocumento', N'accion'),
    (N'app.LogNotificacionDocumento', N'rama'),
    (N'app.LogNotificacionDocumento', N'id_envio'),
    (N'app.LogNotificacionDocumento', N'id_usuario'),
    (N'app.LogNotificacionDocumento', N'http_method'),
    (N'app.LogNotificacionDocumento', N'url'),
    (N'app.LogNotificacionDocumento', N'request_json'),
    (N'app.LogNotificacionDocumento', N'http_status'),
    (N'app.LogNotificacionDocumento', N'response_text'),
    (N'app.LogNotificacionDocumento', N'ole_error'),
    (N'app.LogNotificacionDocumento', N'resultado'),
    (N'app.LogNotificacionDocumento', N'detalle'),
    (N'app.LogNotificacionDocumento', N'id_concentrado'),

    (N'app.ConcentradoRespuestaOCLog', N'id_log'),
    (N'app.ConcentradoRespuestaOCLog', N'id_concentrado'),
    (N'app.ConcentradoRespuestaOCLog', N'id_documento'),
    (N'app.ConcentradoRespuestaOCLog', N'documentos_json'),
    (N'app.ConcentradoRespuestaOCLog', N'token_seguridad'),
    (N'app.ConcentradoRespuestaOCLog', N'id_usuario'),
    (N'app.ConcentradoRespuestaOCLog', N'accion'),
    (N'app.ConcentradoRespuestaOCLog', N'comentario'),
    (N'app.ConcentradoRespuestaOCLog', N'json_enviado'),
    (N'app.ConcentradoRespuestaOCLog', N'http_status'),
    (N'app.ConcentradoRespuestaOCLog', N'response'),
    (N'app.ConcentradoRespuestaOCLog', N'error_detalle'),
    (N'app.ConcentradoRespuestaOCLog', N'exitoso')
) v(Tabla, Columna)
ORDER BY v.Tabla, v.Columna;

/* 2b) Columnas requeridas en Lefarma */
SELECT v.Tabla, v.Columna,
       CASE
           WHEN EXISTS (
               SELECT 1
               FROM [Lefarma].sys.columns c
               WHERE c.object_id = OBJECT_ID(N'Lefarma.' + v.Tabla)
                 AND c.name = v.Columna
           ) THEN N'OK'
           ELSE N'MISSING'
       END AS Estado
FROM (VALUES
    (N'rh.envios_solicitudes', N'id_envio'),
    (N'rh.envios_solicitudes', N'token_seguridad'),
    (N'operaciones.envios_concentrado', N'id_envio_concentrado'),
    (N'operaciones.envios_concentrado', N'token_seguridad')
) v(Tabla, Columna)
ORDER BY v.Tabla, v.Columna;

/* 3) Dependencias de servidor / Database Mail */
SELECT N'OLE Automation Procedures' AS Dependencia,
       CASE WHEN EXISTS (
                SELECT 1
                FROM sys.configurations
                WHERE name = N'Ole Automation Procedures'
                  AND CONVERT(int, value_in_use) = 1
            ) THEN N'OK' ELSE N'DISABLED' END AS Estado
UNION ALL
SELECT N'Database Mail profile Alertas',
       CASE WHEN EXISTS (
                SELECT 1
                FROM msdb.dbo.sysmail_profile
                WHERE name = N'Alertas'
            ) THEN N'OK' ELSE N'MISSING' END;

/* 4) Resumen: solo faltantes */
SELECT v.Base, v.Tipo, v.Objeto
FROM (VALUES
    (N'Asokam', N'TABLA',        N'app.Documentos'),
    (N'Asokam', N'TABLA',        N'app.DocumentosInterfaseSolicitud'),
    (N'Asokam', N'TABLA',        N'app.DocumentosInterfaseOC'),
    (N'Asokam', N'TABLA',        N'app.LogNotificacionDocumento'),
    (N'Asokam', N'TABLA',        N'app.ConcentradoRespuestaOCLog'),
    (N'Asokam', N'PROCEDIMIENTO', N'dbo.sp_EnviarRespuestaCurl'),
    (N'msdb',   N'PROCEDIMIENTO', N'msdb.dbo.sp_send_dbmail'),
    (N'Lefarma', N'TABLA',       N'Lefarma.rh.envios_solicitudes'),
    (N'Lefarma', N'TABLA',       N'Lefarma.operaciones.envios_concentrado'),
    (N'Asokam', N'TRIGGER',      N'app.trg_Documentos_Update_Estatus')
) v(Base, Tipo, Objeto)
WHERE (v.Tipo = N'TABLA'        AND OBJECT_ID(v.Objeto, N'U') IS NULL)
   OR (v.Tipo = N'PROCEDIMIENTO' AND OBJECT_ID(v.Objeto, N'P') IS NULL)
   OR (v.Tipo = N'TRIGGER'      AND OBJECT_ID(v.Objeto, N'TR') IS NULL);
