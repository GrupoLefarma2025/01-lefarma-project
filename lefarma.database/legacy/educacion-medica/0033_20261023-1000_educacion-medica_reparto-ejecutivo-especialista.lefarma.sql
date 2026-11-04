-- =============================================================================
-- 0033 — Reparto por ejecutivo y rutas por especialista (ADR-00015)
--
-- QUÉ HACE
--   Migra el modelo de equipos de pareo EV+EP al modelo de dos capas:
--     - la selección asigna regiones/hospitales a un EJECUTIVO;
--     - la ruta se organiza por ESPECIALISTA;
--     - cada visita lleva ejecutivo (dueño) y especialista (imparte).
--
--   Crea los catálogos de personas:
--     ejecutivo_region, especialista_gerencia, especialista_region.
--
--   Agrega columnas:
--     selecciones_regiones.id_ejecutivo / id_especialista
--     selecciones_mensuales_hospitales.id_ejecutivo / id_especialista
--     rutas.id_especialista  (id_equipo pasa a NULL, legacy)
--     rutas_visitas.id_ejecutivo / id_especialista
--     talleres.id_ruta_visita
--     matrices_individuales.id_ejecutivo (id_equipo pasa a NULL, legacy)
--
--   No hace backfill (decisión 2026-10-23): los datos operativos se limpian
--   con 0037 y se empieza desde cero. equipos_pareo queda como histórica.
--
--   NO aplica el script solo: lo revisa y ejecuta el usuario.
--   Para instalación limpia, 0016 ya incluye estos cambios.
--
-- REQUISITOS
--   - 0016 (esquema completo) aplicado.
--   - `regiones_cat` y `tipo_gerencia` existen.
--
-- IDEMPOTENTE: guards por tabla/columna/índice/constraint.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;   -- requerido por índices filtrados
SET ANSI_NULLS ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'educacion_medica')
BEGIN
    RAISERROR('Falta el esquema educacion_medica. Ejecute 0016 primero.', 16, 1);
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1) Catálogos de personas (ADR-00015)
    -- =========================================================================

    -- -------------------------------------------------------------------------
    -- ejecutivo_region: región(es) del ejecutivo; de aquí se deriva su gerencia
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'ejecutivo_region')
    BEGIN
        CREATE TABLE educacion_medica.[ejecutivo_region] (
            [id_ejecutivo_region] int IDENTITY(1,1) NOT NULL,
            [id_usuario] int NOT NULL,
            [id_region_catalogo] int NOT NULL,
            [fecha_inicio] date NOT NULL CONSTRAINT [DF_ejecutivo_region_fecha_inicio] DEFAULT (CONVERT([date],getdate())),
            [fecha_fin] date NULL,
            [activo] bit NOT NULL CONSTRAINT [DF_ejecutivo_region_activo] DEFAULT ((1)),
            [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_ejecutivo_region_fecha_creacion] DEFAULT (sysutcdatetime()),
            [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_ejecutivo_region_fecha_modificacion] DEFAULT (sysutcdatetime()),
            [id_usuario_creacion] int NULL,
            [id_usuario_modificacion] int NULL,
            CONSTRAINT [PK_ejecutivo_region] PRIMARY KEY ([id_ejecutivo_region]),
            CONSTRAINT [FK_ejecutivo_region_region_catalogo] FOREIGN KEY ([id_region_catalogo]) REFERENCES educacion_medica.[regiones_cat] ([id_region])
        );
        PRINT 'Tabla [educacion_medica].[ejecutivo_region] creada.';
    END
    ELSE
        PRINT 'Tabla [educacion_medica].[ejecutivo_region] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND name = 'UX_ejecutivo_region_usuario_region_activo')
        CREATE UNIQUE INDEX [UX_ejecutivo_region_usuario_region_activo]
            ON educacion_medica.[ejecutivo_region] ([id_usuario], [id_region_catalogo])
            WHERE ([activo] = (1));
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND name = 'IX_ejecutivo_region_usuario')
        CREATE INDEX [IX_ejecutivo_region_usuario] ON educacion_medica.[ejecutivo_region] ([id_usuario]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND name = 'IX_ejecutivo_region_region')
        CREATE INDEX [IX_ejecutivo_region_region] ON educacion_medica.[ejecutivo_region] ([id_region_catalogo]);

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND name = 'CK_ejecutivo_region_vigencia')
        EXEC(N'ALTER TABLE educacion_medica.[ejecutivo_region] ADD CONSTRAINT [CK_ejecutivo_region_vigencia]
            CHECK ([fecha_fin] IS NULL OR [fecha_fin] >= [fecha_inicio]);');

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Región(es) asignada(s) a un ejecutivo de ventas (ADR-00015). La gerencia del ejecutivo se deriva de regiones_cat.id_tipo_gerencia; todas sus regiones deben ser de la misma gerencia (validación en servicio).', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_region';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[ejecutivo_region]'), 'id_usuario', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Usuario ejecutivo de ventas (FK lógica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_region', 'COLUMN', N'id_usuario';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[ejecutivo_region]'), 'id_region_catalogo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Región del catálogo (FK física regiones_cat)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_region', 'COLUMN', N'id_region_catalogo';

    -- -------------------------------------------------------------------------
    -- especialista_gerencia: gerencias que puede atender un especialista
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'especialista_gerencia')
    BEGIN
        CREATE TABLE educacion_medica.[especialista_gerencia] (
            [id_especialista_gerencia] int IDENTITY(1,1) NOT NULL,
            [id_usuario] int NOT NULL,
            [id_tipo_gerencia] int NOT NULL,
            [activo] bit NOT NULL CONSTRAINT [DF_especialista_gerencia_activo] DEFAULT ((1)),
            [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_especialista_gerencia_fecha_creacion] DEFAULT (sysutcdatetime()),
            [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_especialista_gerencia_fecha_modificacion] DEFAULT (sysutcdatetime()),
            [id_usuario_creacion] int NULL,
            [id_usuario_modificacion] int NULL,
            CONSTRAINT [PK_especialista_gerencia] PRIMARY KEY ([id_especialista_gerencia]),
            CONSTRAINT [FK_especialista_gerencia_tipo_gerencia] FOREIGN KEY ([id_tipo_gerencia]) REFERENCES educacion_medica.[tipo_gerencia] ([id_tipo_gerencia])
        );
        PRINT 'Tabla [educacion_medica].[especialista_gerencia] creada.';
    END
    ELSE
        PRINT 'Tabla [educacion_medica].[especialista_gerencia] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[especialista_gerencia]') AND name = 'UX_especialista_gerencia_usuario_gerencia_activo')
        CREATE UNIQUE INDEX [UX_especialista_gerencia_usuario_gerencia_activo]
            ON educacion_medica.[especialista_gerencia] ([id_usuario], [id_tipo_gerencia])
            WHERE ([activo] = (1));
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[especialista_gerencia]') AND name = 'IX_especialista_gerencia_usuario')
        CREATE INDEX [IX_especialista_gerencia_usuario] ON educacion_medica.[especialista_gerencia] ([id_usuario]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[especialista_gerencia]') AND name = 'IX_especialista_gerencia_gerencia')
        CREATE INDEX [IX_especialista_gerencia_gerencia] ON educacion_medica.[especialista_gerencia] ([id_tipo_gerencia]);

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[especialista_gerencia]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Gerencias que puede atender un especialista de producto (ADR-00015). La ausencia de filas se interpreta como NO elegible; la pantalla Personas exige al menos una gerencia. El caso 4 especialistas cualquiera + 1 sin IMSS se modela con filas explícitas.', 'SCHEMA', N'educacion_medica', 'TABLE', N'especialista_gerencia';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[especialista_gerencia]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[especialista_gerencia]'), 'id_usuario', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Usuario especialista de producto (FK lógica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'especialista_gerencia', 'COLUMN', N'id_usuario';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[especialista_gerencia]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[especialista_gerencia]'), 'id_tipo_gerencia', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Gerencia permitida (FK física tipo_gerencia: IMSS / IMSS Bienestar / Descentralizado / Privado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'especialista_gerencia', 'COLUMN', N'id_tipo_gerencia';

    -- -------------------------------------------------------------------------
    -- especialista_region: región preferida del especialista (opcional)
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'especialista_region')
    BEGIN
        CREATE TABLE educacion_medica.[especialista_region] (
            [id_especialista_region] int IDENTITY(1,1) NOT NULL,
            [id_usuario] int NOT NULL,
            [id_region_catalogo] int NOT NULL,
            [activo] bit NOT NULL CONSTRAINT [DF_especialista_region_activo] DEFAULT ((1)),
            [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_especialista_region_fecha_creacion] DEFAULT (sysutcdatetime()),
            [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_especialista_region_fecha_modificacion] DEFAULT (sysutcdatetime()),
            [id_usuario_creacion] int NULL,
            [id_usuario_modificacion] int NULL,
            CONSTRAINT [PK_especialista_region] PRIMARY KEY ([id_especialista_region]),
            CONSTRAINT [FK_especialista_region_region_catalogo] FOREIGN KEY ([id_region_catalogo]) REFERENCES educacion_medica.[regiones_cat] ([id_region])
        );
        PRINT 'Tabla [educacion_medica].[especialista_region] creada.';
    END
    ELSE
        PRINT 'Tabla [educacion_medica].[especialista_region] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[especialista_region]') AND name = 'UX_especialista_region_usuario_region_activo')
        CREATE UNIQUE INDEX [UX_especialista_region_usuario_region_activo]
            ON educacion_medica.[especialista_region] ([id_usuario], [id_region_catalogo])
            WHERE ([activo] = (1));
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[especialista_region]') AND name = 'IX_especialista_region_usuario')
        CREATE INDEX [IX_especialista_region_usuario] ON educacion_medica.[especialista_region] ([id_usuario]);

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[especialista_region]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Región preferida del especialista (opcional; ADR-00015). No es una restricción: solo alimenta la sugerencia de visitas cercanas. La elegibilidad real vive en especialista_gerencia.', 'SCHEMA', N'educacion_medica', 'TABLE', N'especialista_region';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[especialista_region]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[especialista_region]'), 'id_usuario', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Usuario especialista de producto (FK lógica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'especialista_region', 'COLUMN', N'id_usuario';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[especialista_region]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[especialista_region]'), 'id_region_catalogo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Región preferida (FK física regiones_cat)', 'SCHEMA', N'educacion_medica', 'TABLE', N'especialista_region', 'COLUMN', N'id_region_catalogo';

    -- =========================================================================
    -- 2) Columnas nuevas en tablas existentes
    -- =========================================================================

    -- selecciones_regiones: dueño de la región = ejecutivo; especialista opcional
    IF COL_LENGTH('educacion_medica.selecciones_regiones', 'id_ejecutivo') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[selecciones_regiones] ADD [id_ejecutivo] int NULL;
        PRINT 'Columna [selecciones_regiones].[id_ejecutivo] agregada.';
    END
    ELSE
        PRINT 'Columna [selecciones_regiones].[id_ejecutivo] ya existe. Skip.';

    IF COL_LENGTH('educacion_medica.selecciones_regiones', 'id_especialista') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[selecciones_regiones] ADD [id_especialista] int NULL;
        PRINT 'Columna [selecciones_regiones].[id_especialista] agregada.';
    END
    ELSE
        PRINT 'Columna [selecciones_regiones].[id_especialista] ya existe. Skip.';

    -- selecciones_mensuales_hospitales: override por hospital + sugerencia opcional
    IF COL_LENGTH('educacion_medica.selecciones_mensuales_hospitales', 'id_ejecutivo') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[selecciones_mensuales_hospitales] ADD [id_ejecutivo] int NULL;
        PRINT 'Columna [selecciones_mensuales_hospitales].[id_ejecutivo] agregada.';
    END
    ELSE
        PRINT 'Columna [selecciones_mensuales_hospitales].[id_ejecutivo] ya existe. Skip.';

    IF COL_LENGTH('educacion_medica.selecciones_mensuales_hospitales', 'id_especialista') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[selecciones_mensuales_hospitales] ADD [id_especialista] int NULL;
        PRINT 'Columna [selecciones_mensuales_hospitales].[id_especialista] agregada.';
    END
    ELSE
        PRINT 'Columna [selecciones_mensuales_hospitales].[id_especialista] ya existe. Skip.';

    -- rutas: la ruta es por especialista; id_equipo queda legacy y nullable
    IF COL_LENGTH('educacion_medica.rutas', 'id_especialista') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[rutas] ADD [id_especialista] int NULL;
        PRINT 'Columna [rutas].[id_especialista] agregada.';
    END
    ELSE
        PRINT 'Columna [rutas].[id_especialista] ya existe. Skip.';

    IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('educacion_medica.[rutas]')
          AND name = 'id_equipo'
          AND is_nullable = 0
    )
    BEGIN
        ALTER TABLE educacion_medica.[rutas] ALTER COLUMN [id_equipo] int NULL;
        PRINT 'Columna [rutas].[id_equipo] ahora NULL (legacy ADR-00015).';
    END
    ELSE
        PRINT 'Columna [rutas].[id_equipo] ya es NULL. Skip.';

    -- rutas_visitas: dueño (ejecutivo) + ejecutor (especialista)
    IF COL_LENGTH('educacion_medica.rutas_visitas', 'id_ejecutivo') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[rutas_visitas] ADD [id_ejecutivo] int NULL;
        PRINT 'Columna [rutas_visitas].[id_ejecutivo] agregada.';
    END
    ELSE
        PRINT 'Columna [rutas_visitas].[id_ejecutivo] ya existe. Skip.';

    IF COL_LENGTH('educacion_medica.rutas_visitas', 'id_especialista') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[rutas_visitas] ADD [id_especialista] int NULL;
        PRINT 'Columna [rutas_visitas].[id_especialista] agregada.';
    END
    ELSE
        PRINT 'Columna [rutas_visitas].[id_especialista] ya existe. Skip.';

    -- talleres: enlace con la visita planificada
    IF COL_LENGTH('educacion_medica.talleres', 'id_ruta_visita') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[talleres] ADD [id_ruta_visita] int NULL;
        PRINT 'Columna [talleres].[id_ruta_visita] agregada.';
    END
    ELSE
        PRINT 'Columna [talleres].[id_ruta_visita] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_talleres_ruta_visita')
    BEGIN
        EXEC(N'ALTER TABLE educacion_medica.[talleres] ADD CONSTRAINT [FK_talleres_ruta_visita]
            FOREIGN KEY ([id_ruta_visita]) REFERENCES educacion_medica.[rutas_visitas] ([id_ruta_visita]);');
        PRINT 'FK [FK_talleres_ruta_visita] creada.';
    END
    ELSE
        PRINT 'FK [FK_talleres_ruta_visita] ya existe. Skip.';

    -- matrices_individuales: la captura individual es por ejecutivo
    IF COL_LENGTH('educacion_medica.matrices_individuales', 'id_ejecutivo') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[matrices_individuales] ADD [id_ejecutivo] int NULL;
        PRINT 'Columna [matrices_individuales].[id_ejecutivo] agregada.';
    END
    ELSE
        PRINT 'Columna [matrices_individuales].[id_ejecutivo] ya existe. Skip.';

    -- El UNIQUE (id_equipo, periodo) impediría varias matrices nuevas con id_equipo NULL.
    -- Se reemplaza por índices únicos filtrados (equipo histórico / ejecutivo nuevo).
    IF EXISTS (
        SELECT 1 FROM sys.key_constraints
        WHERE parent_object_id = OBJECT_ID('educacion_medica.[matrices_individuales]')
          AND name = 'UQ_matrices_individuales_equipo_periodo'
    )
    BEGIN
        ALTER TABLE educacion_medica.[matrices_individuales] DROP CONSTRAINT [UQ_matrices_individuales_equipo_periodo];
        PRINT 'Constraint [UQ_matrices_individuales_equipo_periodo] eliminada (se reemplaza por índice filtrado).';
    END
    ELSE
        PRINT 'Constraint [UQ_matrices_individuales_equipo_periodo] no existe. Skip.';

    IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('educacion_medica.[matrices_individuales]')
          AND name = 'id_equipo'
          AND is_nullable = 0
    )
    BEGIN
        ALTER TABLE educacion_medica.[matrices_individuales] ALTER COLUMN [id_equipo] int NULL;
        PRINT 'Columna [matrices_individuales].[id_equipo] ahora NULL (legacy ADR-00015).';
    END
    ELSE
        PRINT 'Columna [matrices_individuales].[id_equipo] ya es NULL. Skip.';

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('educacion_medica.[matrices_individuales]')
          AND name = 'UX_matrices_individuales_equipo_periodo'
    )
        CREATE UNIQUE INDEX [UX_matrices_individuales_equipo_periodo]
            ON educacion_medica.[matrices_individuales] ([id_equipo], [periodo])
            WHERE ([id_equipo] IS NOT NULL);

    -- =========================================================================
    -- 3) Índices de consulta
    -- =========================================================================

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND name = 'IX_selecciones_regiones_ejecutivo')
        EXEC(N'CREATE INDEX [IX_selecciones_regiones_ejecutivo] ON educacion_medica.[selecciones_regiones] ([id_ejecutivo]);');
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND name = 'IX_sel_hospital_ejecutivo')
        EXEC(N'CREATE INDEX [IX_sel_hospital_ejecutivo] ON educacion_medica.[selecciones_mensuales_hospitales] ([id_ejecutivo]);');
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND name = 'IX_sel_hospital_especialista')
        EXEC(N'CREATE INDEX [IX_sel_hospital_especialista] ON educacion_medica.[selecciones_mensuales_hospitales] ([id_especialista]);');
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas]') AND name = 'IX_rutas_especialista')
        EXEC(N'CREATE INDEX [IX_rutas_especialista] ON educacion_medica.[rutas] ([id_especialista]);');
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'IX_rutas_visitas_ejecutivo')
        EXEC(N'CREATE INDEX [IX_rutas_visitas_ejecutivo] ON educacion_medica.[rutas_visitas] ([id_ejecutivo]);');
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'IX_rutas_visitas_especialista')
        EXEC(N'CREATE INDEX [IX_rutas_visitas_especialista] ON educacion_medica.[rutas_visitas] ([id_especialista]);');
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'IX_talleres_id_ruta_visita')
        EXEC(N'CREATE INDEX [IX_talleres_id_ruta_visita] ON educacion_medica.[talleres] ([id_ruta_visita]);');
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND name = 'IX_matrices_individuales_ejecutivo')
        EXEC(N'CREATE INDEX [IX_matrices_individuales_ejecutivo] ON educacion_medica.[matrices_individuales] ([id_ejecutivo]);');

    -- =========================================================================
    -- 4) MS_Description de columnas nuevas y semántica actualizada
    -- =========================================================================

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[selecciones_regiones]'), 'id_ejecutivo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Ejecutivo de ventas dueño de la región (FK lógica app.Usuarios, Asokam). Reemplaza la asignación región -> equipo (ADR-00015). NULL = región sin ejecutivo (la selección no puede cerrarse).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'id_ejecutivo';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[selecciones_regiones]'), 'id_especialista', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Especialista sugerido/default para la región (opcional; FK lógica app.Usuarios). La asignación real se confirma en la ruta (ADR-00015).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'id_especialista';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]'), 'id_ejecutivo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Ejecutivo dueño del hospital (override del ejecutivo de la región; FK lógica app.Usuarios). NULL = hereda del ejecutivo de la región.', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_ejecutivo';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]'), 'id_especialista', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Especialista sugerido para el hospital (opcional; FK lógica app.Usuarios). La ruta puede reasignarlo (ADR-00015).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_especialista';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas]'), 'id_especialista', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Especialista dueño de la ruta (FK lógica app.Usuarios). La ruta se organiza por especialista desde ADR-00015; id_equipo queda legacy.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_especialista';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas_visitas]'), 'id_ejecutivo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Ejecutivo dueño del hospital/visita (FK lógica app.Usuarios). Puede ser distinto entre visitas del mismo especialista.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_ejecutivo';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas_visitas]'), 'id_especialista', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Especialista que imparte la visita (FK lógica app.Usuarios). Se valida elegibilidad por gerencia y capacidad (ADR-00015).', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_especialista';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[talleres]'), 'id_ruta_visita', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Visita planificada que origina el taller (FK física rutas_visitas). NULL = taller capturado sin visita o histórico.', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_ruta_visita';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[matrices_individuales]'), 'id_ejecutivo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Ejecutivo dueño de la matriz individual (FK lógica app.Usuarios). Reemplaza id_equipo desde ADR-00015.', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'id_ejecutivo';

    -- Descripciones semánticas que cambian con ADR-00015/00017
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Histórico (ADR-00015). Equipo de pareo EV+EP del modelo anterior; ya no se usa para nuevas selecciones, rutas ni matrices. Se conserva para migración e histórico.', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Ruta de visitas de un especialista dentro de una selección mensual, versionada y en borrador (ADR-00015). Ya no es entidad del workflow: la autorización vive en la selección y la matriz.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Visita planificada de una ruta por especialista: ejecutivo dueño + especialista + hospital + fecha + posición. Unidad de capacidad (máx 3/día y 8/semana por especialista, Lun-Vie). ADR-00015.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Matriz de talleres por ejecutivo y mes (FOR-005). La captura se bloquea al generarla y el GV puede reabrirla; la matriz general por gerencia sigue siendo la entidad autorizable (ADR-00007/00015).', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Matriz general de talleres por gerencia (IMSS / IMSS Bienestar / Descentralizado) y mes: entidad autorizable del workflow EDUCACION_MEDICA_MATRIZ. Nace con el primer taller capturado (ADR-00007/00017).', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Región geográfica calculada y persistida por selección mensual. La asignación región -> ejecutivo vive en id_ejecutivo (ADR-00015); id_equipo queda legacy.', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'N:M selección x hospital con la información capturada para FOR-004. id_ejecutivo es el dueño del hospital (override de la región); id_especialista es una sugerencia opcional (ADR-00015).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas]'), 'id_equipo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Legacy (ADR-00015). Equipo de pareo del modelo anterior; la ruta se organiza por id_especialista. Se conserva para histórico/migración.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_equipo';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[matrices_individuales]'), 'id_equipo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Legacy (ADR-00015). Equipo de pareo del modelo anterior; la matriz individual se organiza por id_ejecutivo. Se conserva para histórico/migración.', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'id_equipo';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[talleres]'), 'es_extraordinario', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'1 = taller no planificado en la ruta, dentro del alcance parametrizado por alcance_hospital_extraordinario (ADR-00017). Si el alcance es CATALOGO y el hospital no está en la selección, id_seleccion_hospital puede ser NULL.', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'es_extraordinario';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas_visitas]'), 'es_extraordinaria', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'1 = visita no planificada dentro del alcance parametrizado por alcance_hospital_extraordinario (ADR-00017). Si el alcance es CATALOGO y el hospital no está en la selección, id_seleccion_hospital puede ser NULL.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'es_extraordinaria';

    -- =========================================================================
    -- 5) Backfill omitido a propósito (2026-10-23)
    --    Los datos operativos se limpian antes de operar con el modelo nuevo.
    --    Ver 0037_..._limpieza-datos-operativos. Si se decide migrar datos
    --    históricos, hacerlo con un script aparte y revisar duplicados.
    -- =========================================================================

    -- Índice único por ejecutivo/periodo: se crea después de las columnas y
    -- sin backfill (la tabla debe estar limpia o sin duplicados).
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('educacion_medica.[matrices_individuales]')
          AND name = 'UX_matrices_individuales_ejecutivo_periodo'
    )
    BEGIN
        EXEC(N'
        IF NOT EXISTS (
            SELECT 1
            FROM (
                SELECT id_ejecutivo, periodo
                FROM educacion_medica.[matrices_individuales]
                WHERE id_ejecutivo IS NOT NULL
                GROUP BY id_ejecutivo, periodo
                HAVING COUNT(*) > 1
            ) d
        )
            CREATE UNIQUE INDEX [UX_matrices_individuales_ejecutivo_periodo]
                ON educacion_medica.[matrices_individuales] ([id_ejecutivo], [periodo])
                WHERE ([id_ejecutivo] IS NOT NULL);');

        IF EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID('educacion_medica.[matrices_individuales]')
              AND name = 'UX_matrices_individuales_ejecutivo_periodo'
        )
            PRINT 'Índice [UX_matrices_individuales_ejecutivo_periodo] creado.';
        ELSE
            PRINT 'AVISO: hay matrices duplicadas por ejecutivo/periodo; no se creó el índice único. Revisar antes de operar.';
    END
    ELSE
        PRINT 'Índice [UX_matrices_individuales_ejecutivo_periodo] ya existe. Skip.';

    COMMIT TRANSACTION;
    PRINT '0033 completado: reparto por ejecutivo / rutas por especialista.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0033: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

-- =============================================================================
-- VERIFICACIÓN (ejecutar aparte)
-- =============================================================================
-- SELECT name, is_nullable FROM sys.columns WHERE object_id = OBJECT_ID('educacion_medica.rutas') AND name IN ('id_equipo','id_especialista');
-- SELECT name, is_nullable FROM sys.columns WHERE object_id = OBJECT_ID('educacion_medica.matrices_individuales') AND name IN ('id_equipo','id_ejecutivo');
-- SELECT COUNT(*) AS ejecutivos_sin_region FROM educacion_medica.selecciones_regiones WHERE id_ejecutivo IS NULL;
-- SELECT COUNT(*) AS rutas_sin_especialista FROM educacion_medica.rutas WHERE id_especialista IS NULL;
-- SELECT COUNT(*) AS talleres_sin_visita FROM educacion_medica.talleres WHERE id_ruta_visita IS NULL;
