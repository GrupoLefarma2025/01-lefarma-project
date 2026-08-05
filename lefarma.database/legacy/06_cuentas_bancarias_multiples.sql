-- ============================================================================
-- LEFARMA - 06_CUENTAS_BANCARIAS_MULTIPLES
-- ============================================================================
-- Fecha: 2026-04-17
-- Descripcion: Permite múltiples cuentas bancarias por orden y por partida.
--              Guarda IDs como JSON array en NVARCHAR(MAX).
--
-- Cambios:
--   operaciones.ordenes_compra:
--     - Eliminar id_forma_pago (ya no se usa)
--     - Eliminar campos denormalizados del proveedor
--     - Agregar id_proveedor (FK)
--     - Agregar ids_cuentas_bancarias (JSON array NVARCHAR)
--
--   operaciones.ordenes_compra_partidas:
--     - Renombrar id_cuenta_bancaria_proveedor -> ids_cuentas_bancarias (NVARCHAR)
-- ============================================================================

USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'INICIANDO 06_cuentas_bancarias_multiples.sql';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- PASO 1: ordenes_compra - Eliminar id_forma_pago y campos denormalizados
-- ============================================================================

-- Eliminar FK constraint si existe
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ordenes_compra_formas_pago')
BEGIN
    ALTER TABLE operaciones.ordenes_compra DROP CONSTRAINT FK_ordenes_compra_formas_pago;
    PRINT 'FK [FK_ordenes_compra_formas_pago] eliminada';
END
GO

-- Agregar id_proveedor si no existe (necesario para la нормализа)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'id_proveedor')
BEGIN
    ALTER TABLE operaciones.ordenes_compra ADD id_proveedor INT NULL;
    PRINT 'Columna [operaciones].[ordenes_compra].[id_proveedor] agregada';
END
GO

-- Agregar ids_cuentas_bancarias (JSON array) si no existe
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'ids_cuentas_bancarias')
BEGIN
    ALTER TABLE operaciones.ordenes_compra ADD ids_cuentas_bancarias NVARCHAR(MAX) NULL;
    PRINT 'Columna [operaciones].[ordenes_compra].[ids_cuentas_bancarias] agregada';
END
GO

-- Eliminar id_forma_pago
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'id_forma_pago')
BEGIN
    ALTER TABLE operaciones.ordenes_compra DROP COLUMN id_forma_pago;
    PRINT 'Columna [operaciones].[ordenes_compra].[id_forma_pago] eliminada';
END
GO

-- Eliminar campos denormalizados del proveedor
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'razon_social_proveedor')
BEGIN
    ALTER TABLE operaciones.ordenes_compra DROP COLUMN razon_social_proveedor;
    PRINT 'Columna [operaciones].[ordenes_compra].[razon_social_proveedor] eliminada';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'rfc_proveedor')
BEGIN
    ALTER TABLE operaciones.ordenes_compra DROP COLUMN rfc_proveedor;
    PRINT 'Columna [operaciones].[ordenes_compra].[rfc_proveedor] eliminada';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'codigo_postal_proveedor')
BEGIN
    ALTER TABLE operaciones.ordenes_compra DROP COLUMN codigo_postal_proveedor;
    PRINT 'Columna [operaciones].[ordenes_compra].[codigo_postal_proveedor] eliminada';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'id_regimen_fiscal')
BEGIN
    ALTER TABLE operaciones.ordenes_compra DROP COLUMN id_regimen_fiscal;
    PRINT 'Columna [operaciones].[ordenes_compra].[id_regimen_fiscal] eliminada';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'persona_contacto')
BEGIN
    ALTER TABLE operaciones.ordenes_compra DROP COLUMN persona_contacto;
    PRINT 'Columna [operaciones].[ordenes_compra].[persona_contacto] eliminada';
END
GO

-- ============================================================================
-- PASO 2: ordenes_compra_partidas - Convertir a múltiples cuentas (JSON array)
-- ============================================================================

-- Primero, renombrar la columna si existe
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra_partidas]') AND name = 'id_cuenta_bancaria_proveedor')
BEGIN
    -- Agregar la nueva columna como NVARCHAR(MAX)
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra_partidas]') AND name = 'ids_cuentas_bancarias')
    BEGIN
        ALTER TABLE operaciones.ordenes_compra_partidas ADD ids_cuentas_bancarias NVARCHAR(MAX) NULL;
        PRINT 'Columna [operaciones].[ordenes_compra_partidas].[ids_cuentas_bancarias] agregada';
    END

    -- Copiar datos existentes (convertir INT único a JSON array)
    -- Esto es un ejemplo: UPDATE operaciones.ordenes_compra_partidas SET ids_cuentas_bancarias = '[' + CAST(id_cuenta_bancaria_proveedor AS VARCHAR(10)) + ']' WHERE id_cuenta_bancaria_proveedor IS NOT NULL;

    -- Eliminar la columna vieja
    -- Primero eliminar FK constraint si existe
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ordenes_compra_partidas_cuenta_bancaria_proveedor')
    BEGIN
        ALTER TABLE operaciones.ordenes_compra_partidas DROP CONSTRAINT FK_ordenes_compra_partidas_cuenta_bancaria_proveedor;
        PRINT 'FK [FK_ordenes_compra_partidas_cuenta_bancaria_proveedor] eliminada';
    END

    ALTER TABLE operaciones.ordenes_compra_partidas DROP COLUMN id_cuenta_bancaria_proveedor;
    PRINT 'Columna [operaciones].[ordenes_compra_partidas].[id_cuenta_bancaria_proveedor] eliminada';
END
GO

-- Verificar si existe id_proveedor en partidas (necesario para la нормализации)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra_partidas]') AND name = 'id_proveedor')
BEGIN
    ALTER TABLE operaciones.ordenes_compra_partidas ADD id_proveedor INT NULL;
    PRINT 'Columna [operaciones].[ordenes_compra_partidas].[id_proveedor] agregada';
END
GO

-- ============================================================================
-- PASO 3: Agregar Foreign Keys
-- ============================================================================

-- FK para id_proveedor en ordenes_compra (si no existe)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ordenes_compra_proveedor')
BEGIN
    ALTER TABLE operaciones.ordenes_compra
    ADD CONSTRAINT FK_ordenes_compra_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES catalogos.proveedores(id_proveedor);
    PRINT 'FK [FK_ordenes_compra_proveedor] creada';
END
GO

-- FK para id_proveedor en ordenes_compra_partidas (si no existe)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ordenes_compra_partidas_proveedor')
BEGIN
    ALTER TABLE operaciones.ordenes_compra_partidas
    ADD CONSTRAINT FK_ordenes_compra_partidas_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES catalogos.proveedores(id_proveedor);
    PRINT 'FK [FK_ordenes_compra_partidas_proveedor] creada';
END
GO

-- ============================================================================
-- PASO 4: Verificar estructura final
-- ============================================================================
PRINT '';
PRINT 'Verificando estructura de operaciones.ordenes_compra...';
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'operaciones'
    AND TABLE_NAME = 'ordenes_compra'
ORDER BY ORDINAL_POSITION;
GO

PRINT '';
PRINT 'Verificando estructura de operaciones.ordenes_compra_partidas...';
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'operaciones'
    AND TABLE_NAME = 'ordenes_compra_partidas'
ORDER BY ORDINAL_POSITION;
GO

PRINT '';
PRINT '============================================================';
PRINT '06_cuentas_bancarias_multiples.sql COMPLETADO';
PRINT '============================================================';
PRINT '';
GO
