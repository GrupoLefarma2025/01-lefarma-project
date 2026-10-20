-- ============================================================
-- 0007_20261019-0000_viaticos_bootstrap-lefarmadev.sql
-- Descripcion: Bootstrap del schema [viaticos] para LefarmaDev.
--
--   LefarmaDev no tiene el schema [viaticos]. Este script crea el schema y
--   las 6 tablas del modulo con el estado ACTUAL del modelo:
--
--     - solicitudes           (incluye sistema_origen, id_usuario_creacion
--                              y num_puntos de 0005, y el indice unico
--                              filtrado de 0006)
--     - solicitud_opciones
--     - solicitud_ajustes
--     - solicitud_eventos
--     - municipios_cat
--     - municipios_osm_staging
--
--   NO crea los SP ni el job de municipios (0002) ni la carga INEGI (0004):
--   el modulo de solicitudes funciona sin ellos. Si se quieren, ejecutar
--   0002 y 0004 despues. Los permisos viaticos.* viven en Asokam y ya
--   existen (0003_..._permisos).
--
-- Idempotente: puede reejecutarse; no duplica schema, tablas, constraints
-- ni indices.
-- NO se aplica automaticamente: requiere ejecucion manual.
-- ============================================================

USE [LefarmaDev];
GO

SET NOCOUNT ON;
GO

-- 1) Schema
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'viaticos')
BEGIN
    EXEC('CREATE SCHEMA viaticos;');
    PRINT 'Schema [viaticos] creado.';
END
ELSE
    PRINT 'Schema [viaticos] ya existe. Skip.';
GO

-- 2) viaticos.solicitudes (maestro, con columnas y reglas vigentes)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'solicitudes')
BEGIN
    CREATE TABLE viaticos.solicitudes
    (
        id_solicitud               INT IDENTITY(1,1) NOT NULL,
        id_usuario_solicitante     INT NOT NULL,
        id_usuario_creacion        INT NOT NULL,
        sistema_origen             NVARCHAR(30) NOT NULL CONSTRAINT DF_solicitudes_sistema_origen DEFAULT ('viaticos'),
        num_puntos                 INT NOT NULL CONSTRAINT DF_solicitudes_num_puntos DEFAULT (0),
        periodo                    CHAR(7) NOT NULL,
        gerencia                   NVARCHAR(150) NOT NULL,
        estado                     NVARCHAR(30) NOT NULL,
        datos_json                 NVARCHAR(MAX) NOT NULL,
        activo                     BIT NOT NULL CONSTRAINT DF_solicitudes_activo DEFAULT (1),
        fecha_creacion             DATETIME2 NOT NULL CONSTRAINT DF_solicitudes_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion         DATETIME2 NOT NULL CONSTRAINT DF_solicitudes_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_solicitudes PRIMARY KEY (id_solicitud),
        CONSTRAINT CK_solicitudes_estado CHECK (estado IN
            ('borrador','enviada','autorizada','autorizada_con_ajustes','rechazada')),
        CONSTRAINT CK_solicitudes_periodo_formato CHECK
            (periodo LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
        CONSTRAINT CK_solicitudes_sistema_origen CHECK
            (sistema_origen IN ('viaticos','educacion_medica'))
    );
    PRINT 'Tabla [viaticos].[solicitudes] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[solicitudes] ya existe. Skip.';
GO

-- 3) viaticos.solicitud_opciones
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'solicitud_opciones')
BEGIN
    CREATE TABLE viaticos.solicitud_opciones
    (
        id_opcion                  INT IDENTITY(1,1) NOT NULL,
        id_solicitud               INT NOT NULL,
        tipo                       NVARCHAR(20) NOT NULL,
        linea                      NVARCHAR(150) NOT NULL,
        datos_json                 NVARCHAR(MAX) NULL,
        precio                     DECIMAL(12,2) NULL,
        moneda                     NVARCHAR(5) NULL,
        url_compra                 NVARCHAR(500) NULL,
        fuente                     NVARCHAR(150) NOT NULL,
        fue_elegida                BIT NOT NULL CONSTRAINT DF_solicitud_opciones_fue_elegida DEFAULT (0),
        ruta_captura               NVARCHAR(500) NULL,
        capturada_en               DATETIME2 NULL,
        CONSTRAINT PK_solicitud_opciones PRIMARY KEY (id_opcion),
        CONSTRAINT FK_solicitud_opciones_solicitud
            FOREIGN KEY (id_solicitud) REFERENCES viaticos.solicitudes (id_solicitud)
            ON DELETE CASCADE,
        CONSTRAINT CK_solicitud_opciones_tipo CHECK (tipo IN ('vuelo','hotel'))
    );
    PRINT 'Tabla [viaticos].[solicitud_opciones] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[solicitud_opciones] ya existe. Skip.';
