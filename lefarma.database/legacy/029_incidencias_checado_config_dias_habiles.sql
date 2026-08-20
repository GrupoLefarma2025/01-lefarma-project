-- =============================================================================
-- MIGRACIÓN: Exclusión de días hábiles que consumen saldo
-- DESCRIPCIÓN: Agrega a rh.incidencias_checado_config el campo que indica si una
--              regla debe excluir los días que consumen saldo (rh.dias_habiles
--              con consume_saldo = 1). Si está activo, esos días no generan
--              incidencia ni descuento.
-- =============================================================================

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('rh.incidencias_checado_config')
      AND name = 'excluir_dias_habiles_consumen_saldo'
)
BEGIN
    ALTER TABLE rh.incidencias_checado_config
        ADD excluir_dias_habiles_consumen_saldo BIT NOT NULL DEFAULT 1;

UPDATE rh.incidencias_checado_config
SET excluir_dias_habiles_consumen_saldo = 1
END
GO
