-- ============================================================
-- 9999_20260903-1300_educacion-medica_drop-schema-reset.lefarma.sql
-- Descripcion: UTILIDAD DE DESARROLLO. Elimina TODO el schema
--   educacion_medica (vistas, FKs y tablas) sin depender del orden,
--   para recrear la base desde cero con los scripts 0002 a 0010.
--   El orden de borrado es irrelevante porque primero se quitan todas
--   las restricciones FOREIGN KEY del schema y luego todas las tablas.
--   NO ejecutar en produccion: borra todo el modulo.
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev (desarrollo).
-- ============================================================

SET NOCOUNT ON;

DECLARE @sql NVARCHAR(MAX);

-- 1) Quitar todas las vistas del schema
SET @sql = N'';
SELECT @sql = @sql + N'DROP VIEW ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';' + CHAR(13)
FROM sys.views
WHERE schema_id = SCHEMA_ID('educacion_medica');
IF @sql <> N'' EXEC sp_executesql @sql;
PRINT 'Vistas eliminadas.';

-- 2) Quitar todas las FKs del schema (deja las tablas sin referencias)
SET @sql = N'';
SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name)
    + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';' + CHAR(13)
FROM sys.foreign_keys fk
JOIN sys.tables t ON fk.parent_object_id = t.object_id
WHERE t.schema_id = SCHEMA_ID('educacion_medica');
IF @sql <> N'' EXEC sp_executesql @sql;
PRINT 'FKs eliminadas.';

-- 3) Quitar todas las tablas del schema
SET @sql = N'';
SELECT @sql = @sql + N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';' + CHAR(13)
FROM sys.tables
WHERE schema_id = SCHEMA_ID('educacion_medica');
IF @sql <> N'' EXEC sp_executesql @sql;
PRINT 'Tablas eliminadas.';

-- 4) Quitar el schema
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'educacion_medica')
BEGIN
    DROP SCHEMA educacion_medica;
    PRINT 'Schema [educacion_medica] eliminado. Listo para recrear con 0002-0010.';
END
ELSE
    PRINT 'Schema [educacion_medica] no existe. Nada que eliminar.';
GO