GO

-- 4) viaticos.solicitud_ajustes
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'solicitud_ajustes')
BEGIN
    CREATE TABLE viaticos.solicitud_ajustes
    (
        id_ajuste                  INT IDENTITY(1,1) NOT NULL,
        id_solicitud               INT NOT NULL,
        id_opcion                  INT NULL,
        campo                      NVARCHAR(100) NOT NULL,
        valor_anterior             NVARCHAR(MAX) NULL,
        valor_nuevo                NVARCHAR(MAX) NULL,
        motivo                     NVARCHAR(1000) NOT NULL,
        id_usuario_admin           INT NOT NULL,
        fecha_creacion             DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT PK_solicitud_ajustes PRIMARY KEY (id_ajuste),
        CONSTRAINT FK_solicitud_ajustes_solicitud
            FOREIGN KEY (id_solicitud) REFERENCES viaticos.solicitudes (id_solicitud)
            ON DELETE CASCADE
    );
    PRINT 'Tabla [viaticos].[solicitud_ajustes] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[solicitud_ajustes] ya existe. Skip.';
GO

-- 5) viaticos.solicitud_eventos
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'solicitud_eventos')
BEGIN
    CREATE TABLE viaticos.solicitud_eventos
    (
        id_evento                  INT IDENTITY(1,1) NOT NULL,
        id_solicitud               INT NOT NULL,
        tipo                       NVARCHAR(50) NOT NULL,
        payload_json               NVARCHAR(MAX) NULL,
        id_usuario                 INT NOT NULL,
        fecha_creacion             DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT PK_solicitud_eventos PRIMARY KEY (id_evento),
        CONSTRAINT FK_solicitud_eventos_solicitud
            FOREIGN KEY (id_solicitud) REFERENCES viaticos.solicitudes (id_solicitud)
            ON DELETE CASCADE
    );
    PRINT 'Tabla [viaticos].[solicitud_eventos] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[solicitud_eventos] ya existe. Skip.';
GO

-- 6) viaticos.municipios_cat (catalogo que lee el backend)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'municipios_cat')
BEGIN
    CREATE TABLE viaticos.municipios_cat
    (
        id_municipio              INT IDENTITY(1,1) NOT NULL,
        codigo_estado             INT NOT NULL,
        nombre                    NVARCHAR(150) NOT NULL,
        clave_municipio           NVARCHAR(30) NULL,
        latitud                   DECIMAL(9,6) NULL,
        longitud                  DECIMAL(9,6) NULL,
        activo                    BIT NOT NULL CONSTRAINT DF_municipios_cat_activo DEFAULT (1),
        fecha_creacion            DATETIME2 NOT NULL CONSTRAINT DF_municipios_cat_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion        DATETIME2 NOT NULL CONSTRAINT DF_municipios_cat_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_municipios_cat PRIMARY KEY (id_municipio),
        CONSTRAINT UQ_municipios_cat_estado_nombre UNIQUE (codigo_estado, nombre)
    );
    PRINT 'Tabla [viaticos].[municipios_cat] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[municipios_cat] ya existe. Skip.';
GO

