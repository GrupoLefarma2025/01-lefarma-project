-- ============================================================================
-- LEFARMA - AGREGAR COLUMNA caratula_path A PROVEEDORES_DETALLE
-- ============================================================================
-- Fecha: 2026-04-20
-- Descripcion: Agrega la columna caratula_path NVARCHAR(500) NULL a la tabla
--              catalogos.proveedores_detalle para almacenar la ruta de la
--              caratula del proveedor
-- ============================================================================

USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'INICIANDO 007_add_proveedor_caratula_path.sql';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- PASO 1: Verificar si existe la columna y agregarla
-- ============================================================================
IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'catalogos' 
        AND TABLE_NAME = 'proveedores_detalle' 
        AND COLUMN_NAME = 'caratula_path'
)
BEGIN
    ALTER TABLE catalogos.proveedores_detalle 
    ADD caratula_path NVARCHAR(500) NULL;
    
    PRINT 'Columna [catalogos].[proveedores_detalle].[caratula_path] agregada';
END
ELSE
BEGIN
    PRINT 'Columna [catalogos].[proveedores_detalle].[caratula_path] ya existe (sin cambios)';
END
GO

-- ============================================================================
-- PASO 2: Verificar que la estructura quedó correcta
-- ============================================================================
PRINT '';
PRINT 'Verificando estructura de catalogos.proveedores_detalle...';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'catalogos'
    AND TABLE_NAME = 'proveedores_detalle'
    AND COLUMN_NAME = 'caratula_path'
ORDER BY COLUMN_NAME;
GO

PRINT '';
PRINT '============================================================';
PRINT '007_add_proveedor_caratula_path.sql COMPLETADO';
PRINT '============================================================';
PRINT '';
GO
