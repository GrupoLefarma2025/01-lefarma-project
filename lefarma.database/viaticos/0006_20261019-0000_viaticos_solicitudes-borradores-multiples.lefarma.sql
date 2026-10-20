-- ============================================================
-- 0006_20261019-0000_viaticos_solicitudes-borradores-multiples.lefarma.sql
-- Descripcion: permite guardar VARIOS borradores por usuario y periodo.
--
--   El indice unico UQ_solicitudes_usuario_periodo_estado impedia el
--   segundo "Guardar borrador" del mismo mes:
--
--     Cannot insert duplicate key row in object 'viaticos.solicitudes'
--     with unique index 'UQ_solicitudes_usuario_periodo_estado'.
--     The duplicate key value is (71, 2026-10, borrador).
--
--   Nuevo comportamiento:
--     - Los borradores NO tienen restriccion de unicidad: cada viaje es una
--       solicitud independiente y "Mis viajes" las lista todas.
--     - Los estados distintos de 'borrador' conservan la regla original:
--       una solicitud por (usuario, periodo, estado).
--
-- Idempotente: puede reejecutarse; no duplica indices.
-- NO se aplica automaticamente: requiere ejecucion manual.
-- Requiere el esquema base de 0003 (solicitudes).
-- ============================================================

SET NOCOUNT ON;
GO

-- 1) Quitar el indice unico global (bloquea el segundo borrador).
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

-- 2) Recrearlo como unico SOLO para estados no borrador (indice filtrado).
--    Asi sigue existiendo maximo una solicitud "enviada/autorizada/..." por
--    usuario y periodo, pero los borradores quedan libres.
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'viaticos.solicitudes')
      AND name = N'UQ_solicitudes_usuario_periodo_estado'
)
BEGIN
    CREATE UNIQUE INDEX UQ_solicitudes_usuario_periodo_estado
        ON viaticos.solicitudes (id_usuario_solicitante, periodo, estado)
        WHERE estado <> 'borrador';
    PRINT 'Indice [UQ_solicitudes_usuario_periodo_estado] recreado (filtrado: estado <> borrador).';
END
ELSE
    PRINT 'Indice [UQ_solicitudes_usuario_periodo_estado] ya existe. Skip.';
GO

PRINT 'FIN script 0006 viaticos (borradores multiples por usuario y periodo).';
GO
