-- =============================================================================
-- 0016 — Esquema COMPLETO de educacion_medica (instalación limpia)
-- ADR: lefarma.docs/educacion-medica/decisiones/00001, 00004, 00006, 00007,
--      00008 (impartición), 00010 (ajustes post-cierre) y 00011 (extraordinarios).
--
-- QUÉ HACE
--   Crea TODAS las tablas del módulo de Educación Médica con sus columnas
--   FINALES (sin ALTERs posteriores), índices, FKs, checks y MS_Description:
--     catálogos      : tipo_gerencia, regiones_cat, regiones_estados, parametros_anestesias
--     programa anual : programas_anuales, programas_anuales_detalles
--     hospitales     : hospital_extension
--     selección      : selecciones_mensuales, selecciones_mensuales_hospitales, selecciones_regiones
--     equipos        : equipos_pareo
--     rutas          : rutas, rutas_visitas, rutas_versiones
--     talleres       : talleres, taller_recursos, taller_materiales, taller_asistencias,
--                      taller_evidencias, taller_estados_historial
--     ajustes (0010) : ajustes_post_cierre, taller_solicitudes_cambio
--     matriz (0015)  : matrices_individuales, matrices_generales
--     ranking        : config_ranking, config_ranking_factores, ranking_ejecuciones,
--                      ranking_ejecucion_hospitales, parametros_modulo
--     utilidades     : vista vw_hospitales_clasificados
--
--   Consolida el DDL de los scripts históricos 0002, 0003, 0004, 0006, 0007,
--   0010, 0013 (x2), 0014 y 0015, y de los incrementales 0022, 0023, 0025,
--   0026, 0027 y 0028 (retirados del repositorio el 2026-10-10 al quedar
--   integrados aquí; las columnas que aquellos agregaban con ALTER TABLE ya
--   vienen en cada CREATE TABLE). taller_aprobaciones ya NO se crea (la eliminó
--   el ADR-00008: la bitácora del motor cubre las firmas).
--
-- CÓMO USAR (entorno NUEVO / desde cero)
--   1) 0016  (este script)  — esquema completo
--   2) 0030                 — catálogos y backfills (solo Lefarma, sin Asokam)
--   3) 0018                 — workflows de selección, rutas y matriz
--   Permisos (solo si el Asokam del entorno está por sembrar): 0017 (roles y
--   permisos base), 0021 (guards) y 0029 (ajustes/extraordinarios).
--   Los scripts históricos NO se eliminan: quedan como registro y para
--   entornos ya migrados (ahí se sigue usando 0015 incremental).
--
-- REQUISITOS
--   - Esquema base de la plataforma aplicado (config.workflow_* y demás tablas
--     de config/app) — 0016 solo cubre educacion_medica.
--   - Para la vista vw_hospitales_clasificados: acceso READ a la BD Asokam.
--
-- IDEMPOTENTE: cada bloque tiene guarda IF NOT EXISTS (se puede re-ejecutar).
-- =============================================================================
 
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;   -- requerido por índices filtrados (DML posterior)
SET ANSI_NULLS ON;
 
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'educacion_medica')
    EXEC('CREATE SCHEMA educacion_medica');
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = SCHEMA_ID('educacion_medica') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Modulo de Educacion Medica: talleres medicos en hospitales (proceso ASK-CEM-DDP-001), programas anuales, selecciones mensuales y formularios FOR-002..FOR-008.', @level0type = N'SCHEMA', @level0name = N'educacion_medica';
 
-- -----------------------------------------------------------------------------
-- config_ranking
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'config_ranking')
BEGIN
    CREATE TABLE educacion_medica.[config_ranking] (
        [id_configuracion] int IDENTITY(1,1) NOT NULL,
        [nombre] nvarchar(100) NOT NULL,
        [version] int NOT NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_config_ranking_activo] DEFAULT ((0)),
        [fecha_vigencia_inicio] date NULL,
        [fecha_vigencia_fin] date NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_config_ranking_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_config_ranking_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_config_ranking] PRIMARY KEY ([id_configuracion]),
        CONSTRAINT [UQ_config_ranking_nombre_version] UNIQUE ([nombre], [version])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[config_ranking]') AND name = 'UX_config_ranking_activa')
    CREATE UNIQUE INDEX [UX_config_ranking_activa] ON educacion_medica.[config_ranking] ([activo]) WHERE ([activo]=(1));
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Configuracion de pesos del motor de scoring para priorizacion de hospitales en la seleccion mensual (ADR-00005). V1 permite una unica configuracion activa.', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking', 'COLUMN', N'id_configuracion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Nombre de la configuracion (p. ej. General)', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking', 'COLUMN', N'nombre';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Numero de version (inmutable; se crea una nueva version para cambiar pesos)', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking', 'COLUMN', N'version';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si es la configuracion activa (V1: una sola activa)', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking', 'COLUMN', N'activo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Inicio de vigencia opcional (camino para futuro, V1 no lo usa)', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking', 'COLUMN', N'fecha_vigencia_inicio';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fin de vigencia opcional (camino para futuro, V1 no lo usa)', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking', 'COLUMN', N'fecha_vigencia_fin';
 
-- -----------------------------------------------------------------------------
-- parametros_anestesias
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'parametros_anestesias')
BEGIN
    CREATE TABLE educacion_medica.[parametros_anestesias] (
        [id_parametro_anestesia] int IDENTITY(1,1) NOT NULL,
        [anio] int NOT NULL,
        [clave] varchar(50) NOT NULL,
        [valor] decimal(10,6) NOT NULL,
        [descripcion] nvarchar(250) NULL,
        [orden] int NOT NULL CONSTRAINT [DF__parametro__orden__5F740C0B] DEFAULT ((0)),
        [activo] bit NOT NULL CONSTRAINT [DF_parametros_anestesias_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_parametros_anestesias_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_parametros_anestesias_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_parametros_anestesias] PRIMARY KEY ([id_parametro_anestesia]),
        CONSTRAINT [UQ_parametros_anestesias_anio_clave] UNIQUE ([anio], [clave])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_anestesias]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Factores configurables del calculo de anestesias del FOR-002, versionados por anio.', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_anestesias';
 
-- -----------------------------------------------------------------------------
-- parametros_modulo
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'parametros_modulo')
BEGIN
    CREATE TABLE educacion_medica.[parametros_modulo] (
        [clave] varchar(50) NOT NULL,
        [valor] decimal(10,2) NOT NULL,
        [descripcion] nvarchar(200) NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_parametros_modulo_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_parametros_modulo_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_parametros_modulo_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_parametro_modulo] PRIMARY KEY ([clave])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Parametros configurables del modulo Educacion Medica (clave/valor). Consumidos por los servicios de reparto y planificacion de rutas (ADR-00004); se ajustan desde la pantalla Parametros sin tocar codigo.', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador logico del parametro (p. ej. radio_clustering_km, max_visitas_dia)', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'clave';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Valor numerico del parametro', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'valor';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Descripcion para humanos del parametro', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'descripcion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si el registro esta activo', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'activo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'id_usuario_modificacion';

-- Seed del parámetro de ajustes post-cierre (ADR-00010; el incremental 0027,
-- ya retirado, lo sembraba en BD existentes). Editable en la pantalla Parámetros.
IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = 'dias_limite_cambio')
    INSERT INTO educacion_medica.parametros_modulo (clave, valor, descripcion)
    VALUES ('dias_limite_cambio', 45, N'Dias hacia atras (contados desde hoy contra la fecha original del taller/visita) en que se permite un ajuste post-cierre (ADR-00010). Editable en la pantalla Parametros.');
 
-- -----------------------------------------------------------------------------
-- tipo_gerencia
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'tipo_gerencia')
BEGIN
    CREATE TABLE educacion_medica.[tipo_gerencia] (
        [id_tipo_gerencia] int IDENTITY(1,1) NOT NULL,
        [descripcion] varchar(50) NOT NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_tipo_gerencia_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_tipo_gerencia_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_tipo_gerencia_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_tipo_gerencia] PRIMARY KEY ([id_tipo_gerencia]),
        CONSTRAINT [UQ_tipo_gerencia_descripcion] UNIQUE ([descripcion])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_gerencia]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Catalogo de tipos de gerencia de ventas (no existe en Asokam; valores documentados: IMSS, Descentralizado, Privado).', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_gerencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_gerencia]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_gerencia', 'COLUMN', N'id_tipo_gerencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_gerencia]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Descripcion del tipo de gerencia (IMSS | Descentralizado | Privado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_gerencia', 'COLUMN', N'descripcion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_gerencia]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si el registro esta activo', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_gerencia', 'COLUMN', N'activo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_gerencia]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_gerencia', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_gerencia]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_gerencia', 'COLUMN', N'fecha_modificacion';
 
-- -----------------------------------------------------------------------------
-- config_ranking_factores
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'config_ranking_factores')
BEGIN
    CREATE TABLE educacion_medica.[config_ranking_factores] (
        [id_factor] int IDENTITY(1,1) NOT NULL,
        [id_configuracion] int NOT NULL,
        [clave] varchar(50) NOT NULL,
        [grupo] varchar(30) NULL,
        [nombre] nvarchar(100) NOT NULL,
        [descripcion] nvarchar(300) NOT NULL,
        [peso] decimal(5,2) NOT NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_config_ranking_factores_activo] DEFAULT ((1)),
        [tipo_normalizacion] varchar(30) NULL,
        [parametros_json] nvarchar(MAX) NULL,
        CONSTRAINT [PK_config_ranking_factor] PRIMARY KEY ([id_factor]),
        CONSTRAINT [UQ_config_ranking_factores_config_clave] UNIQUE ([id_configuracion], [clave]),
        CONSTRAINT [FK_config_ranking_factores_config] FOREIGN KEY ([id_configuracion]) REFERENCES educacion_medica.[config_ranking] ([id_configuracion])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Factores de una configuracion de scoring. La estrategia de normalizacion (tipo_normalizacion) es documental en V1; el motor decide el calculo por factor en codigo.', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores', 'COLUMN', N'id_factor';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Configuracion a la que pertenece (FK educacion_medica.config_ranking)', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores', 'COLUMN', N'id_configuracion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Clave del factor (p. ej. anestesias_totales, recencia_seleccion)', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores', 'COLUMN', N'clave';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Agrupacion logica del factor (Potencial, Cobertura, Geografia)', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores', 'COLUMN', N'grupo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Nombre legible del factor que se muestra al usuario', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores', 'COLUMN', N'nombre';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Descripcion de ayuda que explica al usuario que representa el factor', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores', 'COLUMN', N'descripcion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Peso configurado del factor en porcentaje. La suma de activos debe ser 100 (validado en servicio)', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores', 'COLUMN', N'peso';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si el factor participa en el score', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores', 'COLUMN', N'activo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Estrategia de normalizacion (documental en V1: percentil, tramos, funcion). El motor decide la implementacion por clave.', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores', 'COLUMN', N'tipo_normalizacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Parametros adicionales del factor en JSON (p. ej. {"radio_km": 50} para agrupabilidad_geografica)', 'SCHEMA', N'educacion_medica', 'TABLE', N'config_ranking_factores', 'COLUMN', N'parametros_json';
 
