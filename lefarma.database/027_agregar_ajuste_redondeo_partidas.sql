-- ============================================================================
-- LEFARMA - Agregar ajuste_redondeo a ordenes_compra_partidas
-- ============================================================================
-- Fecha: 2026-08-17
-- Descripcion: Agrega columna ajuste_redondeo (DECIMAL(18,2) NULL) para capturar
--              un ajuste por redondeo por partida que afecta SOLO el total final
--              de la partida y el Total de la orden (no Subtotal ni TotalIva).
--              Rango permitido: -5.00 a 5.00.
-- ============================================================================

USE Lefarma;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra_partidas]') 
      AND name = 'ajuste_redondeo'
)
BEGIN
    ALTER TABLE operaciones.ordenes_compra_partidas 
    ADD ajuste_redondeo DECIMAL(18,2) NULL;
    PRINT 'Columna [ajuste_redondeo] agregada a [operaciones].[ordenes_compra_partidas]';
END
ELSE
BEGIN
    PRINT 'Columna [ajuste_redondeo] ya existe. Saltando ALTER TABLE.';
END
GO
