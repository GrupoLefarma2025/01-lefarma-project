-- ============================================================
-- 0007_20260827-1210_educacion-medica_create-regiones-rutas.lefarma.sql
-- Descripcion: Crea las tablas de planificacion del reparto y las rutas:
--   selecciones_regiones (regiones calculadas por clustering GPS y persistidas,
--   con asignacion region -> equipo), rutas (versionadas, draft->confirmada)
--   y rutas_visitas (la visita planificada: equipo + hospital + fecha + orden).
--   Agrega la FK fisica de selecciones_mensuales_hospitales.id_region.
--   Decision: ADR-00004 (reparto y planificacion de rutas).
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (toda la familia lefarma).
-- Requisitos: scripts 0003 y 0006 aplicados (selecciones_mensuales,
--   selecciones_mensuales_hospitales con id_region, equipos_pareo).
-- Convenciones del repo: snake_case, id_<tabla> IDENTITY PK, auditoria,
--   guards idempotentes, MS_Description. `activo` solo en tablas madre:
--   rutas usa `estado` porque versiona (no es soft-delete); rutas_visitas y
--   selecciones_regiones son hijas (sin activo, sin estado propio).
-- NOTA cross-DB: id_hospital es FK logica -> dbo.genContactosCat (Asokam);
--   su existencia se valida en servicio. Los denormalizados de ubicacion ya
--   viven en selecciones_mensuales_hospitales (region/entidad/municipio).
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
-- 1) selecciones_regiones
--    Regiones calculadas de una seleccion (clustering haversine deterministico
--    sobre el snapshot lat/long) y PERSISTIDAS: no se recalculan al vuelo.
--    Guarda el centroide, la cantidad y el algoritmo usado para poder
--    explicar "por que este hospital quedo en esta region".
--    La asignacion REGION -> EQUIPO vive aqui (regla: hospitales de la misma
--    region se asignan a la misma persona). ADR-00004 decision 4.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'selecciones_regiones')
BEGIN
    CREATE TABLE educacion_medica.selecciones_regiones
    (
        id_region                 INT IDENTITY(1,1) NOT NULL,
        id_seleccion_mensual    INT NOT NULL,
        nombre                  NVARCHAR(80) NULL,      -- nombre editable (p. ej. 'Region Norte')
        centro_latitud          DECIMAL(10,7) NULL,     -- centroide del clustering
        centro_longitud         DECIMAL(10,7) NULL,
        cantidad_hospitales     INT NOT NULL,
        algoritmo               VARCHAR(50) NULL,       -- p. ej. 'haversine-greedy-v1'
        fecha_calculo           DATETIME2 NOT NULL CONSTRAINT DF_selecciones_regiones_fecha_calculo DEFAULT SYSUTCDATETIME(),
        id_equipo               INT NULL,               -- FK fisica -> equipos_pareo (asignacion region -> equipo)
        id_region_catalogo        INT NULL,               -- FK fisica -> regiones_cat (region de catalogo de la que proviene; NULL en divisiones manuales)
        fecha_creacion          DATETIME2 NOT NULL CONSTRAINT DF_selecciones_regiones_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion      DATETIME2 NOT NULL CONSTRAINT DF_selecciones_regiones_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        id_usuario_creacion     INT NULL,
        id_usuario_modificacion INT NULL,
        CONSTRAINT PK_seleccion_region PRIMARY KEY (id_region),
        CONSTRAINT FK_seleccion_region_seleccion FOREIGN KEY (id_seleccion_mensual) REFERENCES educacion_medica.selecciones_mensuales (id_seleccion_mensual) ON DELETE CASCADE,
        CONSTRAINT FK_seleccion_region_equipo FOREIGN KEY (id_equipo) REFERENCES educacion_medica.equipos_pareo (id_equipo),
        CONSTRAINT FK_seleccion_region_region_catalogo FOREIGN KEY (id_region_catalogo) REFERENCES educacion_medica.regiones_cat (id_region),
        CONSTRAINT CK_selecciones_regiones_cantidad CHECK (cantidad_hospitales > 0)
    );
    PRINT 'Tabla [educacion_medica].[selecciones_regiones] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[selecciones_regiones] ya existe. Skip.';
END
GO

-- FK fisica de la columna id_region (creada en el CREATE TABLE del script 0003;
-- no puede ir inline en 0003 porque selecciones_regiones aun no existe alli).
-- ON DELETE NO ACTION: SET NULL no es posible aqui porque combinado con las dos
-- FK en cascada hacia selecciones_mensuales formaria ciclos/multiples rutas en
-- cascada (error 1785 de SQL Server). El servicio ya se encarga de poner
-- id_region = NULL en los hospitales ANTES de borrar las regiones al
-- regenerar la agrupacion, asi que la semantica queda garantizada en codigo.
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales') AND name = 'FK_seleccion_hospital_region')
BEGIN
    ALTER TABLE educacion_medica.selecciones_mensuales_hospitales
        ADD CONSTRAINT FK_seleccion_hospital_region
        FOREIGN KEY (id_region) REFERENCES educacion_medica.selecciones_regiones (id_region)
        ON DELETE NO ACTION;
    PRINT 'FK [FK_seleccion_hospital_region] agregada.';