-- -----------------------------------------------------------------------------
-- programas_anuales
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'programas_anuales')
BEGIN
    CREATE TABLE educacion_medica.[programas_anuales] (
        [id_programa_anual] int IDENTITY(1,1) NOT NULL,
        [fecha] date NOT NULL,
        [definicion] nvarchar(200) NULL,
        [periodo_inicio] tinyint NULL,
        [periodo_fin] tinyint NULL,
        [id_tipo_gerencia] int NULL,
        [tipo_hospital] varchar(20) NULL,
        [numero_hospitales] int NULL,
        [meta_al_anio] int NULL,
        [productos_a_promocionar] nvarchar(300) NULL,
        [semanas_trabajo] decimal(8,2) NULL,
        [talleres_semana] decimal(8,2) NULL,
        [talleres_especialista] decimal(8,2) NULL,
        [especialistas_necesarios] int NULL,
        [especialistas_disponibles_imss] int NULL,
        [especialistas_disponibles_descentralizados] int NULL,
        [especialistas_a_contratar] int NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_programas_anuales_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_programas_anuales_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_programas_anuales_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_programas_anuales] PRIMARY KEY ([id_programa_anual]),
        CONSTRAINT [FK_programas_anuales_tipo_gerencia] FOREIGN KEY ([id_tipo_gerencia]) REFERENCES educacion_medica.[tipo_gerencia] ([id_tipo_gerencia])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Agregado del programa anual (FOR-003): una fila por definicion/modulo de programa (producto a promocionar en un periodo); el resumen de capacidad lo calcula el servicio.', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'id_programa_anual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha (a�o) del programa', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'fecha';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Definicion/objetivo del programa (FOR-003)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'definicion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Mes de inicio del periodo (1-12)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'periodo_inicio';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Mes de fin del periodo (1-12)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'periodo_fin';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Referencia al catalogo educacion_medica.tipo_gerencia (IMSS/Descentralizado/Privado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'id_tipo_gerencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Con SIA | Sin SIA', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'tipo_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Numero de hospitales objetivo al anio', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'numero_hospitales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Meta anual = numero de hospitales x 1.5 (la calcula el servicio)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'meta_al_anio';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 10 AND name = 'MS_Description')

    EXEC sp_addextendedproperty N'MS_Description', N'CSV de claves de producto (R-III, R-II, R-I, B-27G, B-22G, T)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'productos_a_promocionar';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Resumen de capacidad: semanas laboradas en hospitales', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'semanas_trabajo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 12 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Resumen de capacidad: talleres por semana', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'talleres_semana';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 13 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Resumen de capacidad: talleres por especialista a la semana', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'talleres_especialista';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 14 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Resumen de capacidad: especialistas necesarios', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'especialistas_necesarios';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 15 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Resumen de capacidad: especialistas disponibles IMSS', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'especialistas_disponibles_imss';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 16 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Resumen de capacidad: especialistas disponibles Descentralizados', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'especialistas_disponibles_descentralizados';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 17 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Resumen de capacidad: especialistas a contratar', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'especialistas_a_contratar';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 18 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si el registro esta activo', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'activo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 19 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 20 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 21 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND minor_id = 22 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'id_usuario_modificacion';
 
-- -----------------------------------------------------------------------------
-- regiones_cat
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'regiones_cat')
BEGIN
    CREATE TABLE educacion_medica.[regiones_cat] (
        [id_region] int IDENTITY(1,1) NOT NULL,
        [nombre] nvarchar(50) NOT NULL,
        [centro_latitud] decimal(9,6) NULL,
        [centro_longitud] decimal(9,6) NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_regiones_cat_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_regiones_cat_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_regiones_cat_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        [id_tipo_gerencia] int NOT NULL,
        CONSTRAINT [PK_regiones_cat] PRIMARY KEY ([id_region]),
        CONSTRAINT [UQ_regiones_cat_gerencia_nombre] UNIQUE ([id_tipo_gerencia], [nombre]),
        CONSTRAINT [FK_regiones_cat_tipo_gerencia] FOREIGN KEY ([id_tipo_gerencia]) REFERENCES educacion_medica.[tipo_gerencia] ([id_tipo_gerencia])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[regiones_cat]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Gerencia duena del catalogo de regiones (FK educacion_medica.tipo_gerencia): IMSS y Descentralizado tienen sus propias regiones; sus ejecutivos de ventas son distintos.', 'SCHEMA', N'educacion_medica', 'TABLE', N'regiones_cat', 'COLUMN', N'id_tipo_gerencia';
 
-- -----------------------------------------------------------------------------
-- selecciones_mensuales
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'selecciones_mensuales')
BEGIN
    CREATE TABLE educacion_medica.[selecciones_mensuales] (
        [id_seleccion_mensual] int IDENTITY(1,1) NOT NULL,
        [fecha_seleccion] date NOT NULL,
        [id_tipo_gerencia] int NULL,
        [fecha_inicio_vigencia] date NULL,
        [fecha_fin_vigencia] date NULL,
        [talleres_objetivo_mes] int NULL,
        [estado] varchar(15) NOT NULL CONSTRAINT [DF_selecciones_mensuales_estado] DEFAULT ('Creada'),
        [firma_gv_fecha] datetime2(7) NULL,
        [firma_gg_fecha] datetime2(7) NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_selecciones_mensuales_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_selecciones_mensuales_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_selecciones_mensuales_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        [id_workflow] int NULL,
        [id_paso_actual] int NULL,
        [id_estado] int NULL,
        CONSTRAINT [PK_seleccion_mensual] PRIMARY KEY ([id_seleccion_mensual]),
        CONSTRAINT [FK_selecciones_mensuales_tipo_gerencia] FOREIGN KEY ([id_tipo_gerencia]) REFERENCES educacion_medica.[tipo_gerencia] ([id_tipo_gerencia])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Agregado de la seleccion mensual de hospitales (FOR-004, reunion del dia 15; hospitales visitados en los proximos 45 dias).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'id_seleccion_mensual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de la reunion (dia 15 del mes)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'fecha_seleccion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Referencia al catalogo educacion_medica.tipo_gerencia (IMSS/Descentralizado/Privado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'id_tipo_gerencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Primer dia del periodo de 45 dias', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'fecha_inicio_vigencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ultimo dia del periodo de 45 dias', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'fecha_fin_vigencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Minimo de talleres a programar el mes (documentacion: >=64 por gerencia)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'talleres_objetivo_mes';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Maquina de estados de la seleccion: Creada -> EnRevision -> Cerrada (firma GV) / Rechazada / Cancelada', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'estado';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de firma del Gerente de Ventas (primera firma de la doble firma)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'firma_gv_fecha';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de firma de la Gerencia General (segunda firma; completa la doble firma y autoriza la seleccion)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'firma_gg_fecha';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si el registro esta activo', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'activo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 12 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 13 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 14 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'id_usuario_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 15 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Workflow asignado por el motor (proceso EDUCACION_MEDICA, SUBPROCESO=1). FK logica a config.workflows.', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'id_workflow';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 16 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Paso actual del workflow de la seleccion (Creada -> Firma GV -> Cerrada). FK logica a config.workflow_pasos.', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'id_paso_actual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND minor_id = 17 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Estado del motor (config.workflow_estados) correspondiente al paso actual. El campo estado (texto) se conserva sincronizado.', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales', 'COLUMN', N'id_estado';
 
-- -----------------------------------------------------------------------------
-- equipos_pareo
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'equipos_pareo')
BEGIN
    CREATE TABLE educacion_medica.[equipos_pareo] (
        [id_equipo] int IDENTITY(1,1) NOT NULL,
        [id_region] int NOT NULL,
        [id_ejecutivo] int NOT NULL,
        [id_especialista] int NOT NULL,
        [fecha_inicio] date NOT NULL CONSTRAINT [DF_equipos_pareo_fecha_inicio] DEFAULT (CONVERT([date],getdate())),
        [fecha_fin] date NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_equipos_pareo_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_equipos_pareo_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_equipos_pareo_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_equipo_pareo] PRIMARY KEY ([id_equipo]),
        CONSTRAINT [FK_equipos_pareo_region] FOREIGN KEY ([id_region]) REFERENCES educacion_medica.[regiones_cat] ([id_region])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND name = 'UX_equipos_pareo_ejecutivo_activo')
    CREATE UNIQUE INDEX [UX_equipos_pareo_ejecutivo_activo] ON educacion_medica.[equipos_pareo] ([id_ejecutivo]) WHERE ([activo]=(1));
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND name = 'UX_equipos_pareo_especialista_activo')
    CREATE UNIQUE INDEX [UX_equipos_pareo_especialista_activo] ON educacion_medica.[equipos_pareo] ([id_especialista]) WHERE ([activo]=(1));
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Pareo 1 Ejecutivo de Ventas + 1 Especialista de Producto que opera cada ruta (ADR-00004). Exclusividad de integrantes solo entre equipos activos; la vigencia (fecha_inicio/fecha_fin) conserva la pareja historica de cada planificacion.', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno del equipo de pareo', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'id_equipo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Regi�n fija que opera el equipo (FK f�sica a regiones_cat). Toda la agrupaci�n y asignaci�n de la selecci�n mensual parte de esta relaci�n 1 equipo = 1 regi�n', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'id_region';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ejecutivo de Ventas del pareo (FK logica app.Usuarios, Asokam). Unico entre equipos activos (indice filtrado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'id_ejecutivo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Especialista de Producto del pareo (FK logica app.Usuarios, Asokam). Unico entre equipos activos (indice filtrado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'id_especialista';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Inicio de vigencia del pareo', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'fecha_inicio';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fin de vigencia del pareo (NULL = vigente)', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'fecha_fin';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si el pareo esta activo. La exclusividad de integrantes aplica solo entre registros activos', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'activo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'id_usuario_modificacion';
 
-- -----------------------------------------------------------------------------
-- hospital_extension
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'hospital_extension')
BEGIN
    CREATE TABLE educacion_medica.[hospital_extension] (
        [id_hospital_extension] int IDENTITY(1,1) NOT NULL,
        [id_hospital] int NOT NULL,
        [fecha] date NULL,
        [id_tipo_gerencia] int NULL,
        [con_sia] bit NULL,
        [numero_quirofanos] int NULL,
        [anestesias_totales] decimal(18,2) NULL,
        [anestesias_generales] decimal(18,2) NULL,
        [anestesias_regionales] decimal(18,2) NULL,
        [anestesias_epidurales] decimal(18,2) NULL,
        [anestesias_subdurales] decimal(18,2) NULL,
        [anestesias_mixtas_obesos] decimal(18,2) NULL,
        [anestesias_mixtas_no_obesos] decimal(18,2) NULL,
        [es_zona_metropolitana] bit NULL,
        [id_region] int NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_hospital_extension_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_hospital_extension_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_hospital_extension_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        [es_almacen] bit NULL,
        [es_farmacia] bit NULL,
        [es_sede_taller] bit NULL,
        CONSTRAINT [PK_hospital_extension] PRIMARY KEY ([id_hospital_extension]),
        CONSTRAINT [UQ_hospital_extension_id_hospital] UNIQUE ([id_hospital]),
        CONSTRAINT [FK_hospital_extension_region] FOREIGN KEY ([id_region]) REFERENCES educacion_medica.[regiones_cat] ([id_region]) ON DELETE SET NULL,
        CONSTRAINT [FK_hospital_extension_tipo_gerencia] FOREIGN KEY ([id_tipo_gerencia]) REFERENCES educacion_medica.[tipo_gerencia] ([id_tipo_gerencia])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Extension 1:1 del hospital (dbo.genContactosCat, Asokam) con los calculos de anestesias del FOR-002; las columnas AT/AG/AR/AE/AS/MO/MNO se calculan en el backend a partir de los parametros de anestesias activos.', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'id_hospital_extension';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Codigo del hospital; FK logica -> dbo.genContactosCat.codigoContacto (validar en servicio)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'id_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de la base de datos (FOR-002)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'fecha';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Referencia al catalogo educacion_medica.tipo_gerencia (IMSS/Descentralizado/Privado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'id_tipo_gerencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'1 = con SIA, 0 = sin SIA', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'con_sia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Numero de quirofanos del hospital', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'numero_quirofanos';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'AT = NQ x 2.5 x 250 (calculada en el backend con los parametros activos)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'anestesias_totales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'AG = AT x 30% (calculada en el backend con los parametros activos)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'anestesias_generales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'AR = AT x 70% (calculada en el backend con los parametros activos)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'anestesias_regionales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'AE = AR x 35% (calculada en el backend con los parametros activos)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'anestesias_epidurales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'AS = AR x 45% (calculada en el backend con los parametros activos)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'anestesias_subdurales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 12 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'MO = AR x 2% (calculada en el backend con los parametros activos)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'anestesias_mixtas_obesos';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 13 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'MNO = AR x 18% (calculada en el backend con los parametros activos)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'anestesias_mixtas_no_obesos';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 14 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'1 = local (CDMX / zona metropolitana), 0 = foraneo, NULL = sin clasificar (el algoritmo de rutas lo cuenta como foraneo y advierte). Base de la regla de max 3 viajes foraneos por especialista al mes (IDT-003 2.2)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'es_zona_metropolitana';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 15 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Region de catalogo asignada al hospital (FK fisica a regiones_cat; constraint creada en script 0010). NULL = sin asignar: se resuelve por GPS contra el centroide o se asigna manualmente', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'id_region';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 16 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si el registro esta activo', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'activo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 17 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 18 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 19 AND name = 'MS_Description')

    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 20 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'id_usuario_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 21 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Contacto logistico de tipo almacen (almacen delegacional/subdelegacional, sub-almacen, BIRMEX). No es sede de taller', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'es_almacen';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 22 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Contacto logistico de tipo farmacia. Puede ser sede si no existe sub-almacen del mismo UMAE', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'es_farmacia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[hospital_extension]') AND minor_id = 23 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'1 = contacto seleccionable como sede de taller (buscador de Seleccion y ranking); 0 = contacto logistico (almacen/farmacia sin preferencia); NULL = sin clasificar (no se excluye)', 'SCHEMA', N'educacion_medica', 'TABLE', N'hospital_extension', 'COLUMN', N'es_sede_taller';
 
-- -----------------------------------------------------------------------------
-- programas_anuales_detalles
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'programas_anuales_detalles')
BEGIN
    CREATE TABLE educacion_medica.[programas_anuales_detalles] (
        [id_programa_detalle] int IDENTITY(1,1) NOT NULL,
        [id_programa_anual] int NOT NULL,
        [id_hospital] int NULL,
        [id_producto] varchar(50) NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_programa_detalle_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_programa_detalle_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_programa_anual_detalle] PRIMARY KEY ([id_programa_detalle]),
        CONSTRAINT [UQ_programa_detalle_programa_hospital] UNIQUE ([id_programa_anual], [id_hospital], [id_producto]),
        CONSTRAINT [FK_programa_detalle_programa] FOREIGN KEY ([id_programa_anual]) REFERENCES educacion_medica.[programas_anuales] ([id_programa_anual]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales_detalles]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'N:M programa x hospital x producto; los productos/hospitales se validan contra Asokam en el servicio (FK logica, no fisica).', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales_detalles';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales_detalles]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales_detalles', 'COLUMN', N'id_programa_detalle';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales_detalles]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Programa anual al que pertenece el detalle (FK educacion_medica.programas_anuales)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales_detalles', 'COLUMN', N'id_programa_anual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales_detalles]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Codigo del hospital; FK logica -> dbo.genContactosCat.codigoContacto (validar en servicio)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales_detalles', 'COLUMN', N'id_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales_detalles]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Codigo del producto; FK logica -> dbo.genProductosCat.codigoProducto (validar en servicio)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales_detalles', 'COLUMN', N'id_producto';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales_detalles]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales_detalles', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales_detalles]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales_detalles', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales_detalles]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales_detalles', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[programas_anuales_detalles]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales_detalles', 'COLUMN', N'id_usuario_modificacion';
 
