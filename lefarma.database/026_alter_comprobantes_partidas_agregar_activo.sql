-- ─────────────────────────────────────────────────────────────────────────────
-- 026: Agregar columna activo a operaciones.comprobantes_partidas
-- Permite soft-delete de asignaciones: se conservan para el historial de
-- comprobantes (comprobantes cancelados siguen apareciendo) sin contar sus
-- importes en los pendientes.
-- ─────────────────────────────────────────────────────────────────────────────

IF COL_LENGTH('operaciones.comprobantes_partidas', 'activo') IS NULL
BEGIN
    ALTER TABLE operaciones.comprobantes_partidas
        ADD activo BIT NOT NULL DEFAULT 1;
END
