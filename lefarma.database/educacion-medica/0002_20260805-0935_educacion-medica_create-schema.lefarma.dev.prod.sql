-- ============================================================
-- 0002_20260805-0935_educacion-medica_create-schema.lefarma.sql
-- Descripción: Crea el schema educacion_medica.
--              Script de prueba del pipeline DbUp. Las 11 tablas
--              operacionales se agregarán en scripts posteriores
--              cuando se construya la app Educación Médica.
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (toda la familia lefarma)
-- ============================================================
-- Convencion de documentacion (extended properties):
--   Cada tabla, columna y el schema quedan documentados con extended
--   properties MS_Description. Los bloques son idempotentes (guard
--   IF NOT EXISTS sobre sys.extended_properties), por lo que no rompen
--   el pipeline DbUp ni la re-ejecucion.
--   Consulta rapida (tablas y columnas, class = 1):
--     SELECT OBJECT_SCHEMA_NAME(ep.major_id) AS [schema],
--            OBJECT_NAME(ep.major_id) AS [tabla],
--            c.name AS [columna],
--            ep.value AS [descripcion]
--     FROM sys.extended_properties ep
--     LEFT JOIN sys.columns c
--         ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
--     WHERE ep.name = 'MS_Description'
--     ORDER BY [schema], [tabla], [columna];
--   Las entradas a nivel schema usan class = 3 (major_id = SCHEMA_ID).
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

-- ============================================================
-- Documentacion del schema (extended property MS_Description).
-- Idempotente: no rompe el pipeline DbUp ni la re-ejecucion.
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = SCHEMA_ID('educacion_medica') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Modulo de Educacion Medica: talleres medicos en hospitales (proceso ASK-CEM-DDP-001), programas anuales, selecciones mensuales y formularios FOR-002..FOR-008.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica';
GO
