-- ============================================================
-- 0002_20260805-0935_educacion-medica_create-schema.lefarma.sql
-- Descripción: Crea el schema educacion_medica.
--              Script de prueba del pipeline DbUp. Las 11 tablas
--              operacionales se agregarán en scripts posteriores
--              cuando se construya la app Educación Médica.
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (toda la familia lefarma)
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'educacion_medica')
BEGIN
    EXEC('CREATE SCHEMA educacion_medica');
    PRINT 'Schema [educacion_medica] creado.';
END
ELSE
BEGIN
    PRINT 'Schema [educacion_medica] ya existe. Skip.';
END
GO