-- 7) viaticos.municipios_osm_staging (bandeja del job opcional)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'municipios_osm_staging')
BEGIN
    CREATE TABLE viaticos.municipios_osm_staging
    (
        id_staging                INT IDENTITY(1,1) NOT NULL,
        clave_municipio           NVARCHAR(30) NOT NULL,
        codigo_estado             INT NOT NULL,
        nombre                    NVARCHAR(150) NOT NULL,
        latitud                   DECIMAL(9,6) NULL,
        longitud                  DECIMAL(9,6) NULL,
        cargado_en                DATETIME2 NOT NULL CONSTRAINT DF_municipios_osm_staging_cargado_en DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_municipios_osm_staging PRIMARY KEY (id_staging)
    );
    PRINT 'Tabla [viaticos].[municipios_osm_staging] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[municipios_osm_staging] ya existe. Skip.';
GO

-- 8) Indices
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitudes') AND name = 'UQ_solicitudes_usuario_periodo_estado')
BEGIN
    CREATE UNIQUE INDEX UQ_solicitudes_usuario_periodo_estado
        ON viaticos.solicitudes (id_usuario_solicitante, periodo, estado)
        WHERE estado <> 'borrador';
    PRINT 'Indice [UQ_solicitudes_usuario_periodo_estado] creado (filtrado).';
END
ELSE
    PRINT 'Indice [UQ_solicitudes_usuario_periodo_estado] ya existe. Skip.';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitudes') AND name = 'IX_solicitudes_periodo_estado')
BEGIN
    CREATE INDEX IX_solicitudes_periodo_estado
        ON viaticos.solicitudes (periodo, estado) INCLUDE (id_usuario_solicitante, gerencia);
    PRINT 'Indice [IX_solicitudes_periodo_estado] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitudes_periodo_estado] ya existe. Skip.';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitudes') AND name = 'IX_solicitudes_sistema_origen')
BEGIN
    CREATE INDEX IX_solicitudes_sistema_origen
        ON viaticos.solicitudes (sistema_origen, fecha_creacion DESC)
        INCLUDE (id_usuario_solicitante, id_usuario_creacion, periodo, estado, num_puntos);
    PRINT 'Indice [IX_solicitudes_sistema_origen] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitudes_sistema_origen] ya existe. Skip.';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.municipios_cat') AND name = 'IX_municipios_cat_codigo_estado')
BEGIN
    CREATE INDEX IX_municipios_cat_codigo_estado
        ON viaticos.municipios_cat (codigo_estado) INCLUDE (nombre);
    PRINT 'Indice [IX_municipios_cat_codigo_estado] creado.';
END
ELSE
    PRINT 'Indice [IX_municipios_cat_codigo_estado] ya existe. Skip.';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitud_opciones') AND name = 'IX_solicitud_opciones_solicitud')
BEGIN
    CREATE INDEX IX_solicitud_opciones_solicitud
        ON viaticos.solicitud_opciones (id_solicitud) INCLUDE (tipo, linea, precio, fue_elegida);
    PRINT 'Indice [IX_solicitud_opciones_solicitud] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitud_opciones_solicitud] ya existe. Skip.';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitud_ajustes') AND name = 'IX_solicitud_ajustes_solicitud')
BEGIN
    CREATE INDEX IX_solicitud_ajustes_solicitud
        ON viaticos.solicitud_ajustes (id_solicitud) INCLUDE (campo, id_usuario_admin, fecha_creacion);
    PRINT 'Indice [IX_solicitud_ajustes_solicitud] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitud_ajustes_solicitud] ya existe. Skip.';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitud_ajustes') AND name = 'IX_solicitud_ajustes_opcion')
BEGIN
    CREATE INDEX IX_solicitud_ajustes_opcion
        ON viaticos.solicitud_ajustes (id_opcion) WHERE id_opcion IS NOT NULL;
    PRINT 'Indice [IX_solicitud_ajustes_opcion] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitud_ajustes_opcion] ya existe. Skip.';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitud_eventos') AND name = 'IX_solicitud_eventos_solicitud')
BEGIN
    CREATE INDEX IX_solicitud_eventos_solicitud
        ON viaticos.solicitud_eventos (id_solicitud, fecha_creacion);
    PRINT 'Indice [IX_solicitud_eventos_solicitud] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitud_eventos_solicitud] ya existe. Skip.';
GO

PRINT 'FIN bootstrap viaticos en LefarmaDev.';
GO
