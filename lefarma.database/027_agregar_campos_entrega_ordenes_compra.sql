-- =============================================================================
-- 027. AGREGAR CAMPOS DE ENTREGA Y TRANSPORTE A ORDENES DE COMPRA
-- =============================================================================
-- El modelo EF ya mapea estas columnas (OrdenCompraConfiguration) pero el
-- script de schema nunca se creo, causando "Invalid column name" en runtime.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'facturar_a')
    ALTER TABLE operaciones.ordenes_compra ADD facturar_a NVARCHAR(800) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'domicilio_entrega')
    ALTER TABLE operaciones.ordenes_compra ADD domicilio_entrega NVARCHAR(800) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'folio_transporte')
    ALTER TABLE operaciones.ordenes_compra ADD folio_transporte INT NULL;

PRINT 'Script 027 ejecutado correctamente.';