-- -----------------------------------------------------------------------------
-- ranking_ejecuciones
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'ranking_ejecuciones')
BEGIN
    CREATE TABLE educacion_medica.[ranking_ejecuciones] (
        [id_ranking_ejecucion] int IDENTITY(1,1) NOT NULL,
        [id_seleccion_mensual] int NOT NULL,
        [id_configuracion] int NOT NULL,
        [version_algoritmo] varchar(20) NOT NULL,
        [cantidad_solicitada] int NOT NULL,
        [cantidad_candidatos] int NOT NULL,
        [pesos_efectivos_json] nvarchar(MAX) NOT NULL,
        [filtros_json] nvarchar(MAX) NULL,
        [fecha_ejecucion] datetime2(7) NOT NULL CONSTRAINT [DF_ranking_ejecuciones_fecha_ejecucion] DEFAULT (sysutcdatetime()),
        [id_usuario_ejecucion] int NULL,
        CONSTRAINT [PK_ranking_ejecucion] PRIMARY KEY ([id_ranking_ejecucion]),
        CONSTRAINT [FK_ranking_ejecuciones_config] FOREIGN KEY ([id_configuracion]) REFERENCES educacion_medica.[config_ranking] ([id_configuracion]),
        CONSTRAINT [FK_ranking_ejecuciones_seleccion] FOREIGN KEY ([id_seleccion_mensual]) REFERENCES educacion_medica.[selecciones_mensuales] ([id_seleccion_mensual])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND name = 'IX_ranking_ejecuciones_seleccion')
    CREATE INDEX [IX_ranking_ejecuciones_seleccion] ON educacion_medica.[ranking_ejecuciones] ([id_seleccion_mensual], [fecha_ejecucion] DESC);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Registro inmutable de una ejecucion del motor de scoring sobre una seleccion mensual (ADR-00005). Permite reconstruir historicamente el ranking propuesto.', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones', 'COLUMN', N'id_ranking_ejecucion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Seleccion mensual sobre la que se ejecuto el ranking (FK educacion_medica.selecciones_mensuales)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones', 'COLUMN', N'id_seleccion_mensual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Configuracion utilizada (FK educacion_medica.config_ranking). Inmutable porque la config no se edita despues de usarse.', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones', 'COLUMN', N'id_configuracion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Version del algoritmo (p. ej. scoring-v1.0)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones', 'COLUMN', N'version_algoritmo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Cantidad N solicitada por el usuario para el Top N', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones', 'COLUMN', N'cantidad_solicitada';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Numero de hospitales candidatos despues de aplicar filtros', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones', 'COLUMN', N'cantidad_candidatos';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Pesos finales usados (tras redistribuir factores sin variabilidad)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones', 'COLUMN', N'pesos_efectivos_json';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Filtros aplicados (gerencia, activo, etc.)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones', 'COLUMN', N'filtros_json';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha UTC en que se genero la ejecucion', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones', 'COLUMN', N'fecha_ejecucion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecuciones]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que genero el ranking (FK logica -> app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecuciones', 'COLUMN', N'id_usuario_ejecucion';
 
