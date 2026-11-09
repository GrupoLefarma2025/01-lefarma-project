-- =============================================================================
-- 0012 — Relación cotización ↔ visitas de Educación Médica (tabla liga)
--
-- ADR: lefarma.docs/educacion-medica/decisiones/00014_cotizaciones-por-ruta-viaticos.md
--
-- QUÉ HACE (idempotente, transacción única)
--   1) Crea viaticos.solicitud_origen_em_visita: una fila por visita cotizada.
--      Permite que una ruta tenga VARIAS cotizaciones (subconjuntos distintos)
--      y saber qué hospitales cubre cada una.
--   2) Índices para consultar por ruta/visita y por solicitud.
--   3) MS_Description de tabla y columnas.
--
-- QUÉ NO HACE (decisión del usuario 2026-10-22: no tocar la BD)
--   - No agrega columnas a educacion_medica.rutas ni a rutas_visitas.
--   - No hace backfill de cotizaciones existentes (los borradores legados
--     14/15 quedan intactos y sin liga).
--   - No borra ni modifica solicitudes, opciones ni datos_json.
--
-- RELACIÓN
--   - id_solicitud: FK física a viaticos.solicitudes (misma base).
--   - id_ruta / id_ruta_visita: referencias LÓGICAS a educacion_medica
--     (sin FK física, para no acoplar el despliegue de los dos módulos).
--   - Una solicitud puede tener N filas (una por visita); una visita puede
--     estar en una sola cotización; el bloqueo de visitas activas se valida
--     en el servicio (el estado vive en viaticos.solicitudes).
--
-- CÓMO USAR
--   1) Revisar y aprobar (este script NO se aplica solo).
--   2) Ejecutar en LefarmaDev2 y en Lefarma/prod.
--   3) Validar con PARSEONLY antes de aplicar.
--
-- IDEMPOTENTE: re-ejecutable (guardas IF NOT EXISTS).
--
-- NOTA DE EJECUCIÓN: UTF-8 (sqlcmd -f 65001) por los acentos.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1. Tabla liga
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1
        FROM sys.tables
        WHERE schema_id = SCHEMA_ID('viaticos')
          AND name = 'solicitud_origen_em_visita')
    BEGIN
        CREATE TABLE viaticos.[solicitud_origen_em_visita] (
            [id_solicitud]         int NOT NULL,
            [id_ruta]              int NOT NULL,
            [id_ruta_visita]       int NOT NULL,
            [id_seleccion_mensual] int NULL,
            [fecha_creacion]       datetime2(7) NOT NULL
                CONSTRAINT [DF_solicitud_origen_em_visita_fecha_creacion] DEFAULT (sysutcdatetime()),
            CONSTRAINT [PK_solicitud_origen_em_visita]
                PRIMARY KEY ([id_solicitud], [id_ruta_visita]),
            CONSTRAINT [FK_solicitud_origen_em_visita_solicitud]
                FOREIGN KEY ([id_solicitud])
                REFERENCES viaticos.[solicitudes] ([id_solicitud])
                ON DELETE CASCADE
        );
        PRINT 'Tabla [viaticos].[solicitud_origen_em_visita] creada.';
    END
    ELSE
        PRINT 'Tabla [viaticos].[solicitud_origen_em_visita] ya existe. Skip.';

    -- =========================================================================
    -- 2. Índices
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('viaticos.solicitud_origen_em_visita')
          AND name = 'IX_solicitud_origen_em_visita_ruta')
    BEGIN
        CREATE INDEX [IX_solicitud_origen_em_visita_ruta]
            ON viaticos.[solicitud_origen_em_visita] ([id_ruta], [id_ruta_visita])
            INCLUDE ([id_solicitud], [id_seleccion_mensual]);
        PRINT 'Indice [IX_solicitud_origen_em_visita_ruta] creado.';
    END
    ELSE
        PRINT 'Indice [IX_solicitud_origen_em_visita_ruta] ya existe. Skip.';

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('viaticos.solicitud_origen_em_visita')
          AND name = 'IX_solicitud_origen_em_visita_solicitud')
    BEGIN
        CREATE INDEX [IX_solicitud_origen_em_visita_solicitud]
            ON viaticos.[solicitud_origen_em_visita] ([id_solicitud])
            INCLUDE ([id_ruta], [id_ruta_visita]);
        PRINT 'Indice [IX_solicitud_origen_em_visita_solicitud] creado.';
    END
    ELSE
        PRINT 'Indice [IX_solicitud_origen_em_visita_solicitud] ya existe. Skip.';

    -- =========================================================================
    -- 3. MS_Description
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('viaticos.[solicitud_origen_em_visita]')
          AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'Visitas de Educacion Medica cubiertas por una cotizacion de viaticos (1 fila por visita).',
        'SCHEMA', N'viaticos', 'TABLE', N'solicitud_origen_em_visita';

    IF NOT EXISTS (
        SELECT 1 FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('viaticos.[solicitud_origen_em_visita]')
          AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'Solicitud de viaticos (FK viaticos.solicitudes)',
        'SCHEMA', N'viaticos', 'TABLE', N'solicitud_origen_em_visita', 'COLUMN', N'id_solicitud';

    IF NOT EXISTS (
        SELECT 1 FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('viaticos.[solicitud_origen_em_visita]')
          AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'Ruta de Educacion Medica (referencia logica a educacion_medica.rutas)',
        'SCHEMA', N'viaticos', 'TABLE', N'solicitud_origen_em_visita', 'COLUMN', N'id_ruta';

    IF NOT EXISTS (
        SELECT 1 FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('viaticos.[solicitud_origen_em_visita]')
          AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'Visita de la ruta (referencia logica a educacion_medica.rutas_visitas)',
        'SCHEMA', N'viaticos', 'TABLE', N'solicitud_origen_em_visita', 'COLUMN', N'id_ruta_visita';

    IF NOT EXISTS (
        SELECT 1 FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('viaticos.[solicitud_origen_em_visita]')
          AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'Seleccion mensual de la ruta (contexto)',
        'SCHEMA', N'viaticos', 'TABLE', N'solicitud_origen_em_visita', 'COLUMN', N'id_seleccion_mensual';

    IF NOT EXISTS (
        SELECT 1 FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('viaticos.[solicitud_origen_em_visita]')
          AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'Fecha de creacion del registro (UTC)',
        'SCHEMA', N'viaticos', 'TABLE', N'solicitud_origen_em_visita', 'COLUMN', N'fecha_creacion';

    COMMIT TRANSACTION;
    PRINT '0012 completado: tabla liga solicitud_origen_em_visita creada.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0012: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
