/* ============================================================================
   Migración del trigger de documentos de AsokamDev a Asokam
   ----------------------------------------------------------------------------
   Requisitos previos:
   - Ejecutar en Asokam (producción).
   - Ejecutar primero validar_trigger_documentos_asokam.sql.
   - app.LogNotificacionDocumento no existe en producción; este script la crea.
   - El trigger ya existe en Asokam y se reemplaza con CREATE OR ALTER.

   Cambios respecto al script de AsokamDev:
   - ON [AsokamDev].[app].[Documentos] -> ON [app].[Documentos]
   - EXEC [AsokamDev].[dbo].[sp_EnviarRespuestaCurl]
       -> EXEC [dbo].[sp_EnviarRespuestaCurl]
   - Las referencias cruzadas a Lefarma se conservan.
   ============================================================================ */

USE [Asokam];
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

/* Tabla de bitácora que falta en producción. */
IF OBJECT_ID(N'app.LogNotificacionDocumento', N'U') IS NULL
BEGIN
    CREATE TABLE [app].[LogNotificacionDocumento]
    (
        id_log bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_LogNotificacionDocumento PRIMARY KEY,
        fecha datetime2(3) NOT NULL
            CONSTRAINT DF_LogNotificacionDocumento_fecha DEFAULT (SYSDATETIME()),
        id_documento uniqueidentifier NULL,
        estatus int NULL,
        accion varchar(20) NULL,
        rama varchar(20) NULL,
        id_envio int NULL,
        id_usuario int NULL,
        http_method varchar(10) NULL,
        url nvarchar(1000) NULL,
        request_json nvarchar(max) NULL,
        http_status int NULL,
        response_text nvarchar(max) NULL,
        ole_error nvarchar(max) NULL,
        resultado varchar(20) NOT NULL,
        detalle nvarchar(max) NULL,
        id_concentrado int NULL
    );

    PRINT N'Creada app.LogNotificacionDocumento.';
END
ELSE
BEGIN
    PRINT N'app.LogNotificacionDocumento ya existe; se conserva.';
END;
GO