-- -----------------------------------------------------------------------------
-- regiones_estados
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'regiones_estados')
BEGIN
    CREATE TABLE educacion_medica.[regiones_estados] (
        [id_region_estado] int IDENTITY(1,1) NOT NULL,
        [codigo_estado] int NOT NULL,
        [id_region] int NOT NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_regiones_estados_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_regiones_estados_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        [id_tipo_gerencia] int NOT NULL,
        CONSTRAINT [PK_regiones_estados] PRIMARY KEY ([id_region_estado]),
        CONSTRAINT [UQ_regiones_estados_gerencia_estado] UNIQUE ([id_tipo_gerencia], [codigo_estado]),
        CONSTRAINT [FK_regiones_estados_region] FOREIGN KEY ([id_region]) REFERENCES educacion_medica.[regiones_cat] ([id_region]),
        CONSTRAINT [FK_regiones_estados_tipo_gerencia] FOREIGN KEY ([id_tipo_gerencia]) REFERENCES educacion_medica.[tipo_gerencia] ([id_tipo_gerencia])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[regiones_estados]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Gerencia del mapeo (denormalizada de su region). Permite que un mismo estado pertenezca a una region de IMSS y a una de Descentralizado a la vez (UQ compuesta). El servicio la mantiene sincronizada con la region.', 'SCHEMA', N'educacion_medica', 'TABLE', N'regiones_estados', 'COLUMN', N'id_tipo_gerencia';
 
-- -----------------------------------------------------------------------------
-- rutas_versiones
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'rutas_versiones')
BEGIN
    CREATE TABLE educacion_medica.[rutas_versiones] (
        [id_ruta_version] int IDENTITY(1,1) NOT NULL,
        [id_seleccion_mensual] int NOT NULL,
        [version] int NOT NULL,
        [id_tipo_gerencia] int NULL,
        [estado] varchar(15) NOT NULL CONSTRAINT [DF_rutas_versiones_estado] DEFAULT ('Creada'),
        [fecha_confirmacion] datetime2(7) NULL,
        [id_workflow] int NULL,
        [id_paso_actual] int NULL,
        [id_estado] int NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_rutas_versiones_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_rutas_versiones_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_rutas_versiones] PRIMARY KEY ([id_ruta_version]),
        CONSTRAINT [UQ_rutas_versiones_seleccion_version] UNIQUE ([id_seleccion_mensual], [version]),
        CONSTRAINT [FK_rutas_versiones_seleccion] FOREIGN KEY ([id_seleccion_mensual]) REFERENCES educacion_medica.[selecciones_mensuales] ([id_seleccion_mensual]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_versiones]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Version de rutas de una seleccion mensual: es la entidad autorizable del workflow (GV -> CA -> DC). Una fila por seleccion + version; las filas de rutas apuntan aqui con id_ruta_version (ADR-00006).', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_versiones';
 
-- -----------------------------------------------------------------------------
-- ranking_ejecucion_hospitales
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'ranking_ejecucion_hospitales')
BEGIN
    CREATE TABLE educacion_medica.[ranking_ejecucion_hospitales] (
        [id_ejecucion_hospital] int IDENTITY(1,1) NOT NULL,
        [id_ranking_ejecucion] int NOT NULL,
        [id_hospital] int NOT NULL,
        [posicion] int NOT NULL,
        [score_total] decimal(5,2) NOT NULL,
        [porcentaje_completitud] decimal(5,2) NOT NULL,
        [es_top_sugerido] bit NOT NULL,
        [decision] varchar(25) NOT NULL CONSTRAINT [DF_ejecucion_hospital_decision] DEFAULT ('SinDecision'),
        [factores_json] nvarchar(MAX) NOT NULL,
        CONSTRAINT [PK_ejecucion_hospital] PRIMARY KEY ([id_ejecucion_hospital]),
        CONSTRAINT [UQ_ejecucion_hospital_unica] UNIQUE ([id_ranking_ejecucion], [id_hospital]),
        CONSTRAINT [FK_ejecucion_hospital_ejecucion] FOREIGN KEY ([id_ranking_ejecucion]) REFERENCES educacion_medica.[ranking_ejecuciones] ([id_ranking_ejecucion]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND name = 'IX_ejecucion_hospital_hospital')
    CREATE INDEX [IX_ejecucion_hospital_hospital] ON educacion_medica.[ranking_ejecucion_hospitales] ([id_hospital]);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Detalle por hospital de una ejecucion de ranking: todos los candidatos (no solo los aceptados), con score, factores y decision humana.', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecucion_hospitales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecucion_hospitales', 'COLUMN', N'id_ejecucion_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ejecucion a la que pertenece (FK educacion_medica.ranking_ejecuciones)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecucion_hospitales', 'COLUMN', N'id_ranking_ejecucion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Codigo del hospital; FK logica -> dbo.genContactosCat.codigoContacto (validar en servicio)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecucion_hospitales', 'COLUMN', N'id_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Posicion 1..N dentro del ranking de la ejecucion', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecucion_hospitales', 'COLUMN', N'posicion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Score ponderado final (0-100, 2 decimales)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecucion_hospitales', 'COLUMN', N'score_total';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Porcentaje de factores activos con dato disponible para ese hospital', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecucion_hospitales', 'COLUMN', N'porcentaje_completitud';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si el hospital quedo dentro del Top N (posicion <= cantidad_solicitada). Denormalizado deliberadamente.', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecucion_hospitales', 'COLUMN', N'es_top_sugerido';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Decision del usuario sobre esta sugerencia (SugeridoSeleccionado, SugeridoRechazado, NoSugeridoSeleccionado, SinDecision)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecucion_hospitales', 'COLUMN', N'decision';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND minor_id = 9 AND name = 'MS_Description')

    EXEC sp_addextendedproperty N'MS_Description', N'Valores crudos, scores parciales, pesos y metadatos de cada factor para este hospital', 'SCHEMA', N'educacion_medica', 'TABLE', N'ranking_ejecucion_hospitales', 'COLUMN', N'factores_json';
 
-- -----------------------------------------------------------------------------
-- rutas
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'rutas')
BEGIN
    CREATE TABLE educacion_medica.[rutas] (
        [id_ruta] int IDENTITY(1,1) NOT NULL,
        [id_seleccion_mensual] int NOT NULL,
        [id_equipo] int NOT NULL,
        [version] int NOT NULL,
        [nombre] nvarchar(80) NULL,
        [estado] varchar(15) NOT NULL CONSTRAINT [DF_rutas_estado] DEFAULT ('Creada'),
        [fecha_confirmacion] datetime2(7) NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_rutas_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_rutas_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        [id_ruta_version] int NULL,
        CONSTRAINT [PK_ruta] PRIMARY KEY ([id_ruta]),
        CONSTRAINT [FK_rutas_ruta_version] FOREIGN KEY ([id_ruta_version]) REFERENCES educacion_medica.[rutas_versiones] ([id_ruta_version]),
        CONSTRAINT [FK_rutas_equipo] FOREIGN KEY ([id_equipo]) REFERENCES educacion_medica.[equipos_pareo] ([id_equipo]),
        CONSTRAINT [FK_rutas_seleccion] FOREIGN KEY ([id_seleccion_mensual]) REFERENCES educacion_medica.[selecciones_mensuales] ([id_seleccion_mensual]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas]') AND name = 'IX_rutas_seleccion_version')
    CREATE INDEX [IX_rutas_seleccion_version] ON educacion_medica.[rutas] ([id_seleccion_mensual], [version]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas]') AND name = 'IX_rutas_id_ruta_version')
    CREATE INDEX [IX_rutas_id_ruta_version] ON educacion_medica.[rutas] ([id_ruta_version]);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ruta de visitas de un equipo de pareo dentro de una seleccion mensual, versionada. Regenerar crea version N+1 y archiva la anterior. Estado separado de la seleccion: Draft -> Confirmada -> Cancelada (+ Archivada para versiones pasadas). ADR-00004.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno de la ruta', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_ruta';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Seleccion mensual planificada (universo de hospitales aprobado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_seleccion_mensual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Equipo de pareo responsable de la ruta (FK fisica equipos_pareo). El historico conserva la pareja vigente al momento', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_equipo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Version de la planificacion dentro de la seleccion (N+1 por cada regeneracion; solo la version Draft mas reciente es editable)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'version';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Nombre editable de la ruta (p. ej. Ruta Norte 01)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'nombre';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Draft (editable) | Confirmada (publica asignaciones; no editable: cancelar y regenerar) | Cancelada | Archivada (version reemplazada)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'estado';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha/hora de confirmacion de la ruta (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'fecha_confirmacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 10 AND name = 'MS_Description')

    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_usuario_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 12 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Version de rutas a la que pertenece esta fila (cabecera autorizable). rutas.estado y rutas.fecha_confirmacion se mantienen sincronizados desde la version.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_ruta_version';
 
-- -----------------------------------------------------------------------------
-- selecciones_regiones
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'selecciones_regiones')
BEGIN
    CREATE TABLE educacion_medica.[selecciones_regiones] (
        [id_region] int IDENTITY(1,1) NOT NULL,
        [id_seleccion_mensual] int NOT NULL,
        [nombre] nvarchar(80) NULL,
        [centro_latitud] decimal(10,7) NULL,
        [centro_longitud] decimal(10,7) NULL,
        [cantidad_hospitales] int NOT NULL,
        [algoritmo] varchar(50) NULL,
        [fecha_calculo] datetime2(7) NOT NULL CONSTRAINT [DF_selecciones_regiones_fecha_calculo] DEFAULT (sysutcdatetime()),
        [id_equipo] int NULL,
        [id_region_catalogo] int NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_selecciones_regiones_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_selecciones_regiones_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_seleccion_region] PRIMARY KEY ([id_region]),
        CONSTRAINT [FK_seleccion_region_region_catalogo] FOREIGN KEY ([id_region_catalogo]) REFERENCES educacion_medica.[regiones_cat] ([id_region]),
        CONSTRAINT [FK_seleccion_region_equipo] FOREIGN KEY ([id_equipo]) REFERENCES educacion_medica.[equipos_pareo] ([id_equipo]),
        CONSTRAINT [FK_seleccion_region_seleccion] FOREIGN KEY ([id_seleccion_mensual]) REFERENCES educacion_medica.[selecciones_mensuales] ([id_seleccion_mensual]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Region geografica calculada (clustering GPS deterministico sobre el snapshot de coordenadas) y persistida por seleccion mensual. La asignacion region -> equipo de pareo vive aqui. Regenerar la agrupacion reemplaza las regiones de la seleccion (hijas de un agregado en revision).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno de la region calculada', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'id_region';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Seleccion mensual a la que pertenece la region', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'id_seleccion_mensual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Nombre editable de la region (p. ej. Region Norte)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'nombre';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Latitud del centroide del cluster (para mapa y explicabilidad)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'centro_latitud';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Longitud del centroide del cluster', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'centro_longitud';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Hospitales que integran la region al momento del calculo (aviso si < 4: regla de minimo por viaje foraneo)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'cantidad_hospitales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Algoritmo y version usados (p. ej. haversine-greedy-v1); el clustering es deterministico con los mismos parametros', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'algoritmo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha/hora en que se calculo la agrupacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'fecha_calculo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 9 AND name = 'MS_Description')

    EXEC sp_addextendedproperty N'MS_Description', N'Equipo de pareo asignado a la region completa (FK fisica equipos_pareo). NULL = region sin asignar', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'id_equipo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Region de catalogo (regiones_cat) de la que proviene esta region de seleccion al agrupar por region fija. NULL = region creada manualmente (p. ej. division). La FK requiere regiones_cat (script 0010) aplicado', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'id_region_catalogo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 12 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 13 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 14 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'id_usuario_modificacion';
 
