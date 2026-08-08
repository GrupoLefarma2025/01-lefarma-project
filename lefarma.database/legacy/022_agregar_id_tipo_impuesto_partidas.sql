-- ============================================================================
-- LEFARMA - Agregar id_tipo_impuesto a ordenes_compra_partidas
-- ============================================================================
-- Fecha: 2026-05-22
-- Descripcion: Agrega columna id_tipo_impuesto para persistir el tipo de
--              impuesto seleccionado por partida (antes solo se guardaba el %).
-- ============================================================================

USE Lefarma;
GO

-- PASO 1: Agregar columna
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra_partidas]') 
      AND name = 'id_tipo_impuesto'
)
BEGIN
    ALTER TABLE operaciones.ordenes_compra_partidas 
    ADD id_tipo_impuesto INT NULL;
    PRINT 'Columna [id_tipo_impuesto] agregada a [operaciones].[ordenes_compra_partidas]';
END
ELSE
BEGIN
    PRINT 'Columna [id_tipo_impuesto] ya existe. Saltando ALTER TABLE.';
END
GO

-- PASO 2: Backfill - matchear porcentaje_iva contra la tasa del catalogo
-- tasa 0.16 = IVA 16%, tasa 0.08 = IVA 8%, etc.
UPDATE p
SET p.id_tipo_impuesto = t.id_tipo_impuesto
FROM operaciones.ordenes_compra_partidas p
INNER JOIN catalogos.tipos_impuesto t 
  ON t.tasa = p.porcentaje_iva / 100.0
WHERE p.id_tipo_impuesto IS NULL;
GO

PRINT 'Backfill completado.';
GO

-- PASO 3: Default a "Sin Impuesto" (id 6) para partidas con porcentaje_iva = 0
--          que no matchearon (hay 3 tipos con tasa 0.00)
UPDATE operaciones.ordenes_compra_partidas
SET id_tipo_impuesto = 6
WHERE id_tipo_impuesto IS NULL;
GO

PRINT 'Defaults aplicados. Script completado.';
GO
