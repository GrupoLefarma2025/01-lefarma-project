-- Respaldo del trigger vigente en Asokam (produccion) al 28/10/2026, antes de migrar a la version con rama RH.
-- Objeto: app.trg_Documentos_Update_Estatus
-- Version: solo rama OC (ultima modificacion 2026-08-18).
GO
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE TRIGGER [app].[trg_Documentos_Update_Estatus]
ON [Asokam].[app].[Documentos]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Solo actuar si el campo Estatus fue actualizado
    IF UPDATE(Estatus)
    BEGIN
        -- Declaramos variables para los datos del CURL
        DECLARE @idConcentrado INT,
                @tokenSeguridad VARCHAR(255),
                @idUsuario INT = 20,
                @accion VARCHAR(20),
                @comentario VARCHAR(MAX),
                @nuevoEstatus INT;

        -- Validamos si los registros actualizados cumplen las condiciones
        -- Unimos 'inserted' (nuevos datos) con las tablas de relación
        SELECT 
            @idConcentrado = di.id_envio_concentrado,
            @tokenSeguridad = ec.token_seguridad,
            @nuevoEstatus = i.Estatus,
            @comentario = ISNULL(i.ComentariosDecision, 'Sin comentario')
        FROM inserted i
        INNER JOIN [app].[DocumentosInterfaseOC] di ON i.Id = di.IdDocumentoFirmar
        INNER JOIN Lefarma.[operaciones].[envios_concentrado] ec ON di.id_envio_concentrado = ec.id_envio_concentrado
        WHERE i.Estatus IN (2, 3);

        -- Si se encontró coincidencia, ejecutamos la acción
        IF @idConcentrado IS NOT NULL
        BEGIN
            SET @accion = CASE WHEN @nuevoEstatus = 2 THEN 'AUTORIZAR' ELSE 'DEVOLVER' END;

            -- Llamada al procedimiento que ejecuta el CURL
            -- (Debes crear este SP a continuación)
            EXEC [Asokam].[dbo].[sp_EnviarRespuestaCurl] 
                @idConcentrado, 
                @tokenSeguridad, 
                @idUsuario, 
                @accion, 
                @comentario;
        END
    END

    
---- (Debes crear este SP a continuación)
--            EXEC [Asokam].[dbo].[sp_EnviarRespuestaCurl] 
--                1034, 
--                '4309b38fbce743e7a8bdf983c7a58555', 
--                 20,
--               'DEVOLVER', 
--                'Este documento no viene firmado por el area de finanzas quienes revisan y autorizan los pagos . Debe indicar nombre y firma .  Se deben controlar los costos de entregas futuras.  1.  cuanto se le paga a DHL de acuerdo a contrato firmado con dicha mensajeria 2. David alvizar tiene una entrega de 340 por caja fuera del rango autorizado 3. Luis E trejo esta haciendo una entrega por caja de 1040 hay tarifas autorizadas para entregas. 4. Gineco nuevo leon se esta pagando 369 por caja'


--select * from  [app].[DocumentosInterfaseOC] 
--where IdDocumentoFirmar ='25b501b6-b152-4b5b-8f9c-02c5d87ccbe0'
--select * from  Lefarma.[operaciones].[envios_concentrado] where id_envio_concentrado = 1034


--select * from Lefarma.operaciones.ordenes_compra where id_orden in (
--select id_orden from Lefarma.[operaciones].envios_concentrado_ordenes where id_envio_concentrado= 1034
--)
--select * from app.Documentos
--where Id  ='25b501b6-b152-4b5b-8f9c-02c5d87ccbe0'
END
GO
