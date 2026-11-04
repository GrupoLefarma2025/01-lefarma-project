-- =============================================================================
-- 0038 - Ejecutivo suplente y retiro de vigencia en ejecutivo_region
-- =============================================================================
-- ADR-00015 / decisión 2026-10-23:
--   - La elegibilidad del ejecutivo se controla con [activo], no con fechas.
--     Un ejecutivo puede renunciar en cualquier momento; el histórico operativo
--     queda en selecciones/rutas/talleres y en las columnas de auditoría.
--   - Se agrega [ejecutivo_suplente] para usuarios que pueden cubrir como
--     ejecutivo de ventas cuando una región no tiene ejecutivo primario.
--     id_tipo_gerencia NULL = todas las gerencias.
--     id_region_catalogo NULL = todas las regiones.
--     El suplente nunca es la primera sugerencia: el motor busca primero un
--     ejecutivo_region activo de la región/gerencia.
--
-- IDEMPOTENTE. No ejecutar sin revisión del usuario.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRANSACTION;

-- -----------------------------------------------------------------------------
-- 1. ejecutivo_region: retirar vigencia
-- -----------------------------------------------------------------------------
IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('educacion_medica.[ejecutivo_region]')
      AND name = 'CK_ejecutivo_region_vigencia'
)
BEGIN
    ALTER TABLE educacion_medica.[ejecutivo_region]
        DROP CONSTRAINT [CK_ejecutivo_region_vigencia];
    PRINT 'Constraint [CK_ejecutivo_region_vigencia] eliminada.';
END
ELSE
    PRINT 'Constraint [CK_ejecutivo_region_vigencia] no existe. Skip.';

IF EXISTS (
    SELECT 1
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('educacion_medica.[ejecutivo_region]')
      AND name = 'DF_ejecutivo_region_fecha_inicio'
)
BEGIN
    ALTER TABLE educacion_medica.[ejecutivo_region]
        DROP CONSTRAINT [DF_ejecutivo_region_fecha_inicio];
    PRINT 'Default [DF_ejecutivo_region_fecha_inicio] eliminado.';
END

IF COL_LENGTH('educacion_medica.ejecutivo_region', 'fecha_fin') IS NOT NULL
BEGIN
    ALTER TABLE educacion_medica.[ejecutivo_region] DROP COLUMN [fecha_fin];
    PRINT 'Columna [ejecutivo_region].[fecha_fin] eliminada.';
END
ELSE
    PRINT 'Columna [ejecutivo_region].[fecha_fin] no existe. Skip.';

IF COL_LENGTH('educacion_medica.ejecutivo_region', 'fecha_inicio') IS NOT NULL
BEGIN
    ALTER TABLE educacion_medica.[ejecutivo_region] DROP COLUMN [fecha_inicio];
    PRINT 'Columna [ejecutivo_region].[fecha_inicio] eliminada.';
END
ELSE
    PRINT 'Columna [ejecutivo_region].[fecha_inicio] no existe. Skip.';

-- -----------------------------------------------------------------------------
-- 2. ejecutivo_suplente
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'ejecutivo_suplente')
BEGIN
    CREATE TABLE educacion_medica.[ejecutivo_suplente] (
        [id_ejecutivo_suplente] int IDENTITY(1,1) NOT NULL,
        [id_usuario] int NOT NULL,
        [id_tipo_gerencia] int NULL,
        [id_region_catalogo] int NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_ejecutivo_suplente_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_ejecutivo_suplente_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_ejecutivo_suplente_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_ejecutivo_suplente] PRIMARY KEY ([id_ejecutivo_suplente]),
        CONSTRAINT [FK_ejecutivo_suplente_tipo_gerencia] FOREIGN KEY ([id_tipo_gerencia]) REFERENCES educacion_medica.[tipo_gerencia] ([id_tipo_gerencia]),
        CONSTRAINT [FK_ejecutivo_suplente_region_catalogo] FOREIGN KEY ([id_region_catalogo]) REFERENCES educacion_medica.[regiones_cat] ([id_region])
    );
    PRINT 'Tabla [ejecutivo_suplente] creada.';
END
ELSE
    PRINT 'Tabla [ejecutivo_suplente] ya existe. Skip.';

-- Los índices y descripciones van en EXEC para que SQL Server no compile
-- referencias a la tabla nueva dentro del mismo batch.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND name = 'UX_ejecutivo_suplente_usuario_gerencia_region_activo')
    EXEC(N'CREATE UNIQUE INDEX [UX_ejecutivo_suplente_usuario_gerencia_region_activo]
        ON educacion_medica.[ejecutivo_suplente] ([id_usuario], [id_tipo_gerencia], [id_region_catalogo])
        WHERE ([activo] = (1));');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND name = 'IX_ejecutivo_suplente_usuario')
    EXEC(N'CREATE INDEX [IX_ejecutivo_suplente_usuario] ON educacion_medica.[ejecutivo_suplente] ([id_usuario]);');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND name = 'IX_ejecutivo_suplente_gerencia')
    EXEC(N'CREATE INDEX [IX_ejecutivo_suplente_gerencia] ON educacion_medica.[ejecutivo_suplente] ([id_tipo_gerencia]);');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND name = 'IX_ejecutivo_suplente_region')
    EXEC(N'CREATE INDEX [IX_ejecutivo_suplente_region] ON educacion_medica.[ejecutivo_suplente] ([id_region_catalogo]);');

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuarios que pueden cubrir como ejecutivo de ventas cuando una región no tiene ejecutivo primario (ADR-00015). El motor busca primero ejecutivo_region activo y solo usa suplentes si no hay primario. NULL en gerencia/región = cobertura total.', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_suplente';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[ejecutivo_suplente]'), 'id_usuario', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario suplente (FK lógica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_suplente', 'COLUMN', N'id_usuario';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[ejecutivo_suplente]'), 'id_tipo_gerencia', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Gerencia que puede cubrir (NULL = todas)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_suplente', 'COLUMN', N'id_tipo_gerencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[ejecutivo_suplente]'), 'id_region_catalogo', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Región que puede cubrir (NULL = todas)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_suplente', 'COLUMN', N'id_region_catalogo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[ejecutivo_suplente]'), 'activo', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'1 = suplente disponible; 0 = inactivo', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_suplente', 'COLUMN', N'activo';

COMMIT TRANSACTION;

PRINT '0038 aplicado correctamente.';