-- -----------------------------------------------------------------------------
-- selecciones_mensuales_hospitales
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'selecciones_mensuales_hospitales')
BEGIN
    CREATE TABLE educacion_medica.[selecciones_mensuales_hospitales] (
        [id_seleccion_hospital] int IDENTITY(1,1) NOT NULL,
        [id_seleccion_mensual] int NOT NULL,
        [id_hospital] int NULL,
        [region] varchar(60) NULL,
        [entidad_federativa] varchar(60) NULL,
        [ciudad_municipio] nvarchar(120) NULL,
        [producto_a_promocionar] nvarchar(150) NULL,
        [observaciones] nvarchar(300) NULL,
        [latitud_snapshot] decimal(10,7) NULL,
        [longitud_snapshot] decimal(10,7) NULL,
        [id_region] int NULL,
        [origen] varchar(20) NULL,
        [id_ranking_ejecucion] int NULL,
        [score_sugerencia] decimal(5,2) NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_sel_hospital_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_sel_hospital_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_seleccion_hospital] PRIMARY KEY ([id_seleccion_hospital]),
        CONSTRAINT [UQ_seleccion_hospital_unica] UNIQUE ([id_seleccion_mensual], [id_hospital]),
        CONSTRAINT [FK_seleccion_hospital_region] FOREIGN KEY ([id_region]) REFERENCES educacion_medica.[selecciones_regiones] ([id_region]),
        CONSTRAINT [FK_seleccion_hospital_ranking_ejecucion] FOREIGN KEY ([id_ranking_ejecucion]) REFERENCES educacion_medica.[ranking_ejecuciones] ([id_ranking_ejecucion]),
        CONSTRAINT [FK_seleccion_hospital_seleccion] FOREIGN KEY ([id_seleccion_mensual]) REFERENCES educacion_medica.[selecciones_mensuales] ([id_seleccion_mensual]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'N:M seleccion x hospital con la informacion capturada por el Ejecutivo de Ventas en el formulario FOR-004 (Anexo 1).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_seleccion_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Seleccion mensual a la que pertenece (FK educacion_medica.selecciones_mensuales)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_seleccion_mensual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Codigo del hospital; FK logica -> dbo.genContactosCat.codigoContacto (validar en servicio)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Region del hospital', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'region';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Estado (entidad federativa)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'entidad_federativa';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ciudad o municipio del hospital', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'ciudad_municipio';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Producto a promocionar en el hospital', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'producto_a_promocionar';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Observaciones de la captura', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'observaciones';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Latitud del hospital congelada al momento de agregarlo a la seleccion (snapshot; el cat�logo Asokam puede cambiar despu�s)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'latitud_snapshot';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Longitud del hospital congelada al momento de agregarlo a la seleccion (snapshot)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'longitud_snapshot';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Region calculada (por region de catalogo del hospital, o por GPS al centroide mas cercano) a la que pertenece el hospital dentro de la seleccion. FK fisica creada en script 0007. La asignacion a equipo vive a nivel region (selecciones_regiones.id_equipo), no a nivel hospital', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_region';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 12 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Origen de la asignacion de region en la agrupacion: NULL = region del hospital (hospital_extension) o agregado manual, ''GPS'' = sin region asignada y ubicado por centroide mas cercano', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'origen';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 13 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ejecucion del ranking que genero la sugerencia (FK educacion_medica.ranking_ejecuciones; constraint creada en script 0009). NULL = alta manual.', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_ranking_ejecucion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 14 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Score de prioridad del hospital al momento de aceptar la sugerencia (snapshot). NULL = alta manual.', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'score_sugerencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 15 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 16 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 17 AND name = 'MS_Description')


    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 18 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_usuario_modificacion';
 
-- -----------------------------------------------------------------------------
-- rutas_visitas
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'rutas_visitas')
BEGIN
    CREATE TABLE educacion_medica.[rutas_visitas] (
        [id_ruta_visita] int IDENTITY(1,1) NOT NULL,
        [id_ruta] int NOT NULL,
        [id_seleccion_hospital] int NULL,
        [id_hospital] int NULL,
        [fecha_visita] date NOT NULL,
        [orden] tinyint NOT NULL,
        [hora_salida] time(7) NULL,
        [hora_llegada] time(7) NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_rutas_visitas_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_rutas_visitas_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        [es_extraordinaria] bit NOT NULL CONSTRAINT [DF_rutas_visitas_extraordinaria] DEFAULT ((0)),
        CONSTRAINT [PK_ruta_visita] PRIMARY KEY ([id_ruta_visita]),
        CONSTRAINT [UQ_rutas_visitas_orden] UNIQUE ([id_ruta], [fecha_visita], [orden]),
        CONSTRAINT [FK_rutas_visitas_seleccion_hospital] FOREIGN KEY ([id_seleccion_hospital]) REFERENCES educacion_medica.[selecciones_mensuales_hospitales] ([id_seleccion_hospital]),
        CONSTRAINT [FK_rutas_visitas_ruta] FOREIGN KEY ([id_ruta]) REFERENCES educacion_medica.[rutas] ([id_ruta]) ON DELETE CASCADE
    );
END
 
-- Unicidad (id_ruta, id_seleccion_hospital) con índice filtrado (ADR-00011): las
-- visitas extraordinarias llevan id_seleccion_hospital NULL y no deben chocar
-- entre sí (un UNIQUE duro trataría los NULL como duplicados).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'UX_rutas_visitas_hospital')
    CREATE UNIQUE INDEX [UX_rutas_visitas_hospital] ON educacion_medica.[rutas_visitas] ([id_ruta], [id_seleccion_hospital]) WHERE ([id_seleccion_hospital] IS NOT NULL);
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'IX_rutas_visitas_seleccion_hospital')
    CREATE INDEX [IX_rutas_visitas_seleccion_hospital] ON educacion_medica.[rutas_visitas] ([id_seleccion_hospital]);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Visita planificada de una ruta: equipo + hospital seleccionado + fecha + posicion en el dia. Unidad de trabajo sobre la que se valida la capacidad (max 3 visitas/dia y 8/semana por persona, dias laborales Lun-Vie). ADR-00004.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno de la visita planificada', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_ruta_visita';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ruta a la que pertenece la visita', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_ruta';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Hospital SELECCIONADO de la seleccion mensual que origina la visita (trazabilidad: proviene de ese hospital aprobado). Unico por ruta (indice filtrado UX_rutas_visitas_hospital). NULL en visitas extraordinarias (ADR-00011): el hospital se identifica por id_hospital del catalogo y es_extraordinaria = 1', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_seleccion_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Hospital denormalizado para consulta directa (FK logica dbo.genContactosCat, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de la visita. Solo dias laborales Lun-Vie (v1 sin festivos); la semana de la capacidad es la semana calendario', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'fecha_visita';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Posicion de la visita dentro del dia de la ruta (1..n). El tope diario (3) es configurable y se valida en servicio', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'orden';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Hora de salida prevista (debe caer en horario laboral; opcional en v1)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'hora_salida';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Hora de llegada prevista (debe caer en horario laboral; opcional en v1)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'hora_llegada';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 9 AND name = 'MS_Description')

    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 12 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_usuario_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 13 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'1 = visita extraordinaria: hospital del catalogo (FOR-002) fuera de la seleccion autorizada, dado de alta con el modo ajuste del ADR-00010 (motivo + auditoria). No tiene estado propio; cancelarla es un ajuste BAJA_VISITA', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'es_extraordinaria';
 
-- -----------------------------------------------------------------------------
-- matrices_individuales
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'matrices_individuales')
BEGIN
    CREATE TABLE educacion_medica.[matrices_individuales] (
        [id_matriz_individual] int IDENTITY(1,1) NOT NULL,
        [id_equipo] int NOT NULL,
        [periodo] date NOT NULL,
        [es_bloqueado] bit NOT NULL CONSTRAINT [DF_matrices_individuales_bloqueado] DEFAULT ((0)),
        [fecha_bloqueo] datetime2(7) NULL,
        [fecha_desbloqueo] datetime2(7) NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_matrices_individuales_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_matrices_individuales_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_matrices_individuales] PRIMARY KEY ([id_matriz_individual]),
        CONSTRAINT [FK_matrices_individuales_equipo] FOREIGN KEY ([id_equipo]) REFERENCES educacion_medica.[equipos_pareo] ([id_equipo]),
        CONSTRAINT [UQ_matrices_individuales_equipo_periodo] UNIQUE ([id_equipo], [periodo]),
        CONSTRAINT [CK_matrices_individuales_periodo] CHECK (DAY([periodo]) = 1)
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Matriz de talleres por equipo de pareo (EV+EP) y mes (FOR-005). La captura se bloquea al generarla (es_bloqueado=1) y el GV puede reabrirla (es_bloqueado=0) mientras la matriz general siga en el paso inicial (ADR-00007).', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Equipo de pareo (EV+EP) dueno de la matriz (FK fisica educacion_medica.equipos_pareo)', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'id_equipo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Mes de la matriz (primer dia del mes; CHECK DAY(periodo) = 1)', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'periodo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'0 = captura abierta; 1 = captura bloqueada (el equipo la genero). El GV puede desbloquearla (reabrir captura)', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'es_bloqueado';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ultimo bloqueo de la captura (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'fecha_bloqueo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ultima reapertura de la captura por el GV (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'fecha_desbloqueo';

-- -----------------------------------------------------------------------------
-- matrices_generales
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'matrices_generales')
BEGIN
    CREATE TABLE educacion_medica.[matrices_generales] (
        [id_matriz_general] int IDENTITY(1,1) NOT NULL,
        [id_tipo_gerencia] int NOT NULL,
        [periodo] date NOT NULL,
        [id_workflow] int NULL,
        [id_paso_actual] int NULL,
        [id_estado] int NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_matrices_generales_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_matrices_generales_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_matrices_generales] PRIMARY KEY ([id_matriz_general]),
        CONSTRAINT [FK_matrices_generales_tipo_gerencia] FOREIGN KEY ([id_tipo_gerencia]) REFERENCES educacion_medica.[tipo_gerencia] ([id_tipo_gerencia]),
        CONSTRAINT [UQ_matrices_generales_gerencia_periodo] UNIQUE ([id_tipo_gerencia], [periodo]),
        CONSTRAINT [CK_matrices_generales_periodo] CHECK (DAY([periodo]) = 1)
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Matriz general de talleres por gerencia (IMSS/Descentralizado) y mes: es la entidad autorizable del workflow EDUCACION_MEDICA_MATRIZ (GV -> costos AEM -> CA -> DC). No tiene estado propio: su estado es el del motor (id_estado). Nace automaticamente con el primer taller capturado de la gerencia/mes (ADR-00007).', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Gerencia de la matriz (FK fisica educacion_medica.tipo_gerencia: IMSS | Descentralizado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'id_tipo_gerencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Mes de la matriz (primer dia del mes; CHECK DAY(periodo) = 1)', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'periodo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Workflow asignado (FK logica -> config.workflows; variante resuelta por TIPO_GERENCIA)', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'id_workflow';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Paso actual del workflow (FK logica -> config.workflow_pasos)', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'id_paso_actual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Estado actual del workflow (FK logica -> config.workflow_estados). CREADA = paso inicial editable (patron OC/Solicitudes)', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'id_estado';

