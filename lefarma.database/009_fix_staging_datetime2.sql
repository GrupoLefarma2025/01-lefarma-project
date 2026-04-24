-- ================================================================
-- Script 009: Fix staging tables - cambiar DATETIME a DATETIME2
-- ================================================================
-- Fecha: 2026-04-21
-- Problema: EF Core usa DateTime.UtcNow que es datetime2 (0001-9999)
--           pero las columnas staging son DATETIME (1753-9999)
--           SQL Server rechaza la inserccion por conversion overflow
-- ================================================================

USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'INICIANDO 009_fix_staging_datetime2.sql';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- staging.proveedores
-- ============================================================================

-- 1. Drop default constraint on fecha_registro
DECLARE @df_registro NVARCHAR(256);
SELECT @df_registro = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('staging.proveedores') AND c.name = 'fecha_registro';
IF @df_registro IS NOT NULL
BEGIN
    EXEC('ALTER TABLE staging.proveedores DROP CONSTRAINT ' + @df_registro);
    PRINT 'Dropped constraint: ' + @df_registro;
END
GO

-- 2. Drop default constraint on fecha_modificacion
DECLARE @df_modif NVARCHAR(256);
SELECT @df_modif = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('staging.proveedores') AND c.name = 'fecha_modificacion';
IF @df_modif IS NOT NULL
BEGIN
    EXEC('ALTER TABLE staging.proveedores DROP CONSTRAINT ' + @df_modif);
    PRINT 'Dropped constraint: ' + @df_modif;
END
GO

-- 3. Drop default constraint on fecha_staging
DECLARE @df_staging NVARCHAR(256);
SELECT @df_staging = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('staging.proveedores') AND c.name = 'fecha_staging';
IF @df_staging IS NOT NULL
BEGIN
    EXEC('ALTER TABLE staging.proveedores DROP CONSTRAINT ' + @df_staging);
    PRINT 'Dropped constraint: ' + @df_staging;
END
GO

-- 4. Drop index on fecha_staging
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StagingProveedores_FechaStaging' AND object_id = OBJECT_ID('staging.proveedores'))
BEGIN
    DROP INDEX IX_StagingProveedores_FechaStaging ON staging.proveedores;
    PRINT 'Dropped index: IX_StagingProveedores_FechaStaging';
END
GO

-- 5. Alter columns
ALTER TABLE staging.proveedores ALTER COLUMN fecha_registro DATETIME2 NOT NULL;
PRINT 'staging.proveedores.fecha_registro -> DATETIME2';
GO

ALTER TABLE staging.proveedores ALTER COLUMN fecha_modificacion DATETIME2 NULL;
PRINT 'staging.proveedores.fecha_modificacion -> DATETIME2';
GO

ALTER TABLE staging.proveedores ALTER COLUMN fecha_staging DATETIME2 NOT NULL;
PRINT 'staging.proveedores.fecha_staging -> DATETIME2';
GO

-- 6. Re-add defaults
ALTER TABLE staging.proveedores ADD DEFAULT SYSUTCDATETIME() FOR fecha_registro;
ALTER TABLE staging.proveedores ADD DEFAULT SYSUTCDATETIME() FOR fecha_modificacion;
ALTER TABLE staging.proveedores ADD DEFAULT SYSUTCDATETIME() FOR fecha_staging;
PRINT 'Re-added default constraints';
GO

-- 7. Re-add index
CREATE INDEX IX_StagingProveedores_FechaStaging ON staging.proveedores(fecha_staging);
PRINT 'Re-created index: IX_StagingProveedores_FechaStaging';
GO

-- ============================================================================
-- staging.proveedores_detalles
-- ============================================================================

-- 1. Drop default constraint on fecha_creacion
DECLARE @df_det_crea NVARCHAR(256);
SELECT @df_det_crea = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('staging.proveedores_detalles') AND c.name = 'fecha_creacion';
IF @df_det_crea IS NOT NULL
BEGIN
    EXEC('ALTER TABLE staging.proveedores_detalles DROP CONSTRAINT ' + @df_det_crea);
    PRINT 'Dropped constraint: ' + @df_det_crea;
END
GO

-- 2. Drop default constraint on fecha_modificacion
DECLARE @df_det_modif NVARCHAR(256);
SELECT @df_det_modif = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('staging.proveedores_detalles') AND c.name = 'fecha_modificacion';
IF @df_det_modif IS NOT NULL
BEGIN
    EXEC('ALTER TABLE staging.proveedores_detalles DROP CONSTRAINT ' + @df_det_modif);
    PRINT 'Dropped constraint: ' + @df_det_modif;
END
GO

-- 3. Alter columns
ALTER TABLE staging.proveedores_detalles ALTER COLUMN fecha_creacion DATETIME2 NOT NULL;
PRINT 'staging.proveedores_detalles.fecha_creacion -> DATETIME2';
GO

ALTER TABLE staging.proveedores_detalles ALTER COLUMN fecha_modificacion DATETIME2 NULL;
PRINT 'staging.proveedores_detalles.fecha_modificacion -> DATETIME2';
GO

-- 4. Re-add defaults
ALTER TABLE staging.proveedores_detalles ADD DEFAULT SYSUTCDATETIME() FOR fecha_creacion;
ALTER TABLE staging.proveedores_detalles ADD DEFAULT SYSUTCDATETIME() FOR fecha_modificacion;
PRINT 'Re-added default constraints for detalles';
GO

PRINT '';
PRINT '============================================================';
PRINT '009_fix_staging_datetime2.sql COMPLETADO';
PRINT '============================================================';
PRINT '';
GO
