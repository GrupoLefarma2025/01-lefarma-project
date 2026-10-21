-- ============================================================
-- 0012_20261020-0000_viaticos_solicitudes-varias-enviadas.lefarma.sql
-- Descripcion: permite ENVIAR varias solicitudes de viaticos del mismo
--              usuario en el mismo periodo (regla relajada para pruebas).
--
--   El indice unico filtrado UQ_solicitudes_usuario_periodo_estado
--   (WHERE estado <> 'borrador') hacia fallar el segundo envio del mes:
--
--     Cannot insert duplicate key row in object 'viaticos.solicitudes'
--     with unique index 'UQ_solicitudes_usuario_periodo_estado'.
--
--   Nuevo comportamiento:
--     - No hay restriccion de unicidad por (usuario, periodo, estado):
--       se pueden enviar varias solicitudes en el mismo periodo.
--     - Se conserva un indice NO unico para no perder la capacidad de
--       busqueda por usuario/periodo/estado.
--
--   Como restaurar la regla original (una enviada por usuario y periodo):
--     reejecutar 0006_20261019-0000_viaticos_solicitudes-borradores-multiples.lefarma.sql
--     (elimina este indice no unico y recrea el unico filtrado).
--
-- Target: Lefarma (USE explicito).
-- Idempotente: puede reejecutarse; no duplica indices.
-- NO se aplica automaticamente: requiere ejecucion manual.
-- Requiere el esquema base de 0003 (solicitudes).
-- ============================================================

USE [Lefarma];
GO

SET NOCOUNT ON;
GO

-- Necesario para crear indices (sqlcmd arranca con QUOTED_IDENTIFIER OFF).
SET QUOTED_IDENTIFIER ON;
GO

-- 1) Quitar el indice unico filtrado (bloquea el segundo envio del mes).
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'viaticos.solicitudes')
      AND name = N'UQ_solicitudes_usuario_periodo_estado'
)
BEGIN
    DROP INDEX UQ_solicitudes_usuario_periodo_estado ON viaticos.solicitudes;
    PRINT 'Indice [UQ_solicitudes_usuario_periodo_estado] eliminado.';
END
ELSE
    PRINT 'Indice [UQ_solicitudes_usuario_periodo_estado] ya no existe. Skip.';
GO

-- 2) Crear el indice NO unico equivalente (solo para busqueda).
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'viaticos.solicitudes')
      AND name = N'IX_solicitudes_usuario_periodo_estado'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_solicitudes_usuario_periodo_estado
        ON viaticos.solicitudes (id_usuario_solicitante, periodo, estado);
    PRINT 'Indice [IX_solicitudes_usuario_periodo_estado] creado (no unico).';
END
ELSE
    PRINT 'Indice [IX_solicitudes_usuario_periodo_estado] ya existe. Skip.';
GO

PRINT 'FIN script 0012 viaticos (varias solicitudes enviadas por usuario y periodo).';
GO
