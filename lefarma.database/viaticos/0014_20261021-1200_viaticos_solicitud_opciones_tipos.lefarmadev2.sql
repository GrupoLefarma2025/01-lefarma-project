-- ============================================================
-- 0014_20261021-1200_viaticos_solicitud_opciones_tipos.lefarmadev2.sql
-- Descripcion: amplia el CHECK de viaticos.solicitud_opciones.tipo.
--
--   El constraint original solo aceptaba ('vuelo','hotel'), pero el envio
--   desde los calculos guarda tambien autobus, auto, renta, taxi y
--   transporte publico. Con el CHECK viejo el INSERT fallaba:
--
--     The MERGE statement conflicted with the CHECK constraint
--     "CK_solicitud_opciones_tipo"
--
--   Valores vigentes:
--     vuelo    -> avion
--     autobus  -> autobus (antes "bus" en el motor)
--     auto     -> carro propio
--     renta    -> renta de auto
--     taxi     -> taxi / uber
--     publico  -> metro, metrobus, tren ligero o camion urbano
--     hotel    -> hospedaje elegido
--
-- Target: Lefarma (USE explicito).
-- Idempotente. NO se aplica automaticamente.
-- ============================================================

USE [LefarmaDev2];
GO

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'viaticos.solicitud_opciones', N'U') IS NULL
BEGIN
    PRINT N'viaticos.solicitud_opciones no existe: aplica primero los scripts del modulo.';
    RETURN;
END
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_solicitud_opciones_tipo' AND parent_object_id = OBJECT_ID(N'viaticos.solicitud_opciones'))
BEGIN
    ALTER TABLE viaticos.solicitud_opciones DROP CONSTRAINT CK_solicitud_opciones_tipo;
    PRINT N'CK_solicitud_opciones_tipo eliminado.';
END
GO

ALTER TABLE viaticos.solicitud_opciones WITH CHECK
    ADD CONSTRAINT CK_solicitud_opciones_tipo
    CHECK (tipo IN ('vuelo', 'autobus', 'auto', 'renta', 'taxi', 'publico', 'hotel'));
GO

PRINT N'CK_solicitud_opciones_tipo recreado con los siete tipos vigentes.';
GO
