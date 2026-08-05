-- 010_cuentas_contables_empresa_id.sql
-- Reemplaza columna empresa_prefijo VARCHAR(20) por empresa_id INT con FK a catalogos.empresas
-- Ejecutar DESPUES de 000_create_tables.sql

SET NOCOUNT ON;
PRINT '============================================================';
PRINT '010: Reemplazando empresa_prefijo por empresa_id';
PRINT '============================================================';
PRINT '';

-- Paso 1: Agregar columna empresa_id
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[catalogos].[cuentas_contables]')
      AND name = 'empresa_id'
)
BEGIN
    ALTER TABLE catalogos.cuentas_contables ADD empresa_id INT NULL;
    PRINT 'Columna [empresa_id] agregada.';
END
ELSE
BEGIN
    PRINT 'Columna [empresa_id] ya existe.';
END
GO

-- Paso 2: Agregar FK
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_CuentasContables_Empresas'
)
BEGIN
    ALTER TABLE catalogos.cuentas_contables
    ADD CONSTRAINT FK_CuentasContables_Empresas
    FOREIGN KEY (empresa_id)
    REFERENCES catalogos.empresas(id_empresa)
    ON DELETE NO ACTION;
    PRINT 'FK [FK_CuentasContables_Empresas] creada.';
END
ELSE
BEGIN
    PRINT 'FK [FK_CuentasContables_Empresas] ya existe.';
END
GO

-- Paso 3: Copiar datos existentes de empresa_prefijo a empresa_id
-- Se hace en un UPDATE por separado para evitar bloqueos
UPDATE cc
SET cc.empresa_id = e.id_empresa
FROM catalogos.cuentas_contables cc
INNER JOIN catalogos.empresas e
    ON e.clave = cc.empresa_prefijo
WHERE cc.empresa_prefijo IS NOT NULL
  AND cc.empresa_prefijo <> '';
PRINT 'Datos migrados de empresa_prefijo -> empresa_id.';
GO

-- Paso 4: Eliminar columna empresa_prefijo (una vez migrados los datos)
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[catalogos].[cuentas_contables]')
      AND name = 'empresa_prefijo'
)
BEGIN
    -- Verificar que no haya datos pendientes
    IF NOT EXISTS (
        SELECT 1 FROM catalogos.cuentas_contables
        WHERE empresa_prefijo IS NOT NULL AND empresa_prefijo <> ''
    )
    BEGIN
        ALTER TABLE catalogos.cuentas_contables DROP COLUMN empresa_prefijo;
        PRINT 'Columna [empresa_prefijo] eliminada.';
    END
    ELSE
    BEGIN
        PRINT 'ADVERTENCIA: Existen datos en empresa_prefijo que no se pudieron migrar. No se eliminara la columna.';
    END
END
ELSE
BEGIN
    PRINT 'Columna [empresa_prefijo] no existe (ya fue eliminada previamente).';
END
GO

-- Paso 5: Crear indice
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_CuentasContables_EmpresaId'
      AND object_id = OBJECT_ID('[catalogos].[cuentas_contables]')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_CuentasContables_EmpresaId
    ON catalogos.cuentas_contables(empresa_id);
    PRINT 'Indice [IX_CuentasContables_EmpresaId] creado.';
END
ELSE
BEGIN
    PRINT 'Indice [IX_CuentasContables_EmpresaId] ya existe.';
END
GO

PRINT '';
PRINT 'Migration 010 completada.';
GO
