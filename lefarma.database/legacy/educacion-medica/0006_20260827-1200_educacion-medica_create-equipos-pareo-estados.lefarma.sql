-- ============================================================
-- 0006_20260827-1200_educacion-medica_create-equipos-pareo-estados.lefarma.sql
-- Descripcion: Crea la tabla equipos_pareo (pareo 1 EV + 1 EP con vigencia y
--              exclusividad). Los campos del reparto por regiones que antes se
--              agregaban aqui con ALTER (estado y firmas de selecciones_mensuales,
--              snapshot + id_region + origen de selecciones_mensuales_hospitales,
--              es_zona_metropolitana e id_region de hospital_extension) se
--              consolidaron en el CREATE TABLE del script 0003.
--              Decision: ADR-00004 (reparto y planificacion de rutas).
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (toda la familia lefarma).
-- Schema requerido: educacion_medica (se crea si no existe, por robustez).
-- Requisito: script 0003 aplicado (con las columnas de regiones consolidadas)
--   y script 0010 aplicado ANTES de la seccion 1 (la FK_equipos_pareo_region
--   referencia regiones_cat, creada en 0010).
-- Convenciones del repo: snake_case, id_<tabla> IDENTITY PK, auditoria
--   (fecha_creacion/fecha_modificacion, id_usuario_creacion/modificacion),
--   guards idempotentes, MS_Description en tablas y columnas.
-- NOTA cross-DB: app.Usuarios vive en Asokam (db distinta); id_ejecutivo e
--   id_especialista son campos de codigo y su existencia se valida en servicio.
-- NOTA exclusividad: los indices unicos son FILTRADOS (WHERE activo = 1):
--   la exclusividad es regla de configuracion ACTUAL, no historica. Un EV que
--   tuvo dos equipos en el pasado (activo = 0) es valido.
-- ============================================================

SET NOCOUNT ON;
GO

-- Guarda del schema (agrega por robustez aunque 0002 ya lo crea)
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
-- 1) equipos_pareo
--    Pareo 1 Ejecutivo de Ventas (EV) + 1 Especialista de Producto (EP).
--    El equipo no existe sin pareo completo (ambos NOT NULL).
--    Vigencia fecha_inicio/fecha_fin: una ruta confirmada conserva la pareja
--    que existia en su momento; cambios de personal abren nuevo pareo.
--    Cada equipo opera SIEMPRE la misma region fija (id_region NOT NULL): la
--    asignacion equipo<->region ya no depende de la seleccion mensual.
--    ADR-00004 decisiones 6 y 7.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'equipos_pareo')
BEGIN
    CREATE TABLE educacion_medica.equipos_pareo
    (
        id_equipo               INT IDENTITY(1,1) NOT NULL,
        id_region                 INT NOT NULL,           -- FK fisica -> educacion_medica.regiones_cat (region fija del equipo)
        id_ejecutivo            INT NOT NULL,           -- FK logica -> app.Usuarios (Asokam) - Ejecutivo de Ventas
        id_especialista         INT NOT NULL,           -- FK logica -> app.Usuarios (Asokam) - Especialista de Producto
        fecha_inicio            DATE NOT NULL CONSTRAINT DF_equipos_pareo_fecha_inicio DEFAULT CAST(GETDATE() AS DATE),
        fecha_fin               DATE NULL,
        activo                  BIT NOT NULL CONSTRAINT DF_equipos_pareo_activo DEFAULT 1,
        fecha_creacion          DATETIME2 NOT NULL CONSTRAINT DF_equipos_pareo_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion      DATETIME2 NOT NULL CONSTRAINT DF_equipos_pareo_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        id_usuario_creacion     INT NULL,
        id_usuario_modificacion INT NULL,
        CONSTRAINT PK_equipo_pareo PRIMARY KEY (id_equipo),
        CONSTRAINT FK_equipos_pareo_region FOREIGN KEY (id_region) REFERENCES educacion_medica.regiones_cat (id_region),
        CONSTRAINT CK_equipos_pareo_vigencia CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
    );
    PRINT 'Tabla [educacion_medica].[equipos_pareo] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[equipos_pareo] ya existe. Skip.';
END
GO

-- Indices unicos filtrados: un EV (o EP) solo en UN equipo activo a la vez.
-- Filtrado por activo = 1 permite repeticiones en el historico (activo = 0).
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.equipos_pareo') AND name = 'UX_equipos_pareo_ejecutivo_activo')
    CREATE UNIQUE INDEX UX_equipos_pareo_ejecutivo_activo
        ON educacion_medica.equipos_pareo (id_ejecutivo)
        WHERE activo = 1;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.equipos_pareo') AND name = 'UX_equipos_pareo_especialista_activo')
    CREATE UNIQUE INDEX UX_equipos_pareo_especialista_activo
        ON educacion_medica.equipos_pareo (id_especialista)
        WHERE activo = 1;
GO

-- ============================================================
-- Documentacion [equipos_pareo] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Pareo 1 Ejecutivo de Ventas + 1 Especialista de Producto que opera cada ruta (ADR-00004). Exclusividad de integrantes solo entre equipos activos; la vigencia (fecha_inicio/fecha_fin) conserva la pareja historica de cada planificacion.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'id_equipo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno del equipo de pareo',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'id_equipo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'id_region', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Región fija que opera el equipo (FK física a regiones_cat). Toda la agrupación y asignación de la selección mensual parte de esta relación 1 equipo = 1 región',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'id_region';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'id_ejecutivo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Ejecutivo de Ventas del pareo (FK logica app.Usuarios, Asokam). Unico entre equipos activos (indice filtrado)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'id_ejecutivo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'id_especialista', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Especialista de Producto del pareo (FK logica app.Usuarios, Asokam). Unico entre equipos activos (indice filtrado)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'id_especialista';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'fecha_inicio', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Inicio de vigencia del pareo',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'fecha_inicio';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'fecha_fin', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fin de vigencia del pareo (NULL = vigente)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'fecha_fin';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'activo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Indica si el pareo esta activo. La exclusividad de integrantes aplica solo entre registros activos',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'activo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'id_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'id_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.equipos_pareo')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.equipos_pareo'), 'id_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'equipos_pareo',
        @level2type = N'COLUMN', @level2name = N'id_usuario_modificacion';
GO

