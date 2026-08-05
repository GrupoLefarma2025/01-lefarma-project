-- ============================================================================
-- LEFARMA - REMOVER forma_pago_id DEL PROVEEDOR
-- ============================================================================
-- Fecha: 2026-04-17
-- Descripcion: Elimina la columna forma_pago_id de catalogos.proveedores
--              ya que la forma de pago ahora solo existe a nivel de cuentas
--              bancarias (proveedor_forma_pago_cuentas)
-- ============================================================================

USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'INICIANDO 006_remove_proveedor_forma_pago_id.sql';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- PASO 1: Verificar si existe la foreign key y eliminarla
-- ============================================================================
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Proveedores_FormasPago')
BEGIN
    ALTER TABLE catalogos.proveedores DROP CONSTRAINT FK_Proveedores_FormasPago;
    PRINT 'FK [FK_Proveedores_FormasPago] eliminada';
END
ELSE
BEGIN
    PRINT 'FK [FK_Proveedores_FormasPago] no existe (posiblemente ya fue eliminada)';
END
GO

-- ============================================================================
-- PASO 2: Verificar si existe la columna y eliminarla
-- ============================================================================
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[catalogos].[proveedores]') AND name = 'forma_pago_id')
BEGIN
    -- Hacer backup de datos si existen (opcional, comentar si no se necesita)
    -- SELECT * INTO #proveedores_forma_pago_backup FROM catalogos.proveedores WHERE forma_pago_id IS NOT NULL;

    ALTER TABLE catalogos.proveedores DROP COLUMN forma_pago_id;
    PRINT 'Columna [catalogos].[proveedores].[forma_pago_id] eliminada';
END
ELSE
BEGIN
    PRINT 'Columna [catalogos].[proveedores].[forma_pago_id] no existe (posiblemente ya fue eliminada)';
END
GO

-- ============================================================================
-- PASO 3: Verificar que la estructura quedó correcta
-- ============================================================================
PRINT '';
PRINT 'Verificando estructura de catalogos.proveedores...';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'catalogos'
    AND TABLE_NAME = 'proveedores'
    AND COLUMN_NAME IN ('forma_pago_id', 'razon_social', 'rfc', 'regimen_fiscal_id', 'uso_cfdi', 'sin_datos_fiscales')
ORDER BY COLUMN_NAME;
GO

PRINT '';
PRINT '============================================================';
PRINT '006_remove_proveedor_forma_pago_id.sql COMPLETADO';
PRINT '============================================================';
PRINT '';
GO