END
ELSE
    PRINT 'FK [FK_seleccion_hospital_region] ya existe. Skip.';
GO

-- ============================================================
-- Documentacion [selecciones_regiones] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Region geografica calculada (clustering GPS deterministico sobre el snapshot de coordenadas) y persistida por seleccion mensual. La asignacion region -> equipo de pareo vive aqui. Regenerar la agrupacion reemplaza las regiones de la seleccion (hijas de un agregado en revision).',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'id_region', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno de la region calculada',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'id_region';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'id_seleccion_mensual', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Seleccion mensual a la que pertenece la region',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'id_seleccion_mensual';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'nombre', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Nombre editable de la region (p. ej. Region Norte)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'nombre';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'centro_latitud', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Latitud del centroide del cluster (para mapa y explicabilidad)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'centro_latitud';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'centro_longitud', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Longitud del centroide del cluster',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'centro_longitud';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'cantidad_hospitales', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Hospitales que integran la region al momento del calculo (aviso si < 4: regla de minimo por viaje foraneo)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'cantidad_hospitales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'algoritmo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Algoritmo y version usados (p. ej. haversine-greedy-v1); el clustering es deterministico con los mismos parametros',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'algoritmo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'fecha_calculo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha/hora en que se calculo la agrupacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'fecha_calculo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'id_equipo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Equipo de pareo asignado a la region completa (FK fisica equipos_pareo). NULL = region sin asignar',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'id_equipo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'id_region_catalogo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Region de catalogo (regiones_cat) de la que proviene esta region de seleccion al agrupar por region fija. NULL = region creada manualmente (p. ej. division). La FK requiere regiones_cat (script 0010) aplicado',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'id_region_catalogo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'id_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'id_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_regiones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_regiones'), 'id_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_regiones',
        @level2type = N'COLUMN', @level2name = N'id_usuario_modificacion';
GO

-- ============================================================
-- 2) rutas
--    Ruta por equipo y VERSION. Regenerar la propuesta crea version N+1 y
--    archiva la anterior (nunca se borra el trabajo humano). Una misma
--    version puede tener varias rutas del mismo equipo (region dividida
--    autorizada), por eso no hay UNIQUE (equipo, version).
--    Maquina de estados separada de la seleccion. ADR-00004 decisiones 11 y 12.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'rutas')
BEGIN
    CREATE TABLE educacion_medica.rutas
    (
        id_ruta                 INT IDENTITY(1,1) NOT NULL,
        id_seleccion_mensual    INT NOT NULL,
        id_equipo               INT NOT NULL,
        version                 INT NOT NULL,
        nombre                  NVARCHAR(80) NULL,
        estado                  VARCHAR(15) NOT NULL CONSTRAINT DF_rutas_estado DEFAULT 'Draft',
        fecha_confirmacion      DATETIME2 NULL,
        fecha_creacion          DATETIME2 NOT NULL CONSTRAINT DF_rutas_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion      DATETIME2 NOT NULL CONSTRAINT DF_rutas_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        id_usuario_creacion     INT NULL,
        id_usuario_modificacion INT NULL,
        CONSTRAINT PK_ruta PRIMARY KEY (id_ruta),
        CONSTRAINT FK_rutas_seleccion FOREIGN KEY (id_seleccion_mensual) REFERENCES educacion_medica.selecciones_mensuales (id_seleccion_mensual) ON DELETE CASCADE,
        CONSTRAINT FK_rutas_equipo FOREIGN KEY (id_equipo) REFERENCES educacion_medica.equipos_pareo (id_equipo),
        CONSTRAINT CK_rutas_estado CHECK (estado IN ('Draft','Confirmada','Cancelada','Archivada')),
        CONSTRAINT CK_rutas_version CHECK (version > 0)
    );
    PRINT 'Tabla [educacion_medica].[rutas] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[rutas] ya existe. Skip.';
END
GO

-- Indice de consulta: rutas de una seleccion por version
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.rutas') AND name = 'IX_rutas_seleccion_version')
    CREATE INDEX IX_rutas_seleccion_version
        ON educacion_medica.rutas (id_seleccion_mensual, version);
GO

-- ============================================================
-- Documentacion [rutas] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Ruta de visitas de un equipo de pareo dentro de una seleccion mensual, versionada. Regenerar crea version N+1 y archiva la anterior. Estado separado de la seleccion: Draft -> Confirmada -> Cancelada (+ Archivada para versiones pasadas). ADR-00004.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'id_ruta', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno de la ruta',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'id_ruta';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'id_seleccion_mensual', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Seleccion mensual planificada (universo de hospitales aprobado)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'id_seleccion_mensual';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'id_equipo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Equipo de pareo responsable de la ruta (FK fisica equipos_pareo). El historico conserva la pareja vigente al momento',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'id_equipo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'version', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Version de la planificacion dentro de la seleccion (N+1 por cada regeneracion; solo la version Draft mas reciente es editable)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'version';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'nombre', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Nombre editable de la ruta (p. ej. Ruta Norte 01)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'nombre';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'estado', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Draft (editable) | Confirmada (publica asignaciones; no editable: cancelar y regenerar) | Cancelada | Archivada (version reemplazada)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'estado';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'fecha_confirmacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha/hora de confirmacion de la ruta (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'fecha_confirmacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'id_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'id_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas'), 'id_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas',
        @level2type = N'COLUMN', @level2name = N'id_usuario_modificacion';
