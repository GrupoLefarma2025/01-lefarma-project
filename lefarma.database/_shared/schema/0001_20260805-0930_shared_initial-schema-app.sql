-- ============================================================
-- 0001_20260805-0930_shared_initial-schema-app.sql
-- Descripción: Crea el schema `app` si no existe. Necesario antes
--              de que DbUp pueda crear `app.SchemaVersions` en
--              DBs donde no exista (Asistencias, Asokam en prod).
-- App: _shared
-- Tipo: schema
-- Target: *  (todas las DBs del ambiente)
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'app')
BEGIN
    EXEC('CREATE SCHEMA app');
    PRINT 'Schema [app] creado.';
END
ELSE
BEGIN
    PRINT 'Schema [app] ya existe. Skip.';
END
GO

-- Nota: la tabla app.SchemaVersions la crea DbUp automáticamente
-- en su primera corrida. No la creamos aquí para no duplicar.