/* Trigger corregido para producción. */
CREATE OR ALTER TRIGGER [app].[trg_Documentos_Update_Estatus]
ON [app].[Documentos]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(Estatus)
        RETURN;

    IF (SELECT COUNT(*) FROM inserted) > 1
    BEGIN
        INSERT INTO app.LogNotificacionDocumento (resultado, rama, detalle)
        VALUES ('SKIP', 'MULTIROW',
                CONCAT('Update multi-fila: ', (SELECT COUNT(*) FROM inserted),
                       ' filas. No se notifico a ningun sistema externo.'));
        RETURN;
    END

    DECLARE @idDocumento    UNIQUEIDENTIFIER,
            @nuevoEstatus   INT,
            @comentario     NVARCHAR(MAX),
            @accion         VARCHAR(20),
            @idUsuario      INT = 20,
            @idConcentrado  INT = NULL,
            @idEnvio        INT = NULL,
            @tokenSeguridad NVARCHAR(255) = NULL,
            @url            NVARCHAR(500),
            @json           NVARCHAR(MAX),
            @Object         INT,
            @ResponseText   NVARCHAR(MAX) = NULL,
            @Status         INT = NULL,
            @oleError       NVARCHAR(MAX) = NULL,
            @resultado      VARCHAR(20);

    SELECT TOP (1)
        @idDocumento  = i.Id,
        @nuevoEstatus = i.Estatus,
        @comentario   = ISNULL(i.ComentariosDecision, 'Sin comentario')
    FROM inserted i
    WHERE i.Estatus IN (2, 3);

    IF @nuevoEstatus IS NULL
        RETURN;

    SET @accion = CASE WHEN @nuevoEstatus = 2 THEN 'AUTORIZAR' ELSE 'DEVOLVER' END;

    /* ------------------------------------------------------------ RH ------ */
    IF EXISTS (SELECT 1
               FROM inserted i
               INNER JOIN [app].[DocumentosInterfaseSolicitud] s ON s.id_documento_firmar = i.Id)
    BEGIN
        SELECT TOP (1)
            @idEnvio        = s.id_envio,
            @tokenSeguridad = es.token_seguridad
        FROM inserted i
        INNER JOIN [app].[DocumentosInterfaseSolicitud] s ON s.id_documento_firmar = i.Id
        INNER JOIN Lefarma.[rh].[envios_solicitudes] es ON es.id_envio = s.id_envio;

        IF @idEnvio IS NULL
        BEGIN
            INSERT INTO app.LogNotificacionDocumento
                (id_documento, estatus, accion, rama, id_usuario, resultado, detalle)
            SELECT i.Id, i.Estatus, @accion, 'RH', @idUsuario, 'OMITIDO',
                   'Documento enlazado a DocumentosInterfaseSolicitud pero sin fila en Lefarma.rh.envios_solicitudes'
            FROM inserted i;
            RETURN;
        END

        SET @url = N'http://200.94.77.190:5074/api/solicitudes-personal/externo/respuesta';

        SET @json = N'{'
            + N'"idEnvio": '          + CAST(@idEnvio AS NVARCHAR(20)) + N','
            + N'"tokenSeguridad": "'  + ISNULL(STRING_ESCAPE(@tokenSeguridad, 'json'), N'') + N'",'
            + N'"idUsuario": '        + CAST(@idUsuario AS NVARCHAR(20)) + N','
            + N'"accion": "'         + ISNULL(STRING_ESCAPE(@accion, 'json'), N'') + N'",'
            + N'"comentario": "'     + ISNULL(STRING_ESCAPE(@comentario, 'json'), N'') + N'"'
            + N'}';

        SET @resultado = 'ERROR';

        BEGIN TRY
            EXEC sys.sp_OACreate 'MSXML2.ServerXMLHttp', @Object OUT;

            BEGIN TRY
                /* sp_OAMethod: 3er param = variable de SALIDA; NULL cuando no se usa */
                EXEC sys.sp_OAMethod @Object, 'setTimeouts', NULL, 30000, 30000, 60000, 30000;
                EXEC sys.sp_OAMethod @Object, 'open', NULL, 'POST', @url, 'false';
                EXEC sys.sp_OAMethod @Object, 'setRequestHeader', NULL, 'Content-Type', 'application/json; charset=utf-8';
                EXEC sys.sp_OAMethod @Object, 'setRequestHeader', NULL, 'accept', '*/*';
                EXEC sys.sp_OAMethod @Object, 'send', NULL, @json;
            END TRY
            BEGIN CATCH
                SET @oleError = CONCAT('OLE open/send: ', ERROR_MESSAGE());
            END CATCH;

            BEGIN TRY
                EXEC sys.sp_OAGetProperty @Object, 'status', @Status OUTPUT;
            END TRY
            BEGIN CATCH
                SET @oleError = CONCAT(ISNULL(@oleError + ' | ', ''), 'status: ', ERROR_MESSAGE());
            END CATCH;

            BEGIN TRY
                EXEC sys.sp_OAMethod @Object, 'responseText', @ResponseText OUTPUT;
            END TRY
            BEGIN CATCH
                SET @oleError = CONCAT(ISNULL(@oleError + ' | ', ''), 'responseText: ', ERROR_MESSAGE());
            END CATCH;

            SET @resultado = CASE WHEN @Status BETWEEN 200 AND 299 THEN 'OK' ELSE 'ERROR' END;
        END TRY
        BEGIN CATCH
            SET @resultado = 'ERROR';
            SET @oleError = CONCAT(ISNULL(@oleError + ' | ', ''), 'sp_OA: ', ERROR_MESSAGE());
        END CATCH;

        BEGIN TRY
            EXEC sys.sp_OADestroy @Object;
        END TRY
        BEGIN CATCH
            SET @oleError = CONCAT(ISNULL(@oleError + ' | ', ''), 'destroy: ', ERROR_MESSAGE());
        END CATCH;

        INSERT INTO app.LogNotificacionDocumento
            (id_documento, estatus, accion, rama, id_envio, id_usuario,
             http_method, url, request_json, http_status, response_text, ole_error, resultado)
        VALUES
            (@idDocumento, @nuevoEstatus, @accion, 'RH', @idEnvio, @idUsuario,
             'POST', @url, @json, @Status, @ResponseText, @oleError, @resultado);

        SELECT @Status       AS HttpStatus,
               @ResponseText AS Response,
               @oleError     AS OleError,
               @resultado    AS Resultado;

        /* NO hacemos THROW: dentro de un trigger aborta el lote y revierte el
           UPDATE de Estatus (y el log con él). Descomenta si prefieres fail-hard. */
    END

    /* ------------------------------------------------------------ OC ------ */
    ELSE IF EXISTS (SELECT 1
                    FROM inserted i
                    INNER JOIN [app].[DocumentosInterfaseOC] di ON di.IdDocumentoFirmar = i.Id)
    BEGIN
        SELECT TOP (1)
            @idConcentrado = di.id_envio_concentrado,
            @tokenSeguridad = ec.token_seguridad
        FROM inserted i
        INNER JOIN [app].[DocumentosInterfaseOC] di ON di.IdDocumentoFirmar = i.Id
        INNER JOIN Lefarma.[operaciones].[envios_concentrado] ec
                ON ec.id_envio_concentrado = di.id_envio_concentrado;

        IF @idConcentrado IS NULL
        BEGIN
            INSERT INTO app.LogNotificacionDocumento
                (id_documento, estatus, accion, rama, id_usuario, resultado, detalle)
            SELECT i.Id, i.Estatus, @accion, 'OC', @idUsuario, 'OMITIDO',
                   'Documento enlazado a DocumentosInterfaseOC pero sin fila en Lefarma.operaciones.envios_concentrado'
            FROM inserted i;
            RETURN;
        END

        SET @resultado = 'ERROR';
        BEGIN TRY
            EXEC [dbo].[sp_EnviarRespuestaCurl]
                @idConcentrado, @tokenSeguridad, @idUsuario, @accion, @comentario;
            SET @resultado = 'OK';
        END TRY
        BEGIN CATCH
            SET @oleError = ERROR_MESSAGE();
        END CATCH;

        INSERT INTO app.LogNotificacionDocumento
            (id_documento, estatus, accion, rama, id_concentrado, id_usuario, ole_error, resultado)
        VALUES
            (@idDocumento, @nuevoEstatus, @accion, 'OC', @idConcentrado, @idUsuario, @oleError, @resultado);
    END

    /* -------------------------------------------------------- OMITIDO ----- */
    ELSE
    BEGIN
        INSERT INTO app.LogNotificacionDocumento
            (id_documento, estatus, accion, resultado, detalle)
        VALUES
            (@idDocumento, @nuevoEstatus, @accion, 'OMITIDO',
             'Estatus 2/3 sin DocumentosInterfaseSolicitud ni DocumentosInterfaseOC: no hay a quien notificar.');
    END
END
GO

PRINT N'Trigger app.trg_Documentos_Update_Estatus migrado en Asokam.';
GO