GO

-- ============================================================
-- 3) rutas_visitas
--    La VISITA PLANIFICADA: equipo + hospital + fecha + posicion en el dia.
--    Es una entidad propia (no un puente N:M): sobre ella se calcula la
--    capacidad (max 3/dia, 8/semana) y se alimenta el calendario.
--    Sin columna estado propia: el estado de la ruta gobierna sus visitas
--    (v1). ADR-00004 decisiones 1, 3 y 13.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'rutas_visitas')
BEGIN
    CREATE TABLE educacion_medica.rutas_visitas
    (
        id_ruta_visita          INT IDENTITY(1,1) NOT NULL,
        id_ruta                 INT NOT NULL,
        id_seleccion_hospital   INT NOT NULL,           -- FK fisica -> selecciones_mensuales_hospitales (trazabilidad)
        id_hospital             INT NULL,               -- FK logica -> dbo.genContactosCat (denormalizado para consulta)
        fecha_visita            DATE NOT NULL,
        orden                   TINYINT NOT NULL,       -- posicion dentro del dia (1..n; tope diario configurable en servicio)
        hora_salida             TIME NULL,
        hora_llegada            TIME NULL,
        fecha_creacion          DATETIME2 NOT NULL CONSTRAINT DF_rutas_visitas_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion      DATETIME2 NOT NULL CONSTRAINT DF_rutas_visitas_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        id_usuario_creacion     INT NULL,
        id_usuario_modificacion INT NULL,
        CONSTRAINT PK_ruta_visita PRIMARY KEY (id_ruta_visita),
        CONSTRAINT FK_rutas_visitas_ruta FOREIGN KEY (id_ruta) REFERENCES educacion_medica.rutas (id_ruta) ON DELETE CASCADE,
        CONSTRAINT FK_rutas_visitas_seleccion_hospital FOREIGN KEY (id_seleccion_hospital) REFERENCES educacion_medica.selecciones_mensuales_hospitales (id_seleccion_hospital),
        CONSTRAINT CK_rutas_visitas_orden CHECK (orden >= 1),
        CONSTRAINT UQ_rutas_visitas_orden UNIQUE (id_ruta, fecha_visita, orden),
        CONSTRAINT UQ_rutas_visitas_hospital UNIQUE (id_ruta, id_seleccion_hospital)
    );
    PRINT 'Tabla [educacion_medica].[rutas_visitas] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[rutas_visitas] ya existe. Skip.';
END
GO

-- Indice de consulta: visitas de un hospital seleccionado (unicidad entre
-- rutas de la misma version activa se valida en servicio)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.rutas_visitas') AND name = 'IX_rutas_visitas_seleccion_hospital')
    CREATE INDEX IX_rutas_visitas_seleccion_hospital
        ON educacion_medica.rutas_visitas (id_seleccion_hospital);
GO

-- ============================================================
-- Documentacion [rutas_visitas] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Visita planificada de una ruta: equipo + hospital seleccionado + fecha + posicion en el dia. Unidad de trabajo sobre la que se valida la capacidad (max 3 visitas/dia y 8/semana por persona, dias laborales Lun-Vie). ADR-00004.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'id_ruta_visita', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno de la visita planificada',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'id_ruta_visita';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'id_ruta', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Ruta a la que pertenece la visita',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'id_ruta';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'id_seleccion_hospital', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Hospital SELECCIONADO de la seleccion mensual que origina la visita (trazabilidad: esta visita proviene de ese hospital aprobado). Unico por ruta; no debe duplicarse entre rutas de la misma version activa (validacion en servicio)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'id_seleccion_hospital';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'id_hospital', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Hospital denormalizado para consulta directa (FK logica dbo.genContactosCat, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'id_hospital';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'fecha_visita', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de la visita. Solo dias laborales Lun-Vie (v1 sin festivos); la semana de la capacidad es la semana calendario',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'fecha_visita';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'orden', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Posicion de la visita dentro del dia de la ruta (1..n). El tope diario (3) es configurable y se valida en servicio',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'orden';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'hora_salida', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Hora de salida prevista (debe caer en horario laboral; opcional en v1)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'hora_salida';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'hora_llegada', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Hora de llegada prevista (debe caer en horario laboral; opcional en v1)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'hora_llegada';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'id_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'id_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.rutas_visitas')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.rutas_visitas'), 'id_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'rutas_visitas',
        @level2type = N'COLUMN', @level2name = N'id_usuario_modificacion';
GO

PRINT '=== 0007 completado: selecciones_regiones + rutas + rutas_visitas ===';