-- -----------------------------------------------------------------------------
-- talleres
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'talleres')
BEGIN
    CREATE TABLE educacion_medica.[talleres] (
        [id_taller] int IDENTITY(1,1) NOT NULL,
        [id_seleccion_hospital] int NULL,
        [id_hospital] int NULL,
        [region] varchar(60) NULL,
        [entidad_federativa] varchar(60) NULL,
        [ciudad_municipio] nvarchar(160) NULL,
        [numero_participantes] int NULL,
        [id_ejecutivo] int NULL,
        [id_especialista] int NULL,
        [unidad_medica] nvarchar(160) NULL,
        [lugar] nvarchar(200) NULL,
        [fecha_taller] date NULL,
        [hora_taller] time(0) NULL,
        [requiere_equipo_proyeccion] bit NULL,
        [tipo_equipo_proyeccion] varchar(10) NULL,
        [estado] varchar(15) NOT NULL CONSTRAINT [DF_talleres_estado] DEFAULT ('Creada'),
        [observaciones] nvarchar(500) NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_talleres_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_talleres_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_talleres_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        [id_matriz_individual] int NULL,
        [id_matriz_general] int NULL,
        [fecha_realizado] date NULL,
        [es_extraordinario] bit NOT NULL CONSTRAINT [DF_talleres_extraordinario] DEFAULT ((0)),
        [motivo_extraordinario] nvarchar(500) NULL,
        CONSTRAINT [PK_taller] PRIMARY KEY ([id_taller]),
        CONSTRAINT [FK_talleres_seleccion_hospital] FOREIGN KEY ([id_seleccion_hospital]) REFERENCES educacion_medica.[selecciones_mensuales_hospitales] ([id_seleccion_hospital]),
        CONSTRAINT [FK_talleres_matriz_individual] FOREIGN KEY ([id_matriz_individual]) REFERENCES educacion_medica.[matrices_individuales] ([id_matriz_individual]),
        CONSTRAINT [FK_talleres_matriz_general] FOREIGN KEY ([id_matriz_general]) REFERENCES educacion_medica.[matrices_generales] ([id_matriz_general])
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'IX_talleres_id_matriz_individual')
    CREATE INDEX [IX_talleres_id_matriz_individual] ON educacion_medica.[talleres] ([id_matriz_individual]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'IX_talleres_id_matriz_general')
    CREATE INDEX [IX_talleres_id_matriz_general] ON educacion_medica.[talleres] ([id_matriz_general]);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Aggregate root "Matriz del Taller" (FOR-005); el state machine se valida en servicio y se refleja en estado; vincula con la seleccion mensual que le dio origen.', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Origen del taller en la seleccion mensual del hospital (FK educacion_medica.selecciones_mensuales_hospitales, ON DELETE NO ACTION)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_seleccion_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Codigo del hospital; FK logica -> genContactosCat.codigoContacto (validar en servicio)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_hospital';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Region del hospital', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'region';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Estado (entidad federativa) del formulario', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'entidad_federativa';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ciudad o municipio del hospital', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'ciudad_municipio';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Numero de participantes estimados', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'numero_participantes';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Codigo del Ejecutivo de Ventas; FK logica -> app.Usuarios (Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_ejecutivo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Codigo del Especialista de producto (FOR-006); FK logica -> app.Usuarios (Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_especialista';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Unidad medica / hospital (FOR-008)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'unidad_medica';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Lugar donde se imparte el taller', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'lugar';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 12 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha programada del taller (dd/mm/aaaa)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'fecha_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 13 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Hora programada del taller', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'hora_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 14 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si se requiere llevar equipo de proyeccion', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'requiere_equipo_proyeccion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 15 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Propio | Rentado (aplica si se requiere equipo)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'tipo_equipo_proyeccion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 16 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Estado del taller: Creada/Elaborado/Revisado/Autorizado/Programado/EnCurso/Realizado/Cancelado', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'estado';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 17 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Observaciones generales del taller', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'observaciones';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 18 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Indica si el registro esta activo', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'activo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 19 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 20 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 21 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 22 AND name = 'MS_Description')

    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_usuario_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 23 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Matriz individual (equipo + mes) a la que pertenece el taller (FK fisica educacion_medica.matrices_individuales, ON DELETE NO ACTION)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_matriz_individual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 24 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Matriz general (gerencia + mes) a la que pertenece el taller (FK fisica educacion_medica.matrices_generales, ON DELETE NO ACTION)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_matriz_general';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 25 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha real de cierre del taller (estado Realizado); alimenta indicadores y cobertura_taller del ranking (ADR-00008 decision 8)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'fecha_realizado';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 26 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'1 = taller extraordinario (ADR-00011): hospital del catalogo fuera de la seleccion (id_seleccion_hospital NULL), exige equipo y motivo_extraordinario, nace en estado Programado y cuenta para la meta mensual y el ranking', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'es_extraordinario';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 27 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Motivo obligatorio del taller extraordinario (imprevisto operativo que lo origina)', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'motivo_extraordinario';
  
-- -----------------------------------------------------------------------------
-- taller_estados_historial (ADR-00008, revisión 2026-10-09 — decisión 12)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_estados_historial')
BEGIN
    CREATE TABLE educacion_medica.[taller_estados_historial] (
        [id_historial]     int IDENTITY(1,1) NOT NULL,
        [id_taller]        int NOT NULL,
        [estado_anterior]  varchar(15) NULL,
        [estado_nuevo]     varchar(15) NOT NULL,
        [origen]           varchar(12) NOT NULL,
        [motivo]           nvarchar(500) NULL,
        [id_usuario]       int NULL,
        [fecha]            datetime2(7) NOT NULL CONSTRAINT [DF_taller_estados_historial_fecha] DEFAULT (SYSDATETIME()),
        [datos_json]       nvarchar(max) NULL,
        CONSTRAINT [PK_taller_estado_historial] PRIMARY KEY ([id_historial]),
        CONSTRAINT [CK_taller_estados_historial_origen] CHECK ([origen] IN ('Automatico','Manual')),
        CONSTRAINT [FK_taller_estados_historial_taller] FOREIGN KEY ([id_taller]) REFERENCES educacion_medica.[talleres] ([id_taller]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND name = 'IX_taller_estados_historial_taller')
    CREATE INDEX [IX_taller_estados_historial_taller] ON educacion_medica.[taller_estados_historial] ([id_taller], [fecha]);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Historial de transiciones de la maquina de estados del taller (ADR-00008, revision 2026-10-09): cada cambio de estado registra quien, cuando, origen (Automatico/Manual) y motivo. Eventos inmutables; talleres.estado conserva el estado actual.', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_estados_historial';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno del evento de transicion', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_estados_historial', 'COLUMN', N'id_historial';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Taller al que pertenece la transicion (FK educacion_medica.talleres)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_estados_historial', 'COLUMN', N'id_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Estado previo del taller (NULL en el primer evento, p. ej. taller extraordinario que nace Programado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_estados_historial', 'COLUMN', N'estado_anterior';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Estado al que transita el taller: Creada/Autorizado/Programado/EnCurso/Realizado/Cancelado', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_estados_historial', 'COLUMN', N'estado_nuevo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Automatico (lo escribe el sistema, p. ej. cierre de matriz -> Programado) | Manual (accion del usuario)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_estados_historial', 'COLUMN', N'origen';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Motivo de la transicion (obligatorio en cancelaciones)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_estados_historial', 'COLUMN', N'motivo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que ejecuta la transicion (NULL cuando es Automatico); FK logica -> app.Usuarios (Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_estados_historial', 'COLUMN', N'id_usuario';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha y hora de la transicion (hora local del servidor)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_estados_historial', 'COLUMN', N'fecha';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_estados_historial]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Datos extra del evento en JSON (opcional; absorbe crecimiento sin migrar esquema)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_estados_historial', 'COLUMN', N'datos_json';
 
-- -----------------------------------------------------------------------------
-- taller_asistencias
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_asistencias')
BEGIN
    CREATE TABLE educacion_medica.[taller_asistencias] (
        [id_asistencia] int IDENTITY(1,1) NOT NULL,
        [id_taller] int NOT NULL,
        [numero] tinyint NOT NULL,
        [nombre_medico] nvarchar(150) NOT NULL,
        [cedula_profesional] varchar(30) NULL,
        [puesto_medico] nvarchar(120) NULL,
        [telefono_celular] varchar(30) NULL,
[correo_electronico] varchar(150) NULL,
[observaciones] nvarchar(300) NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_taller_asistencias_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_taller_asistencias_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_taller_asistencia] PRIMARY KEY ([id_asistencia]),
        CONSTRAINT [UQ_taller_asistencia_numero] UNIQUE ([id_taller], [numero]),
        CONSTRAINT [FK_taller_asistencia_taller] FOREIGN KEY ([id_taller]) REFERENCES educacion_medica.[talleres] ([id_taller]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Lista de medicos asistentes al taller (hasta 20, FOR-008).', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'id_asistencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Taller al que pertenece (FK educacion_medica.talleres)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'id_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Numero en lista (1-20)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'numero';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Nombre del medico', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'nombre_medico';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Cedula profesional', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'cedula_profesional';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Puesto del medico (p.ej. jefe de anestesiologia)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'puesto_medico';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Telefono celular de contacto', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'telefono_celular';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Correo del medico', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'correo_electronico';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 9 AND name = 'MS_Description')
EXEC sp_addextendedproperty N'MS_Description', N'Medico lider (+/-) y otras observaciones', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'observaciones';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 10 AND name = 'MS_Description')


EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 11 AND name = 'MS_Description')
EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 12 AND name = 'MS_Description')
EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND minor_id = 13 AND name = 'MS_Description')
EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_asistencias', 'COLUMN', N'id_usuario_modificacion';
-- -----------------------------------------------------------------------------
-- taller_evidencias
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_evidencias')
BEGIN
    CREATE TABLE educacion_medica.[taller_evidencias] (
        [id_evidencia] int IDENTITY(1,1) NOT NULL,
        [id_taller] int NOT NULL,
        [tipo_evidencia] varchar(10) NOT NULL,
        [archivo_url] nvarchar(500) NOT NULL,
        [descripcion] nvarchar(300) NULL,
        [fecha_evidencia] date NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_taller_evidencias_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_taller_evidencias_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_taller_evidencia] PRIMARY KEY ([id_evidencia]),
        CONSTRAINT [FK_taller_evidencia_taller] FOREIGN KEY ([id_taller]) REFERENCES educacion_medica.[talleres] ([id_taller]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fotos/video/documentos post-taller (1:N); archivo_url apunta al recurso estatico (wwwroot/media/...).', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias', 'COLUMN', N'id_evidencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Taller al que pertenece (FK educacion_medica.talleres)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias', 'COLUMN', N'id_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'foto | video | documento', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias', 'COLUMN', N'tipo_evidencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ruta al recurso estatico (wwwroot/media/...)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias', 'COLUMN', N'archivo_url';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Descripcion de la evidencia', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias', 'COLUMN', N'descripcion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha en que se tomo/capturo la evidencia', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias', 'COLUMN', N'fecha_evidencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_evidencias', 'COLUMN', N'id_usuario_modificacion';
 
-- -----------------------------------------------------------------------------
-- taller_materiales
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_materiales')
BEGIN
    CREATE TABLE educacion_medica.[taller_materiales] (
        [id_taller_material] int IDENTITY(1,1) NOT NULL,
        [id_taller] int NOT NULL,
        [fecha_entrega] date NULL,
        [cargo_puesto] nvarchar(120) NULL,
        [nombre_producto] nvarchar(160) NULL,
        [cantidad_producto] int NULL,
        [incluye_lista_asistencia] bit NULL,
        [incluye_flayers] bit NULL,
        [incluye_equipo_computo] bit NULL,
        [incluye_proyector] bit NULL,
        [incluye_dulces] bit NULL,
        [incluye_modelo_anatomico] bit NULL,
        [nombre_ejecutivo_recepcion] nvarchar(200) NULL,
        [observaciones] nvarchar(500) NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_taller_materiales_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_taller_materiales_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        [firma_url] nvarchar(500) NULL,
        [fecha_recepcion] datetime2(7) NULL,
        [id_usuario_recepcion] int NULL,
        CONSTRAINT [PK_taller_material] PRIMARY KEY ([id_taller_material]),
        CONSTRAINT [UQ_taller_material_id_taller] UNIQUE ([id_taller]),
        CONSTRAINT [FK_taller_material_taller] FOREIGN KEY ([id_taller]) REFERENCES educacion_medica.[talleres] ([id_taller]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Solicitud y entrega de material (FOR-007); 1:1 con talleres garantizada por UNIQUE (id_taller): paquete de material del taller.', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'id_taller_material';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Taller al que pertenece (FK educacion_medica.talleres; UNIQUE, relacion 1:1)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'id_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha del formato FOR-007', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'fecha_entrega';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Cargo/puesto del ejecutivo que entrega', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'cargo_puesto';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Nombre del producto solicitado', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'nombre_producto';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Cantidad de producto', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'cantidad_producto';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Incluye lista de asistencia (SI/NO)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'incluye_lista_asistencia';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Incluye flyers/folletos (SI/NO)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'incluye_flayers';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Incluye equipo de computo (SI/NO)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'incluye_equipo_computo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Incluye proyector (SI/NO)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'incluye_proyector';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Incluye dulces (SI/NO)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'incluye_dulces';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 12 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Incluye modelo anatomico (SI/NO)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'incluye_modelo_anatomico';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 13 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Nombre y firma del ejecutivo que recibe', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'nombre_ejecutivo_recepcion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 14 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Observaciones de la solicitud/entrega', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'observaciones';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 15 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 16 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 17 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 18 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'id_usuario_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 19 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Firma digital del EV al confirmar la recepcion del material (patron bitacora del motor; ADR-00008 decision 2)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'firma_url';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 20 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha y hora de la confirmacion de recepcion del material por el EV', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'fecha_recepcion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_materiales]') AND minor_id = 21 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario (EV) que confirma la recepcion del material; FK logica -> app.Usuarios (Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_materiales', 'COLUMN', N'id_usuario_recepcion';
 
-- -----------------------------------------------------------------------------
-- taller_recursos
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_recursos')
BEGIN
    CREATE TABLE educacion_medica.[taller_recursos] (
        [id_taller_recurso] int IDENTITY(1,1) NOT NULL,
        [id_taller] int NOT NULL,
        [tipo_recurso] varchar(15) NOT NULL,
        [id_producto] varchar(50) NULL,
        [descripcion] nvarchar(200) NULL,
        [tipo_envio] varchar(10) NULL,
        [cantidad] int NULL,
        [costo_unitario] decimal(18,2) NULL,
        [subtotal] decimal(18,2) NULL,
        [observaciones] nvarchar(300) NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_taller_recursos_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_taller_recursos_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_taller_recurso] PRIMARY KEY ([id_taller_recurso]),
        CONSTRAINT [FK_taller_recurso_taller] FOREIGN KEY ([id_taller]) REFERENCES educacion_medica.[talleres] ([id_taller]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Recursos polimorficos del taller (FOR-005 "Costo por Recurso"): muestras/producto, folletos, envio y box lunch; una fila por tipo.', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'id_taller_recurso';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Taller al que pertenece el recurso (FK educacion_medica.talleres)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'id_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Producto (muestras) | Folleto | Envio | BoxLunch', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'tipo_recurso';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Codigo del producto; FK logica -> genProductosCat (solo para tipo Producto)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'id_producto';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Texto libre (proveedor/notas)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'descripcion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Para tipo Envio: Interno | Externo', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'tipo_envio';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Piezas (producto/folleto) o numero de servicios (box lunch)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'cantidad';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Costo unitario $MXN (folleto/envio/box) o costo del producto', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'costo_unitario';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Cantidad x costo_unitario; lo calcula el servicio', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'subtotal';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 10 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Observaciones del recurso', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'observaciones';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 11 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 12 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 13 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND minor_id = 14 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_recursos', 'COLUMN', N'id_usuario_modificacion';

-- -----------------------------------------------------------------------------
-- ajustes_post_cierre (ADR-00010 — bitácora de ajustes sobre documentos cerrados)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'ajustes_post_cierre')
BEGIN
    CREATE TABLE educacion_medica.[ajustes_post_cierre] (
        [id_ajuste]        int IDENTITY(1,1) NOT NULL,
        [entidad_tipo]     varchar(20) NOT NULL,
        [id_entidad]       int NOT NULL,
        [accion]           varchar(30) NOT NULL,
        [valores_antes]    nvarchar(max) NULL,
        [valores_despues]  nvarchar(max) NULL,
        [motivo]           nvarchar(500) NOT NULL,
        [id_usuario]       int NOT NULL,
        [fecha_ajuste]     datetime2(7) NOT NULL CONSTRAINT [DF_ajustes_post_cierre_fecha] DEFAULT (SYSDATETIME()),
        CONSTRAINT [PK_ajuste_post_cierre] PRIMARY KEY ([id_ajuste]),
        CONSTRAINT [CK_ajustes_post_cierre_entidad] CHECK ([entidad_tipo] IN ('RUTA_VISITA','RUTA_VERSION','TALLER')),
        CONSTRAINT [CK_ajustes_post_cierre_accion] CHECK ([accion] IN ('MOVER_VISITA','EDITAR_HORAS','ALTA_VISITA','BAJA_VISITA','EDITAR_TALLER','CANCELAR_VERSION'))
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND name = 'IX_ajustes_post_cierre_entidad')
    CREATE INDEX [IX_ajustes_post_cierre_entidad] ON educacion_medica.[ajustes_post_cierre] ([entidad_tipo], [id_entidad]);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Bitacora de ajustes post-cierre (ADR-00010): cambios puntuales de fecha/hora/logistica sobre rutas Cerrada y talleres Autorizado/Programado, sin re-ejecutar el workflow ni firma. Permiso exclusivo del CEM + motivo obligatorio; valores antes/despues en JSON. Tambien audita la cancelacion de version (CANCELAR_VERSION).', 'SCHEMA', N'educacion_medica', 'TABLE', N'ajustes_post_cierre';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno del ajuste', 'SCHEMA', N'educacion_medica', 'TABLE', N'ajustes_post_cierre', 'COLUMN', N'id_ajuste';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Tipo de entidad ajustada: RUTA_VISITA | RUTA_VERSION | TALLER', 'SCHEMA', N'educacion_medica', 'TABLE', N'ajustes_post_cierre', 'COLUMN', N'entidad_tipo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Id de la entidad ajustada (id_ruta_visita, id_ruta_version o id_taller segun entidad_tipo; FK logica polimorfica, sin constraint fisico)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ajustes_post_cierre', 'COLUMN', N'id_entidad';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Accion aplicada: MOVER_VISITA | EDITAR_HORAS | ALTA_VISITA | BAJA_VISITA | EDITAR_TALLER | CANCELAR_VERSION', 'SCHEMA', N'educacion_medica', 'TABLE', N'ajustes_post_cierre', 'COLUMN', N'accion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Valores previos en JSON (los campos ajustables son heterogeneos: fecha, orden, horas, participantes)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ajustes_post_cierre', 'COLUMN', N'valores_antes';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Valores posteriores al ajuste en JSON', 'SCHEMA', N'educacion_medica', 'TABLE', N'ajustes_post_cierre', 'COLUMN', N'valores_despues';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Motivo obligatorio del ajuste', 'SCHEMA', N'educacion_medica', 'TABLE', N'ajustes_post_cierre', 'COLUMN', N'motivo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que ejecuta el ajuste (CEM con permiso de ajuste); FK logica -> app.Usuarios (Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ajustes_post_cierre', 'COLUMN', N'id_usuario';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ajustes_post_cierre]') AND minor_id = 9 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha y hora del ajuste (hora local del servidor)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ajustes_post_cierre', 'COLUMN', N'fecha_ajuste';
 
-- -----------------------------------------------------------------------------
-- taller_solicitudes_cambio (ADR-00010, decisiones 13-15)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_solicitudes_cambio')
BEGIN
    CREATE TABLE educacion_medica.[taller_solicitudes_cambio] (
        [id_solicitud]             int IDENTITY(1,1) NOT NULL,
        [id_taller]                int NOT NULL,
        [estado]                   varchar(15) NOT NULL CONSTRAINT [DF_taller_solicitudes_cambio_estado] DEFAULT ('Pendiente'),
        [datos_json]               nvarchar(max) NULL,
        [fecha_creacion]           datetime2(7) NOT NULL CONSTRAINT [DF_taller_solicitudes_cambio_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion]       datetime2(7) NOT NULL CONSTRAINT [DF_taller_solicitudes_cambio_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion]      int NULL,
        [id_usuario_modificacion]  int NULL,
        CONSTRAINT [PK_taller_solicitud_cambio] PRIMARY KEY ([id_solicitud]),
        CONSTRAINT [CK_taller_solicitudes_cambio_estado] CHECK ([estado] IN ('Pendiente','Aprobada','Rechazada','Cancelada')),
        CONSTRAINT [FK_taller_solicitudes_cambio_taller] FOREIGN KEY ([id_taller]) REFERENCES educacion_medica.[talleres] ([id_taller]) ON DELETE CASCADE
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND name = 'IX_taller_solicitudes_cambio_taller')
    CREATE INDEX [IX_taller_solicitudes_cambio_taller] ON educacion_medica.[taller_solicitudes_cambio] ([id_taller]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND name = 'IX_taller_solicitudes_cambio_estado')
    CREATE INDEX [IX_taller_solicitudes_cambio_estado] ON educacion_medica.[taller_solicitudes_cambio] ([estado]);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Solicitudes de cambio del equipo sobre un taller bloqueado o fuera de captura (ADR-00010 decisiones 13-15). El cambio (valores antes/despues, motivos y actores) va en datos_json; el CEM resuelve desde la Matriz General. Al aprobar se aplica la misma logica del ajuste post-cierre.', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno de la solicitud', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'id_solicitud';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Taller sobre el que se pide el cambio (FK educacion_medica.talleres)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'id_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ciclo de la solicitud: Pendiente | Aprobada | Rechazada | Cancelada', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'estado';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 4 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Contenido del cambio en JSON: valores antes/despues, motivo del solicitante, motivo de resolucion y actores', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'datos_json';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 5 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de creacion del registro (UTC)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'fecha_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 6 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha de ultima modificacion (UTC); se actualiza al resolver', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'fecha_modificacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 7 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que crea la solicitud (integrante del equipo o CEM en captura asistida); FK logica -> app.Usuarios (Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'id_usuario_creacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 8 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario que resuelve la solicitud (CEM); FK logica -> app.Usuarios (Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'id_usuario_modificacion';

-- -----------------------------------------------------------------------------
-- CHECK constraints (integrados del esquema vigente)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[config_ranking_factores]') AND name = 'CK_config_ranking_factores_peso')
    ALTER TABLE educacion_medica.[config_ranking_factores] ADD CONSTRAINT [CK_config_ranking_factores_peso] CHECK ([peso]>=(0));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND name = 'CK_equipos_pareo_vigencia')
    ALTER TABLE educacion_medica.[equipos_pareo] ADD CONSTRAINT [CK_equipos_pareo_vigencia] CHECK ([fecha_fin] IS NULL OR [fecha_fin]>=[fecha_inicio]);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[programas_anuales]') AND name = 'CK_programas_anuales_periodo')
    ALTER TABLE educacion_medica.[programas_anuales] ADD CONSTRAINT [CK_programas_anuales_periodo] CHECK ([periodo_inicio]>=(1) AND [periodo_inicio]<=(12) AND ([periodo_fin]>=(1) AND [periodo_fin]<=(12)));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[ranking_ejecucion_hospitales]') AND name = 'CK_ejecucion_hospital_decision')
    ALTER TABLE educacion_medica.[ranking_ejecucion_hospitales] ADD CONSTRAINT [CK_ejecucion_hospital_decision] CHECK ([decision]='SinDecision' OR [decision]='NoSugeridoSeleccionado' OR [decision]='SugeridoRechazado' OR [decision]='SugeridoSeleccionado');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[rutas]') AND name = 'CK_rutas_estado')
    ALTER TABLE educacion_medica.[rutas] ADD CONSTRAINT [CK_rutas_estado] CHECK ([estado]='Archivada' OR [estado]='Cancelada' OR [estado]='Rechazada' OR [estado]='Cerrada' OR [estado]='Creada');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[rutas]') AND name = 'CK_rutas_version')
    ALTER TABLE educacion_medica.[rutas] ADD CONSTRAINT [CK_rutas_version] CHECK ([version]>(0));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[rutas_versiones]') AND name = 'CK_rutas_versiones_estado')
    ALTER TABLE educacion_medica.[rutas_versiones] ADD CONSTRAINT [CK_rutas_versiones_estado] CHECK ([estado]='Archivada' OR [estado]='Cancelada' OR [estado]='Rechazada' OR [estado]='Cerrada' OR [estado]='Creada');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[rutas_versiones]') AND name = 'CK_rutas_versiones_version')
    ALTER TABLE educacion_medica.[rutas_versiones] ADD CONSTRAINT [CK_rutas_versiones_version] CHECK ([version]>(0));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'CK_rutas_visitas_orden')
    ALTER TABLE educacion_medica.[rutas_visitas] ADD CONSTRAINT [CK_rutas_visitas_orden] CHECK ([orden]>=(1));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[selecciones_mensuales]') AND name = 'CK_selecciones_mensuales_estado')
    ALTER TABLE educacion_medica.[selecciones_mensuales] ADD CONSTRAINT [CK_selecciones_mensuales_estado] CHECK ([estado]='Creada' OR [estado]='EnRevision' OR [estado]='Cerrada' OR [estado]='Rechazada' OR [estado]='Cancelada');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND name = 'CK_selecciones_regiones_cantidad')
    ALTER TABLE educacion_medica.[selecciones_regiones] ADD CONSTRAINT [CK_selecciones_regiones_cantidad] CHECK ([cantidad_hospitales]>(0));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[taller_asistencias]') AND name = 'CK_taller_asistencia_numero')
    ALTER TABLE educacion_medica.[taller_asistencias] ADD CONSTRAINT [CK_taller_asistencia_numero] CHECK ([numero]>=(1) AND [numero]<=(20));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[taller_evidencias]') AND name = 'CK_taller_evidencia_tipo')
    ALTER TABLE educacion_medica.[taller_evidencias] ADD CONSTRAINT [CK_taller_evidencia_tipo] CHECK ([tipo_evidencia]='documento' OR [tipo_evidencia]='video' OR [tipo_evidencia]='foto');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[taller_recursos]') AND name = 'CK_taller_recurso_tipo')
    ALTER TABLE educacion_medica.[taller_recursos] ADD CONSTRAINT [CK_taller_recurso_tipo] CHECK ([tipo_recurso]='BoxLunch' OR [tipo_recurso]='Envio' OR [tipo_recurso]='Folleto' OR [tipo_recurso]='Producto');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'CK_talleres_estado')
    ALTER TABLE educacion_medica.[talleres] ADD CONSTRAINT [CK_talleres_estado] CHECK ([estado]='Cancelado' OR [estado]='Realizado' OR [estado]='EnCurso' OR [estado]='Programado' OR [estado]='Autorizado' OR [estado]='Revisado' OR [estado]='Elaborado' OR [estado]='Creada');

-- -----------------------------------------------------------------------------
-- vw_hospitales_clasificados (script historico 0004)
--   Vista cross-DB (Asokam) con hospitales + institucion derivada de la
--   jerarquia codigoContactoPrincipal (364=IMSS, 385=Bienestar, 370=ISSSTE).
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.views WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'vw_hospitales_clasificados')
BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'
    CREATE VIEW educacion_medica.vw_hospitales_clasificados AS
    SELECT
        g.codigoContacto,
        g.nombreContacto,
        g.nombreCorto,
        g.tipo,
        g.activo,
        g.ciudad,
        g.codigoEstado,
        e.nombreEstado,
        g.latitud,
        g.longitud,
        g.clues,
        g.codigoContactoPrincipal,
        p.nombreContacto AS nombre_padre,
        CASE
            WHEN g.codigoContacto = 364 OR g.codigoContactoPrincipal = 364 THEN ''IMSS''
            WHEN g.codigoContacto = 385 OR g.codigoContactoPrincipal = 385 THEN ''Bienestar''
            WHEN g.codigoContacto = 370 OR g.codigoContactoPrincipal = 370 THEN ''ISSSTE''
            WHEN g.tipo = ''Gobierno''    THEN ''Descentralizado''
            WHEN g.tipo = ''Privado''     THEN ''Privado''
            WHEN g.tipo = ''Distribuidor'' THEN ''Distribuidor''
            ELSE ''Sin clasificar''
        END AS institucion
    FROM Asokam.dbo.genContactosCat g
    LEFT JOIN Asokam.dbo.genContactosCat p
        ON p.codigoContacto = g.codigoContactoPrincipal
    LEFT JOIN Asokam.dbo.genEstadosCat e
        ON e.codigoEstado = TRY_CAST(g.codigoEstado AS INT);';
    EXEC sp_executesql @sql;
    PRINT 'Vista [educacion_medica].[vw_hospitales_clasificados] creada.';
END
ELSE
BEGIN
    PRINT 'Vista [educacion_medica].[vw_hospitales_clasificados] ya existe. Skip.';
END

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.vw_hospitales_clasificados')
      AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Vista cross-DB (Asokam) con hospitales + institucion derivada de la jerarquia codigoContactoPrincipal (364=IMSS, 385=Bienestar, 370=ISSSTE). Para el modulo Educacion Medica.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'VIEW',  @level1name = N'vw_hospitales_clasificados';

PRINT '0016: esquema educacion_medica verificado/creado.';
