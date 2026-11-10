
-- ===================== 00_header.sql =====================
/* =============================================================================
   INSTALACIÓN DE EDUCACIÓN MÉDICA EN PRODUCCIÓN (Lefarma)
   Generado: 2026-11-09
   -----------------------------------------------------------------------------
   QUÉ HACE
     Instala el módulo completo de Educación Médica en una base Lefarma que ya
     tiene la plataforma (config/app) pero NO el módulo:
       1) 0016  esquema completo (tablas, índices, FKs, checks, descripciones)
       2) reconciliación de las 4 tablas que ya existían en producción
          (hospital_extension, parametros_anestesias, programas_anuales,
          tipo_gerencia): agrega las columnas que 0016 no puede agregar porque
          la tabla ya existía.
       3) 0030  catálogos base y backfills (hospitales desde Asokam)
       4) 0035  catálogos de calendario (tipo_visita, tema_taller) y parámetros
       5) 0018  workflows de selección, rutas y matriz
       6) 0040  reparación de mappings y matrices huérfanas
       7) 0041  columnas de depuración de hospitales (mostrar_educacion_medica,
                motivo_clasificacion, requiere_revision, clasificacion_manual)
       8) 0042  clasificación de datos de hospitales
       9) 0043  verificación de la depuración (solo SELECT)

   REQUISITOS
     - Base destino: Lefarma (producción), servidor 192.168.4.2.
     - Acceso READ a Asokam para 0030 y 0042 (backfill de hospitales).
     - Ejecutar con sqlcmd (los scripts usan GO y lotes):
         sqlcmd -S 192.168.4.2 -d Lefarma -C -f 65001 -i 0001_install_educacion_medica_prod.sql
     - El visor del panel divide por ";", NO uses el panel para este archivo.

   SEGURIDAD / ROLLBACK
     - Es idempotente: guards IF NOT EXISTS / COL_LENGTH en todo el esquema.
     - No borra datos de producción: 0030 y 0042 solo insertan/actualizan
       hospital_extension y catálogos del módulo.
     - 0041 crea un respaldo: educacion_medica.hospital_extension_backup_20261107.
     - Rollback completo (solo si se decide desinstalar):
         DROP SCHEMA educacion_medica (previo respaldo); no lo ejecutes sin
         revisar dependencias de config.workflow_* creadas por 0018.

   ADVERTENCIA
     - 0018 modifica config.workflow_* (crea workflows de EDUCACION_MEDICA y
       agrega config.workflow_pasos.permite_editar). Es idempotente.
     - Revisar el resultado de 0043 antes de habilitar el módulo a usuarios.
   ============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

PRINT '=== INSTALACION EDUCACION MEDICA: inicio ===';
GO


-- ===================== 0016_20261007-1200_educacion-medica_create-esquema-completo.lefarma.sql =====================
-- =============================================================================
-- 0016 — Esquema COMPLETO de educacion_medica (instalación limpia)
-- ADR: lefarma.docs/educacion-medica/decisiones/00001, 00004, 00006, 00007,
--      00008 (impartición), 00010 (ajustes post-cierre), 00011 (extraordinarios)
--      y 00015 (reparto por ejecutivo / rutas por especialista).
--
-- QUÉ HACE
--   Crea TODAS las tablas del módulo de Educación Médica con sus columnas
--   FINALES (sin ALTERs posteriores), índices, FKs, checks y MS_Description:
--     catálogos      : tipo_gerencia, regiones_cat, regiones_estados, parametros_anestesias
--     programa anual : programas_anuales, programas_anuales_detalles
--     hospitales     : hospital_extension
--     selección      : selecciones_mensuales, selecciones_mensuales_hospitales, selecciones_regiones
--     personas       : ejecutivo_region, ejecutivo_suplente, especialista_gerencia, especialista_region
--     equipos        : equipos_pareo (histórico; ADR-00015)
--     rutas          : rutas, rutas_visitas, rutas_versiones
--     talleres       : talleres (incluye id_tipo_visita = tipo de taller, tema e
--                      id_ruta_version), taller_recursos, taller_materiales,
--                      taller_asistencias, taller_evidencias, taller_estados_historial
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
--   vienen en cada CREATE TABLE). Además integra el modelo de ADR-00015
--   (scripts 0033 y 0038) y los cambios de esquema de 0039 (tema libre),
--   0041 (tipo de taller), 0042 (matriz -> versión de rutas) y 0043 (sin
--   columnas de workflow en rutas_versiones), para que una instalación limpia
--   nazca con reparto por ejecutivo, rutas por especialista, ejecutivos
--   suplentes (sin vigencia) y catálogos de personas.
--   taller_aprobaciones ya NO se crea (la eliminó el ADR-00008: la bitácora
--   del motor cubre las firmas).
--
-- CÓMO USAR (entorno NUEVO / desde cero)
--   1) 0016  (este script)  — esquema completo (incluye el modelo de ADR-00015)
--   2) 0030                 — catálogos y backfills (solo Lefarma, sin Asokam)
--   3) 0035                 — catálogos de calendario y parámetros
--   4) 0018                 — workflows de selección, rutas y matriz
--   5) 0037                 — limpieza opcional (manual/educacion-medica)
--   En una BD nueva no es necesario ejecutar 0034, 0036, 0038, 0039, 0041,
--   0042, 0043, 0044, 0045 ni 0046: ya están integrados en
--   0016/0030/0035/0018 (y son idempotentes si el migrador los ejecuta).
--   Esos scripts se movieron a legacy/educacion-medica como referencia.
--   Para BD ya existentes: 0033 (reparto ejecutivo/especialista), 0034+
--   (tercera gerencia, calendario, candado) según las tareas 00015–00018.
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
        [tipo] varchar(20) NOT NULL CONSTRAINT [DF_parametros_modulo_tipo] DEFAULT ('numero'),
        [valor_texto] nvarchar(100) NULL,
        [descripcion] nvarchar(200) NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_parametros_modulo_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_parametros_modulo_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_parametros_modulo_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_parametro_modulo] PRIMARY KEY ([clave]),
        CONSTRAINT [CK_parametros_modulo_tipo] CHECK ([tipo] IN ('numero', 'booleano', 'texto', 'enum'))
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Parametros configurables del modulo Educacion Medica (clave/valor/tipo). Consumidos por reparto, rutas, calendario, metas y autorización (ADR-00015/00016/00018); se ajustan desde la pantalla Parametros sin tocar codigo.', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador logico del parametro (p. ej. radio_clustering_km, max_visitas_dia)', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'clave';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Valor numerico del parametro', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'valor';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[parametros_modulo]'), 'tipo', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Tipo del parámetro: numero | booleano | texto | enum. Los históricos son numero.', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'tipo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[parametros_modulo]'), 'valor_texto', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Valor para parámetros texto/enum (p. ej. SELECCION). NULL en los numéricos.', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'valor_texto';
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
-- tipo_visita (ADR-00016)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'tipo_visita')
BEGIN
    CREATE TABLE educacion_medica.[tipo_visita] (
        [id_tipo_visita] int IDENTITY(1,1) NOT NULL,
        [clave] varchar(30) NOT NULL,
        [descripcion] nvarchar(100) NOT NULL,
        [es_taller] bit NOT NULL CONSTRAINT [DF_tipo_visita_es_taller] DEFAULT ((0)),
        [activo] bit NOT NULL CONSTRAINT [DF_tipo_visita_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_tipo_visita_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_tipo_visita_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_tipo_visita] PRIMARY KEY ([id_tipo_visita]),
        CONSTRAINT [UQ_tipo_visita_clave] UNIQUE ([clave])
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_visita]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Catálogo de tipos de visita del calendario (ADR-00016): Taller, Informativa, Captación de queja, Otro. es_taller decide si genera taller/matriz; los demás no cuentan en los indicadores de talleres.', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_visita';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_visita]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[tipo_visita]'), 'clave', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Clave estable (TALLER, INFORMATIVA, CAPTACION_QUEJA, OTRO)', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_visita', 'COLUMN', N'clave';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_visita]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[tipo_visita]'), 'es_taller', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'1 = el tipo genera taller/matriz; 0 = visita informativa u otro evento', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_visita', 'COLUMN', N'es_taller';

-- -----------------------------------------------------------------------------
-- tema_taller (ADR-00016)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'tema_taller')
BEGIN
    CREATE TABLE educacion_medica.[tema_taller] (
        [id_tema_taller] int IDENTITY(1,1) NOT NULL,
        [clave] varchar(50) NOT NULL,
        [descripcion] nvarchar(150) NOT NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_tema_taller_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_tema_taller_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_tema_taller_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_tema_taller] PRIMARY KEY ([id_tema_taller]),
        CONSTRAINT [UQ_tema_taller_clave] UNIQUE ([clave])
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tema_taller]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Catálogo opcional del tema/asunto del taller (ADR-00016). Si no se usa, el tema se toma del producto capturado en taller_recursos.', 'SCHEMA', N'educacion_medica', 'TABLE', N'tema_taller';

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
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha (año) del programa', 'SCHEMA', N'educacion_medica', 'TABLE', N'programas_anuales', 'COLUMN', N'fecha';
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
    EXEC sp_addextendedproperty N'MS_Description', N'Histórico (ADR-00015). Equipo de pareo EV+EP del modelo anterior; ya no se usa para nuevas selecciones, rutas ni matrices. Se conserva para migración e histórico.', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno del equipo de pareo', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'id_equipo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[equipos_pareo]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Región fija que opera el equipo (FK física a regiones_cat). Toda la agrupación y asignación de la selección mensual parte de esta relación 1 equipo = 1 región', 'SCHEMA', N'educacion_medica', 'TABLE', N'equipos_pareo', 'COLUMN', N'id_region';
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
-- ejecutivo_region (ADR-00015)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'ejecutivo_region')
BEGIN
    CREATE TABLE educacion_medica.[ejecutivo_region] (
        [id_ejecutivo_region] int IDENTITY(1,1) NOT NULL,
        [id_usuario] int NOT NULL,
        [id_region_catalogo] int NOT NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_ejecutivo_region_activo] DEFAULT ((1)),
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_ejecutivo_region_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_ejecutivo_region_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_ejecutivo_region] PRIMARY KEY ([id_ejecutivo_region]),
        CONSTRAINT [FK_ejecutivo_region_region_catalogo] FOREIGN KEY ([id_region_catalogo]) REFERENCES educacion_medica.[regiones_cat] ([id_region])
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND name = 'UX_ejecutivo_region_usuario_region_activo')
    CREATE UNIQUE INDEX [UX_ejecutivo_region_usuario_region_activo]
        ON educacion_medica.[ejecutivo_region] ([id_usuario], [id_region_catalogo])
        WHERE ([activo] = (1));
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND name = 'IX_ejecutivo_region_usuario')
    CREATE INDEX [IX_ejecutivo_region_usuario] ON educacion_medica.[ejecutivo_region] ([id_usuario]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND name = 'IX_ejecutivo_region_region')
    CREATE INDEX [IX_ejecutivo_region_region] ON educacion_medica.[ejecutivo_region] ([id_region_catalogo]);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Región(es) asignada(s) a un ejecutivo de ventas (ADR-00015). La gerencia del ejecutivo se deriva de regiones_cat.id_tipo_gerencia; todas sus regiones deben ser de la misma gerencia (validación en servicio).', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_region';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[ejecutivo_region]'), 'id_usuario', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Usuario ejecutivo de ventas (FK lógica app.Usuarios, Asokam)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_region', 'COLUMN', N'id_usuario';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[ejecutivo_region]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[ejecutivo_region]'), 'id_region_catalogo', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Región del catálogo (FK física regiones_cat)', 'SCHEMA', N'educacion_medica', 'TABLE', N'ejecutivo_region', 'COLUMN', N'id_region_catalogo';

-- -----------------------------------------------------------------------------
-- ejecutivo_suplente (ADR-00015, decisión 2026-10-23)
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
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND name = 'UX_ejecutivo_suplente_usuario_gerencia_region_activo')
    CREATE UNIQUE INDEX [UX_ejecutivo_suplente_usuario_gerencia_region_activo]
        ON educacion_medica.[ejecutivo_suplente] ([id_usuario], [id_tipo_gerencia], [id_region_catalogo])
        WHERE ([activo] = (1));
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND name = 'IX_ejecutivo_suplente_usuario')
    CREATE INDEX [IX_ejecutivo_suplente_usuario] ON educacion_medica.[ejecutivo_suplente] ([id_usuario]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND name = 'IX_ejecutivo_suplente_gerencia')
    CREATE INDEX [IX_ejecutivo_suplente_gerencia] ON educacion_medica.[ejecutivo_suplente] ([id_tipo_gerencia]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[ejecutivo_suplente]') AND name = 'IX_ejecutivo_suplente_region')
    CREATE INDEX [IX_ejecutivo_suplente_region] ON educacion_medica.[ejecutivo_suplente] ([id_region_catalogo]);

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

-- -----------------------------------------------------------------------------
-- especialista_gerencia (ADR-00015)
-- -----------------------------------------------------------------------------
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
END

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

-- -----------------------------------------------------------------------------
-- especialista_region (ADR-00015)
-- -----------------------------------------------------------------------------
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
END

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
    EXEC sp_addextendedproperty N'MS_Description', N'Version de rutas de una seleccion mensual: planeacion operativa sin workflow. La matriz de talleres apunta aqui con id_ruta_version. Una fila por seleccion + version; las filas de rutas apuntan aqui con id_ruta_version.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_versiones';
 
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
        [id_equipo] int NULL,
        [id_especialista] int NULL,
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
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas]') AND name = 'IX_rutas_especialista')
    CREATE INDEX [IX_rutas_especialista] ON educacion_medica.[rutas] ([id_especialista]);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ruta de visitas de un especialista dentro de una selección mensual, versionada y en borrador (ADR-00015). Ya no es entidad del workflow: la autorización vive en la selección y la matriz.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno de la ruta', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_ruta';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Seleccion mensual planificada (universo de hospitales aprobado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_seleccion_mensual';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Legacy (ADR-00015). Equipo de pareo del modelo anterior; la ruta se organiza por id_especialista. Se conserva para histórico/migración.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_equipo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas]'), 'id_especialista', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Especialista dueño de la ruta (FK lógica app.Usuarios). La ruta se organiza por especialista desde ADR-00015; id_equipo queda legacy.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas', 'COLUMN', N'id_especialista';
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
        [id_ejecutivo] int NULL,
        [id_especialista] int NULL,
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
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND name = 'IX_selecciones_regiones_ejecutivo')
    CREATE INDEX [IX_selecciones_regiones_ejecutivo] ON educacion_medica.[selecciones_regiones] ([id_ejecutivo]);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Region geografica calculada (clustering GPS deterministico sobre el snapshot de coordenadas) y persistida por seleccion mensual. La asignacion region -> ejecutivo vive en id_ejecutivo (ADR-00015); id_equipo queda legacy. Regenerar la agrupacion reemplaza las regiones de la seleccion.', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones';
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
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[selecciones_regiones]'), 'id_ejecutivo', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ejecutivo de ventas dueño de la región (FK lógica app.Usuarios, Asokam). Reemplaza la asignación región -> equipo (ADR-00015). NULL = región sin ejecutivo (la selección no puede cerrarse).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'id_ejecutivo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_regiones]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[selecciones_regiones]'), 'id_especialista', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Especialista sugerido/default para la región (opcional; FK lógica app.Usuarios). La asignación real se confirma en la ruta (ADR-00015).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_regiones', 'COLUMN', N'id_especialista';
 
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
        [id_ejecutivo] int NULL,
        [id_especialista] int NULL,
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
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND name = 'IX_sel_hospital_ejecutivo')
    CREATE INDEX [IX_sel_hospital_ejecutivo] ON educacion_medica.[selecciones_mensuales_hospitales] ([id_ejecutivo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND name = 'IX_sel_hospital_especialista')
    CREATE INDEX [IX_sel_hospital_especialista] ON educacion_medica.[selecciones_mensuales_hospitales] ([id_especialista]);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'N:M seleccion x hospital con la informacion capturada por el Ejecutivo de Ventas en el formulario FOR-004 (Anexo 1). id_ejecutivo es el dueño del hospital (override del ejecutivo de la región); id_especialista es una sugerencia opcional (ADR-00015).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales';
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
    EXEC sp_addextendedproperty N'MS_Description', N'Latitud del hospital congelada al momento de agregarlo a la seleccion (snapshot; el catálogo Asokam puede cambiar después)', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'latitud_snapshot';
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
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]'), 'id_ejecutivo', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ejecutivo dueño del hospital (override del ejecutivo de la región; FK lógica app.Usuarios). NULL = hereda del ejecutivo de la región.', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_ejecutivo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[selecciones_mensuales_hospitales]'), 'id_especialista', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Especialista sugerido para el hospital (opcional; FK lógica app.Usuarios). La ruta puede reasignarlo (ADR-00015).', 'SCHEMA', N'educacion_medica', 'TABLE', N'selecciones_mensuales_hospitales', 'COLUMN', N'id_especialista';
 
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
        [id_ejecutivo] int NULL,
        [id_especialista] int NULL,
        [id_tipo_visita] int NULL,
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
        CONSTRAINT [FK_rutas_visitas_ruta] FOREIGN KEY ([id_ruta]) REFERENCES educacion_medica.[rutas] ([id_ruta]) ON DELETE CASCADE,
        CONSTRAINT [FK_rutas_visitas_tipo_visita] FOREIGN KEY ([id_tipo_visita]) REFERENCES educacion_medica.[tipo_visita] ([id_tipo_visita])
    );
END
 
-- Unicidad (id_ruta, id_seleccion_hospital) con índice filtrado (ADR-00011): las
-- visitas extraordinarias llevan id_seleccion_hospital NULL y no deben chocar
-- entre sí (un UNIQUE duro trataría los NULL como duplicados).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'UX_rutas_visitas_hospital')
    CREATE UNIQUE INDEX [UX_rutas_visitas_hospital] ON educacion_medica.[rutas_visitas] ([id_ruta], [id_seleccion_hospital]) WHERE ([id_seleccion_hospital] IS NOT NULL);
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'IX_rutas_visitas_seleccion_hospital')
    CREATE INDEX [IX_rutas_visitas_seleccion_hospital] ON educacion_medica.[rutas_visitas] ([id_seleccion_hospital]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'IX_rutas_visitas_ejecutivo')
    CREATE INDEX [IX_rutas_visitas_ejecutivo] ON educacion_medica.[rutas_visitas] ([id_ejecutivo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'IX_rutas_visitas_especialista')
    CREATE INDEX [IX_rutas_visitas_especialista] ON educacion_medica.[rutas_visitas] ([id_especialista]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'IX_rutas_visitas_tipo_visita')
    CREATE INDEX [IX_rutas_visitas_tipo_visita] ON educacion_medica.[rutas_visitas] ([id_tipo_visita]);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Visita planificada de una ruta por especialista: ejecutivo dueño + especialista + hospital + fecha + posición. Unidad de capacidad (máx 3/día y 8/semana por especialista, Lun-Vie). ADR-00015.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas';
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
    EXEC sp_addextendedproperty N'MS_Description', N'1 = visita no planificada dentro del alcance parametrizado por alcance_hospital_extraordinario (ADR-00017). Si el alcance es CATALOGO y el hospital no está en la selección, id_seleccion_hospital puede ser NULL.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'es_extraordinaria';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas_visitas]'), 'id_ejecutivo', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ejecutivo dueño del hospital/visita (FK lógica app.Usuarios). Puede ser distinto entre visitas del mismo especialista.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_ejecutivo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas_visitas]'), 'id_especialista', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Especialista que imparte la visita (FK lógica app.Usuarios). Se valida elegibilidad por gerencia y capacidad (ADR-00015).', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_especialista';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas_visitas]'), 'id_tipo_visita', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Tipo de visita (FK tipo_visita). NULL = Taller para datos históricos; los nuevos deben capturarlo.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_tipo_visita';
 
-- -----------------------------------------------------------------------------
-- matrices_individuales
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'matrices_individuales')
BEGIN
    CREATE TABLE educacion_medica.[matrices_individuales] (
        [id_matriz_individual] int IDENTITY(1,1) NOT NULL,
        [id_equipo] int NULL,
        [id_ejecutivo] int NULL,
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
        CONSTRAINT [CK_matrices_individuales_periodo] CHECK (DAY([periodo]) = 1)
    );
END

-- ADR-00015: la matriz individual pasa de equipo a ejecutivo. El UNIQUE duro
-- (id_equipo, periodo) impediría varias matrices nuevas con id_equipo NULL;
-- se reemplaza por índices únicos filtrados (equipo histórico / ejecutivo nuevo).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND name = 'UX_matrices_individuales_equipo_periodo')
    CREATE UNIQUE INDEX [UX_matrices_individuales_equipo_periodo]
        ON educacion_medica.[matrices_individuales] ([id_equipo], [periodo])
        WHERE ([id_equipo] IS NOT NULL);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND name = 'UX_matrices_individuales_ejecutivo_periodo')
    CREATE UNIQUE INDEX [UX_matrices_individuales_ejecutivo_periodo]
        ON educacion_medica.[matrices_individuales] ([id_ejecutivo], [periodo])
        WHERE ([id_ejecutivo] IS NOT NULL);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND name = 'IX_matrices_individuales_ejecutivo')
    CREATE INDEX [IX_matrices_individuales_ejecutivo] ON educacion_medica.[matrices_individuales] ([id_ejecutivo]);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Matriz de talleres por ejecutivo y mes (FOR-005). La captura se bloquea al generarla (es_bloqueado=1) y el GV puede reabrirla (es_bloqueado=0) mientras la matriz general siga en el paso inicial (ADR-00007/00015).', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Legacy (ADR-00015). Equipo de pareo del modelo anterior; la matriz individual se organiza por id_ejecutivo. Se conserva para histórico/migración.', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'id_equipo';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_individuales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[matrices_individuales]'), 'id_ejecutivo', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ejecutivo dueño de la matriz individual (FK lógica app.Usuarios). Reemplaza id_equipo desde ADR-00015.', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'id_ejecutivo';
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
        [fecha_ultima_actualizacion] datetime2(7) NULL,
        [total_actualizado] decimal(18,2) NULL,
        [id_ruta_version] int NULL,
        [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_matrices_generales_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_matrices_generales_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion] int NULL,
        [id_usuario_modificacion] int NULL,
        CONSTRAINT [PK_matrices_generales] PRIMARY KEY ([id_matriz_general]),
        CONSTRAINT [FK_matrices_generales_tipo_gerencia] FOREIGN KEY ([id_tipo_gerencia]) REFERENCES educacion_medica.[tipo_gerencia] ([id_tipo_gerencia]),
        CONSTRAINT [FK_matrices_generales_ruta_version] FOREIGN KEY ([id_ruta_version]) REFERENCES educacion_medica.[rutas_versiones] ([id_ruta_version]),
        CONSTRAINT [UQ_matrices_generales_gerencia_periodo] UNIQUE ([id_tipo_gerencia], [periodo]),
        CONSTRAINT [CK_matrices_generales_periodo] CHECK (DAY([periodo]) = 1)
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('educacion_medica.[matrices_generales]')
      AND name = 'IX_matrices_generales_ruta_version'
)
    CREATE INDEX [IX_matrices_generales_ruta_version]
        ON educacion_medica.[matrices_generales] ([id_ruta_version]);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Matriz general de talleres por gerencia (IMSS / IMSS Bienestar / Descentralizado) y mes: entidad autorizable del workflow EDUCACION_MEDICA_MATRIZ (GV -> costos AEM -> CA -> DC). No tiene estado propio: su estado es el del motor (id_estado). Nace automaticamente con el primer taller capturado de la gerencia/mes (ADR-00007/00017).', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales';
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
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[matrices_generales]'), 'fecha_ultima_actualizacion', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Fecha/hora del último cambio aprobado sobre la matriz (solicitud de taller); no reabre el workflow.', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'fecha_ultima_actualizacion';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[matrices_generales]'), 'total_actualizado', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Snapshot del costo total de la matriz tras el último cambio aprobado. NULL = calcular en lectura.', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'total_actualizado';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[matrices_generales]'), 'id_ruta_version', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Version de rutas de la misma gerencia y mes que esta matriz (FK fisica a rutas_versiones). Permite vincular planeacion y matriz sin depender de busquedas por periodo.', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'id_ruta_version';

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
        [id_ruta_visita] int NULL,
        [id_tipo_visita] int NULL,
        [id_tema_taller] int NULL,
        [tema] nvarchar(200) NULL,
        [fecha_realizado] date NULL,
        [es_extraordinario] bit NOT NULL CONSTRAINT [DF_talleres_extraordinario] DEFAULT ((0)),
        [motivo_extraordinario] nvarchar(500) NULL,
        CONSTRAINT [PK_taller] PRIMARY KEY ([id_taller]),
        CONSTRAINT [FK_talleres_seleccion_hospital] FOREIGN KEY ([id_seleccion_hospital]) REFERENCES educacion_medica.[selecciones_mensuales_hospitales] ([id_seleccion_hospital]),
        CONSTRAINT [FK_talleres_matriz_individual] FOREIGN KEY ([id_matriz_individual]) REFERENCES educacion_medica.[matrices_individuales] ([id_matriz_individual]),
        CONSTRAINT [FK_talleres_matriz_general] FOREIGN KEY ([id_matriz_general]) REFERENCES educacion_medica.[matrices_generales] ([id_matriz_general]),
        CONSTRAINT [FK_talleres_ruta_visita] FOREIGN KEY ([id_ruta_visita]) REFERENCES educacion_medica.[rutas_visitas] ([id_ruta_visita]),
        CONSTRAINT [FK_talleres_tipo_visita] FOREIGN KEY ([id_tipo_visita]) REFERENCES educacion_medica.[tipo_visita] ([id_tipo_visita]),
        CONSTRAINT [FK_talleres_tema_taller] FOREIGN KEY ([id_tema_taller]) REFERENCES educacion_medica.[tema_taller] ([id_tema_taller])
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'IX_talleres_id_matriz_individual')
    CREATE INDEX [IX_talleres_id_matriz_individual] ON educacion_medica.[talleres] ([id_matriz_individual]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'IX_talleres_id_matriz_general')
    CREATE INDEX [IX_talleres_id_matriz_general] ON educacion_medica.[talleres] ([id_matriz_general]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'IX_talleres_id_ruta_visita')
    CREATE INDEX [IX_talleres_id_ruta_visita] ON educacion_medica.[talleres] ([id_ruta_visita]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'IX_talleres_tipo_visita')
    CREATE INDEX [IX_talleres_tipo_visita] ON educacion_medica.[talleres] ([id_tipo_visita]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'IX_talleres_tema_taller')
    CREATE INDEX [IX_talleres_tema_taller] ON educacion_medica.[talleres] ([id_tema_taller]);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[talleres]'), 'id_tipo_visita', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Tipo del taller (FK educacion_medica.tipo_visita); el tipo describe el taller, no la visita planeada.', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_tipo_visita';
 
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
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[talleres]'), 'id_ruta_visita', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Visita planificada que origina el taller (FK física rutas_visitas). NULL = taller capturado sin visita o histórico.', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_ruta_visita';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[talleres]'), 'id_tema_taller', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Tema/asunto del taller (FK tema_taller). Opcional; si está vacío, el tema se toma del producto.', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_tema_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = 26 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'1 = taller no planificado en la ruta, dentro del alcance parametrizado por alcance_hospital_extraordinario (ADR-00017). Si el alcance es CATALOGO y el hospital no está en la selección, id_seleccion_hospital puede ser NULL.', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'es_extraordinario';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[talleres]'), 'tema', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Tema/asunto libre del taller. Si est� vac�o, el calendario usa tema_taller o el producto.', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'tema';
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
        [id_matriz_general]        int NULL,
        [tipo_solicitud]           varchar(30) NOT NULL CONSTRAINT [DF_taller_solicitudes_cambio_tipo] DEFAULT ('CAMBIO_TALLER'),
        [estado]                   varchar(15) NOT NULL CONSTRAINT [DF_taller_solicitudes_cambio_estado] DEFAULT ('Pendiente'),
        [datos_json]               nvarchar(max) NULL,
        [fecha_creacion]           datetime2(7) NOT NULL CONSTRAINT [DF_taller_solicitudes_cambio_fecha_creacion] DEFAULT (sysutcdatetime()),
        [fecha_modificacion]       datetime2(7) NOT NULL CONSTRAINT [DF_taller_solicitudes_cambio_fecha_modificacion] DEFAULT (sysutcdatetime()),
        [id_usuario_creacion]      int NULL,
        [id_usuario_modificacion]  int NULL,
        CONSTRAINT [PK_taller_solicitud_cambio] PRIMARY KEY ([id_solicitud]),
        CONSTRAINT [CK_taller_solicitudes_cambio_estado] CHECK ([estado] IN ('Pendiente','Aprobada','Rechazada','Cancelada')),
        CONSTRAINT [CK_taller_solicitudes_cambio_tipo] CHECK ([tipo_solicitud] IN ('CAMBIO_TALLER','CANCELAR_TALLER','EXTRAORDINARIO','CAMBIO_COSTO')),
        CONSTRAINT [FK_taller_solicitudes_cambio_taller] FOREIGN KEY ([id_taller]) REFERENCES educacion_medica.[talleres] ([id_taller]) ON DELETE CASCADE,
        CONSTRAINT [FK_taller_solicitudes_cambio_matriz] FOREIGN KEY ([id_matriz_general]) REFERENCES educacion_medica.[matrices_generales] ([id_matriz_general])
    );
END
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND name = 'IX_taller_solicitudes_cambio_taller')
    CREATE INDEX [IX_taller_solicitudes_cambio_taller] ON educacion_medica.[taller_solicitudes_cambio] ([id_taller]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND name = 'IX_taller_solicitudes_cambio_estado')
    CREATE INDEX [IX_taller_solicitudes_cambio_estado] ON educacion_medica.[taller_solicitudes_cambio] ([estado]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND name = 'IX_taller_solicitudes_cambio_matriz')
    CREATE INDEX [IX_taller_solicitudes_cambio_matriz] ON educacion_medica.[taller_solicitudes_cambio] ([id_matriz_general]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND name = 'IX_taller_solicitudes_cambio_tipo')
    CREATE INDEX [IX_taller_solicitudes_cambio_tipo] ON educacion_medica.[taller_solicitudes_cambio] ([tipo_solicitud]);
 
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Solicitudes de cambio del equipo sobre un taller bloqueado o fuera de captura (ADR-00010 decisiones 13-15). El cambio (valores antes/despues, motivos y actores) va en datos_json; el CEM resuelve desde la Matriz General. Al aprobar se aplica la misma logica del ajuste post-cierre.', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 1 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Identificador interno de la solicitud', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'id_solicitud';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 2 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Taller sobre el que se pide el cambio (FK educacion_medica.talleres)', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'id_taller';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = 3 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Ciclo de la solicitud: Pendiente | Aprobada | Rechazada | Cancelada', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'estado';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]'), 'id_matriz_general', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Matriz general a la que impacta la solicitud (FK matrices_generales). NULL = solicitud histórica sin vínculo.', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'id_matriz_general';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]'), 'tipo_solicitud', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'Tipo de solicitud: CAMBIO_TALLER | CANCELAR_TALLER | EXTRAORDINARIO | CAMBIO_COSTO', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'tipo_solicitud';
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


-- ===================== 01_reconciliacion.sql =====================
/* =============================================================================
   RECONCILIACIÓN — tablas de Educación Médica que ya existían en producción
   -----------------------------------------------------------------------------
   En producción existen desde el esquema viejo:
     educacion_medica.hospital_extension
     educacion_medica.parametros_anestesias
     educacion_medica.programas_anuales
     educacion_medica.tipo_gerencia
   0016 no las recrea (guards), así que aquí se agregan las columnas/constraints
   que el modelo final necesita y que faltan en esas tablas.
   Idempotente.
   ============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* --- hospital_extension: columnas del modelo final ------------------------- */
IF COL_LENGTH('educacion_medica.hospital_extension', 'es_zona_metropolitana') IS NULL
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ADD es_zona_metropolitana bit NULL;
    PRINT 'hospital_extension: + es_zona_metropolitana';
END
GO

IF COL_LENGTH('educacion_medica.hospital_extension', 'id_region') IS NULL
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ADD id_region int NULL;
    PRINT 'hospital_extension: + id_region';
END
GO

IF COL_LENGTH('educacion_medica.hospital_extension', 'es_almacen') IS NULL
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ADD es_almacen bit NULL;
    PRINT 'hospital_extension: + es_almacen';
END
GO

IF COL_LENGTH('educacion_medica.hospital_extension', 'es_farmacia') IS NULL
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ADD es_farmacia bit NULL;
    PRINT 'hospital_extension: + es_farmacia';
END
GO

IF COL_LENGTH('educacion_medica.hospital_extension', 'es_sede_taller') IS NULL
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ADD es_sede_taller bit NULL;
    PRINT 'hospital_extension: + es_sede_taller';
END
GO

/* fecha pasa a NULL (0016 la define NULL; producción la tenía NOT NULL) */
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND name = 'fecha' AND is_nullable = 0
)
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ALTER COLUMN fecha date NULL;
    PRINT 'hospital_extension: fecha -> NULL';
END
GO

/* FK de región (regiones_cat la crea 0016 antes de este bloque) */
IF OBJECT_ID('educacion_medica.regiones_cat', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys
       WHERE name = 'FK_hospital_extension_region'
         AND parent_object_id = OBJECT_ID('educacion_medica.hospital_extension')
   )
BEGIN
    ALTER TABLE educacion_medica.hospital_extension WITH CHECK
        ADD CONSTRAINT FK_hospital_extension_region
        FOREIGN KEY (id_region) REFERENCES educacion_medica.regiones_cat (id_region)
        ON DELETE SET NULL;
    PRINT 'hospital_extension: + FK_hospital_extension_region';
END
GO

/* --- programas_anuales: CHECK del periodo (tabla vacía en producción) ------ */
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_programas_anuales_periodo'
      AND parent_object_id = OBJECT_ID('educacion_medica.programas_anuales')
)
BEGIN
    ALTER TABLE educacion_medica.programas_anuales WITH CHECK
        ADD CONSTRAINT CK_programas_anuales_periodo CHECK (
            periodo_inicio >= 1 AND periodo_inicio <= 12
            AND periodo_fin >= 1 AND periodo_fin <= 12
        );
    PRINT 'programas_anuales: + CK_programas_anuales_periodo';
END
GO

PRINT '=== RECONCILIACION completada ===';
GO


-- ===================== 0030_20261010-1200_educacion-medica_instalacion-limpia-catalogos.lefarma.sql =====================
-- =============================================================================
-- 0030 — Catálogos y backfills de Educación Médica (instalación limpia Lefarma)
--        NO toca Asokam (roles/permisos viven en el Asokam de producción).
--
-- QUÉ HACE (idempotente, transacción única)
--   1) tipo_gerencia            : IMSS, Descentralizado, Privado, IMSS Bienestar
--   2) parametros_anestesias    : factores del FOR-002 para el año en curso
--   3) regiones_cat             : las 7 regiones por gerencia (IMSS y Descentralizado)
--   4) regiones_estados         : mapeo estado -> región por gerencia (31 estados)
--   4b) IMSS Bienestar          : gerencia + copia de regiones/estados de
--                                 Descentralizado (integrado de 0034)
--   5) hospital_extension       : backfill de id_region + clasificación local/foráneo
--   6) config_ranking           : configuración "General" v2 (cobertura_taller)
--   7) hospital_extension       : clasificación de contactos logísticos
--                                 (almacén / farmacia / sede) — solo UPDATEs
--                                 (las columnas ya las crea 0016; sin ALTER TABLE)
--   8) hospital_extension       : gerencia NULL por jerarquía institucional
--
-- SEPARACIÓN DE RESPONSABILIDADES (2026-10-10)
--   Los catálogos que antes vivían en el 0017 se movieron aquí; el 0017 quedó
--   solo con los roles/permisos base de Asokam. Los incrementales de esquema
--   0022/0023/0025/0026/0027/0028 y los backfills 0019/0024 se retiraron del
--   repositorio al quedar integrados en 0016 y en este script.
--
-- CÓMO USAR (Lefarma limpio: prod o LefarmaDev2 recién reseteado)
--   1) 0016  — esquema completo (crea TODAS las tablas, columnas, índices y el
--              seed de dias_limite_cambio)
--   2) 0030  — este script (catálogos y backfills; solo Lefarma)
--   3) 0035  — catálogos de calendario y parámetros
--   4) 0018  — workflows de selección, rutas y matriz (si el entorno no los tiene)
--   5) 0037  — limpieza opcional (manual/educacion-medica)
--   En una BD nueva no es necesario ejecutar 0034: este script ya siembra
--   IMSS Bienestar.
--
-- REQUISITOS
--   - 0016 aplicado.
--   - Lectura a Asokam.dbo.genContactosCat (mismo servidor). Este script NO
--     escribe en Asokam.
--   - Los backfills de hospital_extension (5, 7 y 8) solo aplican a extensiones
--     ya capturadas desde la app; en un entorno vacío son no-ops y se pueden
--     re-ejecutar después del primer sincronizado de hospitales.
--
-- IDEMPOTENTE: todos los bloques tienen guardas (re-ejecutable).
--
-- NOTA DE EJECUCIÓN (2026-10-10): ejecutar como UTF-8 (sqlcmd: `-f 65001`;
--   DBeaver: conexión/archivo UTF-8) por los acentos en descripciones.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;   -- requerido por índices filtrados (config_ranking)
SET ANSI_NULLS ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1. tipo_gerencia
    -- =========================================================================
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.tipo_gerencia)
    BEGIN
        INSERT INTO educacion_medica.tipo_gerencia (descripcion)
        VALUES (N'IMSS'), (N'Descentralizado'), (N'Privado');
        PRINT 'Catalogo [tipo_gerencia] sembrado: IMSS, Descentralizado, Privado.';
    END
    ELSE
        PRINT 'Catalogo [tipo_gerencia] ya tiene datos. Skip.';

    -- =========================================================================
    -- 2. parametros_anestesias (factores del FOR-002 para el año en curso)
    -- =========================================================================
    DECLARE @anio_actual INT = YEAR(GETDATE());

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_anestesias WHERE anio = @anio_actual)
    BEGIN
        INSERT INTO educacion_medica.parametros_anestesias (anio, clave, valor, descripcion, orden)
        VALUES
            (@anio_actual, 'factor_cirugias_dia',     2.5,    'Cirugias promedio por dia por quirofano', 1),
            (@anio_actual, 'dias_laborables_anio',    250.0,  'Dias laborables al ano', 2),
            (@anio_actual, 'pct_generales',           0.30,   'Porcentaje de anestesias generales sobre el total', 3),
            (@anio_actual, 'pct_regionales',          0.70,   'Porcentaje de anestesias regionales sobre el total', 4),
            (@anio_actual, 'pct_epidurales',          0.35,   'Porcentaje de epidurales sobre las regionales', 5),
            (@anio_actual, 'pct_subdurales',          0.45,   'Porcentaje de subdurales sobre las regionales', 6),
            (@anio_actual, 'pct_mixtas_obesos',       0.02,   'Porcentaje de mixtas obesos sobre las regionales', 7),
            (@anio_actual, 'pct_mixtas_no_obesos',    0.18,   'Porcentaje de mixtas no obesos sobre las regionales', 8);
        PRINT 'Parametros de anestesias sembrados para el anio ' + CAST(@anio_actual AS VARCHAR(4)) + '.';
    END
    ELSE
        PRINT 'Parametros de anestesias del anio actual ya existen. Skip.';

    -- =========================================================================
    -- 3. regiones_cat: las 7 regiones por gerencia (IMSS y Descentralizado)
    --    (estado final de 0010 + 0013: cada gerencia tiene su propio catálogo)
    -- =========================================================================
    INSERT INTO educacion_medica.regiones_cat (nombre, id_tipo_gerencia, activo, fecha_creacion, fecha_modificacion)
    SELECT v.nombre, tg.id_tipo_gerencia, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM (VALUES
        (N'CDMX NORTE'),
        (N'CDMX SUR'),
        (N'NORESTE'),
        (N'NOROESTE'),
        (N'OCCIDENTE'),
        (N'OTE - PTE'),
        (N'SURESTE')
    ) AS v(nombre)
    CROSS JOIN educacion_medica.tipo_gerencia tg
    WHERE tg.descripcion IN (N'IMSS', N'Descentralizado')
      AND NOT EXISTS (
          SELECT 1 FROM educacion_medica.regiones_cat z
          WHERE z.nombre = v.nombre AND z.id_tipo_gerencia = tg.id_tipo_gerencia);

    DECLARE @n_regiones INT = (SELECT COUNT(*) FROM educacion_medica.regiones_cat);
    PRINT CONCAT('Regiones en catalogo: ', @n_regiones);

    -- =========================================================================
    -- 4. regiones_estados: mapeo estado -> región por gerencia (31 estados)
    --    Correcciones vs Asokam (validadas con GPS el 2026-09-03):
    --      Aguascalientes -> OCCIDENTE; Chihuahua -> NOROESTE;
    --      Michoacán -> OCCIDENTE; Puebla -> OTE - PTE.
    --    Ciudad de México (493) NO se mapea (división CDMX NORTE/SUR manual).
    -- =========================================================================
    INSERT INTO educacion_medica.regiones_estados (codigo_estado, id_region, id_tipo_gerencia, fecha_creacion, fecha_modificacion)
    SELECT m.codigo_estado, z.id_region, z.id_tipo_gerencia, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM (VALUES
        (485, N'OCCIDENTE'),  -- Aguascalientes
        (486, N'NOROESTE'),   -- Baja California
        (487, N'NOROESTE'),   -- Baja California Sur
        (488, N'NOROESTE'),   -- Chihuahua
        (489, N'OCCIDENTE'),  -- Colima
        (490, N'SURESTE'),    -- Campeche
        (491, N'NORESTE'),    -- Coahuila
        (492, N'SURESTE'),    -- Chiapas
        (494, N'NORESTE'),    -- Durango
        (495, N'CDMX SUR'),   -- Guerrero
        (496, N'OCCIDENTE'),  -- Guanajuato
        (497, N'OTE - PTE'),  -- Hidalgo
        (498, N'OCCIDENTE'),  -- Jalisco
        (499, N'OCCIDENTE'),  -- Michoacán
        (500, N'CDMX SUR'),   -- Morelos
        (501, N'OTE - PTE'),  -- México
        (502, N'OCCIDENTE'),  -- Nayarit
        (503, N'NORESTE'),    -- Nuevo León
        (504, N'SURESTE'),    -- Oaxaca
        (505, N'OTE - PTE'),  -- Puebla
        (506, N'SURESTE'),    -- Quintana Roo
        (507, N'CDMX NORTE'), -- Querétaro
        (508, N'NOROESTE'),   -- Sinaloa
        (509, N'CDMX NORTE'), -- San Luis Potosí
        (510, N'NOROESTE'),   -- Sonora
        (511, N'SURESTE'),    -- Tabasco
        (512, N'OTE - PTE'),  -- Tlaxcala
        (513, N'NORESTE'),    -- Tamaulipas
        (514, N'SURESTE'),    -- Veracruz
        (515, N'SURESTE'),    -- Yucatán
        (516, N'OCCIDENTE')   -- Zacatecas
    ) AS m(codigo_estado, region)
    JOIN educacion_medica.regiones_cat z ON z.nombre = m.region
    JOIN educacion_medica.tipo_gerencia tg
        ON tg.id_tipo_gerencia = z.id_tipo_gerencia
       AND tg.descripcion IN (N'IMSS', N'Descentralizado')
    WHERE NOT EXISTS (
        SELECT 1 FROM educacion_medica.regiones_estados ze
        WHERE ze.codigo_estado = m.codigo_estado AND ze.id_tipo_gerencia = z.id_tipo_gerencia);

    DECLARE @n_mapeos INT = (SELECT COUNT(*) FROM educacion_medica.regiones_estados);
    PRINT CONCAT('Mapeos estado->region: ', @n_mapeos);

    -- =========================================================================
    -- 4b. Tercera gerencia: IMSS Bienestar (integrado de 0034)
    --     Copia inicial de regiones y mapeos de Descentralizado. No reclasifica
    --     hospitales: la clasificación se hace desde la pantalla Hospitales.
    -- =========================================================================
    DECLARE @id_imss INT;
    DECLARE @id_descentralizado INT;
    DECLARE @id_bienestar INT;

    SELECT @id_imss = id_tipo_gerencia
    FROM educacion_medica.tipo_gerencia
    WHERE descripcion = N'IMSS';

    SELECT @id_descentralizado = id_tipo_gerencia
    FROM educacion_medica.tipo_gerencia
    WHERE descripcion = N'Descentralizado';

    IF @id_imss IS NULL OR @id_descentralizado IS NULL
    BEGIN
        RAISERROR('Faltan los tipos de gerencia base IMSS/Descentralizado.', 16, 1);
    END;

    SELECT @id_bienestar = id_tipo_gerencia
    FROM educacion_medica.tipo_gerencia
    WHERE descripcion = N'IMSS Bienestar';

    IF @id_bienestar IS NULL
    BEGIN
        INSERT INTO educacion_medica.tipo_gerencia (descripcion, activo, fecha_creacion, fecha_modificacion)
        VALUES (N'IMSS Bienestar', 1, SYSUTCDATETIME(), SYSUTCDATETIME());

        SET @id_bienestar = SCOPE_IDENTITY();
        PRINT CONCAT('Tipo de gerencia [IMSS Bienestar] creado con id ', @id_bienestar, '.');
    END
    ELSE
        PRINT CONCAT('Tipo de gerencia [IMSS Bienestar] ya existe con id ', @id_bienestar, '. Skip.');

    INSERT INTO educacion_medica.regiones_cat
        (nombre, centro_latitud, centro_longitud, activo, id_tipo_gerencia, fecha_creacion, fecha_modificacion)
    SELECT
        rc.nombre,
        rc.centro_latitud,
        rc.centro_longitud,
        1,
        @id_bienestar,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    FROM educacion_medica.regiones_cat rc
    WHERE rc.id_tipo_gerencia = @id_descentralizado
      AND NOT EXISTS (
          SELECT 1
          FROM educacion_medica.regiones_cat destino
          WHERE destino.id_tipo_gerencia = @id_bienestar
            AND destino.nombre = rc.nombre
      );
    PRINT CONCAT('Regiones copiadas a IMSS Bienestar: ', @@ROWCOUNT, ' fila(s).');

    INSERT INTO educacion_medica.regiones_estados
        (codigo_estado, id_region, id_tipo_gerencia, fecha_creacion, fecha_modificacion)
    SELECT
        re.codigo_estado,
        destino.id_region,
        @id_bienestar,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    FROM educacion_medica.regiones_estados re
    JOIN educacion_medica.regiones_cat origen
        ON origen.id_region = re.id_region
       AND origen.id_tipo_gerencia = @id_descentralizado
    JOIN educacion_medica.regiones_cat destino
        ON destino.id_tipo_gerencia = @id_bienestar
       AND destino.nombre = origen.nombre
    WHERE NOT EXISTS (
        SELECT 1
        FROM educacion_medica.regiones_estados x
        WHERE x.id_tipo_gerencia = @id_bienestar
          AND x.codigo_estado = re.codigo_estado
    );
    PRINT CONCAT('Mapeos estado->region copiados a IMSS Bienestar: ', @@ROWCOUNT, ' fila(s).');

    -- =========================================================================
    -- 5. hospital_extension: backfill de id_region (por gerencia del hospital)
    --    y clasificación de zona metropolitana (local CDMX/ZM vs foráneo).
    --    Solo aplica a extensiones ya capturadas desde la app.
    -- =========================================================================

    -- 5.1 Backfill de región: la del mapeo de SU gerencia (sugerencia editable)
    UPDATE he
    SET id_region = ze.id_region,
        fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g
        ON g.codigoContacto = he.id_hospital
    JOIN educacion_medica.regiones_estados ze
        ON ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
       AND ze.id_tipo_gerencia = he.id_tipo_gerencia
    WHERE he.id_region IS NULL;

    PRINT CONCAT('Backfill de region aplicado a ', @@ROWCOUNT, ' hospital_extension.');

    -- 5.2 Zona metropolitana: CDMX (493) es local
    UPDATE he
    SET es_zona_metropolitana = 1,
        fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
    WHERE TRY_CAST(g.codigoEstado AS INT) = 493
      AND ISNULL(he.es_zona_metropolitana, -1) <> 1;

    PRINT CONCAT('[1/3] CDMX clasificadas como locales: ', @@ROWCOUNT);

    -- 5.3 Zona metropolitana: municipios conurbados del Edomex (501)
    UPDATE he
    SET es_zona_metropolitana = 1,
        fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
    WHERE TRY_CAST(g.codigoEstado AS INT) = 501
      AND ISNULL(he.es_zona_metropolitana, -1) <> 1
      AND (
           UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'ECATEPEC%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'CIUDAD ECATEPEC%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'NEZAHUALC%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'NETZAHUALC%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'NAUCALPAN%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'TLALNEPANTLA%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE '%UAUTITLAN%'      -- Cuautitlán / Cuautitlán Izcalli
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'TULTITLAN%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'COACALCO%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'NICOL%SROMERO%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'ATIZAPAN%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'MELCHOR OCAMPO%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'CHIMALHUAC%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'IXTAPALUCA%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'VALLE DE CHALCO%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'CHICOLOAPAN%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'TEPOZOTL%'
        OR UPPER(LTRIM(RTRIM(g.ciudad))) = 'LA PAZ'              -- La Paz, Edoméx (el filtro de estado ya excluye BCS)
      );

    PRINT CONCAT('[2/3] Conurbados Edomex clasificados como locales: ', @@ROWCOUNT);

    -- 5.4 Zona metropolitana: el resto sin clasificar pasa a foráneo (0)
    UPDATE educacion_medica.hospital_extension
    SET es_zona_metropolitana = 0,
        fecha_modificacion = SYSUTCDATETIME()
    WHERE es_zona_metropolitana IS NULL;

    PRINT CONCAT('[3/3] Resto clasificado como foraneo: ', @@ROWCOUNT);

    -- =========================================================================
    -- 6. config_ranking: configuración "General" v2 (scoring-v1.1, cobertura_taller)
    --    Nota: el histórico v1 no se siembra (su script 0009 ya no existe);
    --    la v2 queda activa y es la que usa el motor de ranking.
    -- =========================================================================
    DECLARE @id_config INT;

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.config_ranking WHERE nombre = N'General' AND version = 2)
    BEGIN
        -- Solo una configuracion activa (UX_config_ranking_activa): se desactiva la anterior
        UPDATE educacion_medica.config_ranking
        SET activo = 0,
            fecha_modificacion = SYSUTCDATETIME()
        WHERE activo = 1;

        INSERT INTO educacion_medica.config_ranking (nombre, version, activo, fecha_vigencia_inicio, fecha_vigencia_fin,
            fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
        VALUES (N'General', 2, 1, NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), NULL, NULL);

        SET @id_config = SCOPE_IDENTITY();

        INSERT INTO educacion_medica.config_ranking_factores
            (id_configuracion, clave, grupo, nombre, descripcion, peso, activo, tipo_normalizacion, parametros_json)
        VALUES
            (@id_config, N'anestesias_totales',      N'Potencial',  N'Total de anestesias',        N'Suma anual de procedimientos de anestesia; mayor volumen indica mayor potencial de demanda.', 35.00, 1, N'percentil', N'{}'),
            (@id_config, N'numero_quirofanos',        N'Potencial',  N'Numero de quirofanos',       N'Capacidad operativa del hospital medida en numero de quirofanos disponibles.', 10.00, 1, N'percentil', N'{}'),
            (@id_config, N'recencia_seleccion',       N'Cobertura',  N'Recencia de seleccion',      N'Tiempo transcurrido desde la ultima seleccion del hospital; prioriza menor recencia para fomentar rotacion de cobertura.', 20.00, 1, N'tramos', N'{"nunca":100,"reciente":10,"tramos":[{"meses_min":12,"score":90},{"meses_min":6,"score":70},{"meses_min":3,"score":40}]}'),
            (@id_config, N'agrupabilidad_geografica', N'Geografia',  N'Agrupabilidad geografica',   N'Proximidad a otros hospitales ya seleccionados dentro del radio configurado; premia concentracion logistica.', 20.00, 1, N'funcion', N'{"radio_km": 50}'),
            (@id_config, N'cobertura_taller',         N'Cobertura',  N'Cobertura de taller',        N'Estado de cobertura efectiva: nunca seleccionado (maximo), seleccionado con taller pendiente de impartir (alto) o con taller ya Realizado (minimo).', 15.00, 1, N'tramos', N'{"nunca":100,"pendiente":90,"realizado":10}');

        PRINT 'Config General V2 (con cobertura_taller al 15%) insertada y activada.';
    END
    ELSE
        PRINT 'Config General V2 ya existe. Skip.';

    -- =========================================================================
    -- 7. hospital_extension: clasificación de contactos logísticos
    --    (columnas es_almacen/es_farmacia/es_sede_taller ya las crea 0016)
    --    Solo filas sin clasificar (es_sede_taller IS NULL); re-ejecutable.
    -- =========================================================================

    -- 7.1 Almacenes de distribución y BIRMEX -> no sede
    UPDATE he
    SET he.es_almacen = 1, he.es_farmacia = 0, he.es_sede_taller = 0
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat hc ON hc.codigoContacto = he.id_hospital
    WHERE he.es_sede_taller IS NULL
      AND (hc.nombreContacto LIKE '%BIRMEX%'
        OR (hc.nombreContacto LIKE '%ALMAC%'
            AND (hc.nombreContacto LIKE '%DELEGACIONAL%' OR hc.nombreContacto LIKE '%DELEGACION%')));
    PRINT CONCAT('Almacenes/BIRMEX clasificados (no sede): ', @@ROWCOUNT);

    -- 7.2 Sub-almacenes -> sede preferente de su UMAE
    UPDATE he
    SET he.es_almacen = 1, he.es_farmacia = 0, he.es_sede_taller = 1
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat hc ON hc.codigoContacto = he.id_hospital
    WHERE he.es_sede_taller IS NULL
      AND (hc.nombreContacto LIKE '%SUB-ALMAC%' OR hc.nombreContacto LIKE '%SUB ALMAC%');
    PRINT CONCAT('Sub-almacenes clasificados (sede): ', @@ROWCOUNT);

    -- 7.3 Farmacias con sub-almacén del mismo UMAE -> no sede
    UPDATE he
    SET he.es_almacen = 0, he.es_farmacia = 1, he.es_sede_taller = 0
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat hc ON hc.codigoContacto = he.id_hospital
    WHERE he.es_sede_taller IS NULL
      AND hc.nombreContacto LIKE '%FARMACIA%'
      AND EXISTS (
          SELECT 1
          FROM Asokam.dbo.genContactosCat h2
          WHERE h2.activo = 1
            AND (h2.nombreContacto LIKE '%SUB-ALMAC%' OR h2.nombreContacto LIKE '%SUB ALMAC%')
            AND h2.nombreContacto LIKE LEFT(hc.nombreContacto, LEN(hc.nombreContacto) - LEN(' - FARMACIA')) + '%'
      );
    PRINT CONCAT('Farmacias con sub-almacen (no sede): ', @@ROWCOUNT);

    -- 7.4 Farmacias sin sub-almacén (únicas de su UMAE) -> sede
    UPDATE he
    SET he.es_almacen = 0, he.es_farmacia = 1, he.es_sede_taller = 1
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat hc ON hc.codigoContacto = he.id_hospital
    WHERE he.es_sede_taller IS NULL
      AND hc.nombreContacto LIKE '%FARMACIA%';
    PRINT CONCAT('Farmacias sin sub-almacen (sede): ', @@ROWCOUNT);

    -- 7.5 Resto -> sede de taller
    UPDATE he
    SET he.es_almacen = 0, he.es_farmacia = 0, he.es_sede_taller = 1
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat hc ON hc.codigoContacto = he.id_hospital
    WHERE he.es_sede_taller IS NULL;
    PRINT CONCAT('Resto clasificado como sede: ', @@ROWCOUNT);

    -- =========================================================================
    -- 8. hospital_extension: gerencia NULL por jerarquía institucional
    --    (de 0019; solo filas con id_tipo_gerencia IS NULL; nunca sobreescribe)
    -- =========================================================================
    UPDATE he
    SET he.id_tipo_gerencia = tg.id_tipo_gerencia,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g
        ON g.codigoContacto = he.id_hospital
    JOIN educacion_medica.tipo_gerencia tg
        ON tg.descripcion = CASE
             WHEN g.codigoContacto = 364 OR g.codigoContactoPrincipal = 364 THEN 'IMSS'
             WHEN g.tipo = 'Privado' THEN 'Privado'
             ELSE 'Descentralizado'
           END
    WHERE he.id_tipo_gerencia IS NULL;
    PRINT CONCAT('Gerencia asignada a ', @@ROWCOUNT, ' hospital_extension (solo filas con gerencia NULL).');

    COMMIT TRANSACTION;
    PRINT '0030 completado: catalogos y backfills de instalacion limpia (solo Lefarma).';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0030: ' + ERROR_MESSAGE();
    THROW;
END CATCH

-- =========================================================================
-- VERIFICACIÓN (ejecutar aparte)
-- =========================================================================
-- Catalogos:
-- SELECT (SELECT COUNT(*) FROM educacion_medica.tipo_gerencia)      AS gerencias,
--        (SELECT COUNT(*) FROM educacion_medica.regiones_cat)       AS regiones,
--        (SELECT COUNT(*) FROM educacion_medica.regiones_estados)   AS mapeos_estado,
--        (SELECT COUNT(*) FROM educacion_medica.config_ranking WHERE activo = 1) AS config_activa,
--        (SELECT COUNT(*) FROM educacion_medica.parametros_anestesias WHERE anio = YEAR(GETDATE())) AS params_anestesias;
--
-- Extensions sin clasificar / sin gerencia (esperado: 0 tras el primer sync):
-- SELECT COUNT(*) AS sin_clasificar FROM educacion_medica.hospital_extension WHERE es_sede_taller IS NULL;
-- SELECT COUNT(*) AS sin_gerencia   FROM educacion_medica.hospital_extension WHERE id_tipo_gerencia IS NULL;


-- ===================== 0035_20261023-1200_educacion-medica_calendario-catalogos-parametros.lefarma.sql =====================
-- =============================================================================
-- 0035 — Calendario: catálogos de tipo de visita/tema y parámetros (ADR-00016)
--
-- QUÉ HACE
--   - Agrega tipo_visita y tema_taller.
--   - rutas_visitas.id_tipo_visita (FK tipo_visita).
--   - talleres.id_tema_taller (FK tema_taller).
--   - parametros_modulo.tipo / valor_texto (numero | booleano | texto | enum).
--   - Siembra los parámetros de capacidad, metas, producto, autorización,
--     candado de matriz, cambios de taller y sugerencia de especialistas.
--   - Siembra los tipos de visita finales (incluye TALLER como
--     "Promoción producto nuevo" y es_taller = 0, según 0041).
--
--   NO aplica el script solo: lo revisa y ejecuta el usuario.
--   Para instalación limpia, 0016 integra las tablas/columnas; 0035 siembra.
--   Este script absorbe los seeds de 0036, 0041, 0044 y 0045, por lo que en
--   una BD nueva NO deben ejecutarse esos incrementales.
--
-- ORDEN DE INSTALACIÓN LIMPIA (solo Educación Médica)
--   1) 0016  esquema completo
--   2) 0030  catálogos base y backfills
--   3) 0035  este script (catálogos de calendario y parámetros)
--   4) 0018  workflows de selección, rutas y matriz
--   5) 0037  limpieza opcional (manual/educacion-medica)
--
-- REQUISITOS
--   - 0016 aplicado.
--
-- IDEMPOTENTE: guards por tabla/columna/índice/FK y seeds con NOT EXISTS.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'educacion_medica')
BEGIN
    RAISERROR('Falta el esquema educacion_medica. Ejecute 0016 primero.', 16, 1);
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1) Catálogos de calendario
    -- =========================================================================

    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'tipo_visita')
    BEGIN
        CREATE TABLE educacion_medica.[tipo_visita] (
            [id_tipo_visita] int IDENTITY(1,1) NOT NULL,
            [clave] varchar(30) NOT NULL,
            [descripcion] nvarchar(100) NOT NULL,
            [es_taller] bit NOT NULL CONSTRAINT [DF_tipo_visita_es_taller] DEFAULT ((0)),
            [activo] bit NOT NULL CONSTRAINT [DF_tipo_visita_activo] DEFAULT ((1)),
            [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_tipo_visita_fecha_creacion] DEFAULT (sysutcdatetime()),
            [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_tipo_visita_fecha_modificacion] DEFAULT (sysutcdatetime()),
            [id_usuario_creacion] int NULL,
            [id_usuario_modificacion] int NULL,
            CONSTRAINT [PK_tipo_visita] PRIMARY KEY ([id_tipo_visita]),
            CONSTRAINT [UQ_tipo_visita_clave] UNIQUE ([clave])
        );
        PRINT 'Tabla [educacion_medica].[tipo_visita] creada.';
    END
    ELSE
        PRINT 'Tabla [educacion_medica].[tipo_visita] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_visita]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Catálogo de tipos de visita del calendario (ADR-00016): Taller, Informativa, Captación de queja, Otro. es_taller decide si genera taller/matriz; los demás no cuentan en los indicadores de talleres.', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_visita';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_visita]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[tipo_visita]'), 'clave', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Clave estable (TALLER, INFORMATIVA, CAPTACION_QUEJA, OTRO)', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_visita', 'COLUMN', N'clave';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_visita]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[tipo_visita]'), 'es_taller', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'1 = el tipo genera taller/matriz; 0 = visita informativa u otro evento', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_visita', 'COLUMN', N'es_taller';

    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'tema_taller')
    BEGIN
        CREATE TABLE educacion_medica.[tema_taller] (
            [id_tema_taller] int IDENTITY(1,1) NOT NULL,
            [clave] varchar(50) NOT NULL,
            [descripcion] nvarchar(150) NOT NULL,
            [activo] bit NOT NULL CONSTRAINT [DF_tema_taller_activo] DEFAULT ((1)),
            [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_tema_taller_fecha_creacion] DEFAULT (sysutcdatetime()),
            [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_tema_taller_fecha_modificacion] DEFAULT (sysutcdatetime()),
            [id_usuario_creacion] int NULL,
            [id_usuario_modificacion] int NULL,
            CONSTRAINT [PK_tema_taller] PRIMARY KEY ([id_tema_taller]),
            CONSTRAINT [UQ_tema_taller_clave] UNIQUE ([clave])
        );
        PRINT 'Tabla [educacion_medica].[tema_taller] creada.';
    END
    ELSE
        PRINT 'Tabla [educacion_medica].[tema_taller] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tema_taller]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Catálogo opcional del tema/asunto del taller (ADR-00016). Si no se usa, el tema se toma del producto capturado en taller_recursos.', 'SCHEMA', N'educacion_medica', 'TABLE', N'tema_taller';

    -- Semillas de tipo_visita (SQL dinámico: la tabla se acaba de crear)
    EXEC(N'
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.tipo_visita WHERE clave = ''TALLER'')
        INSERT INTO educacion_medica.tipo_visita (clave, descripcion, es_taller, activo)
        VALUES (''TALLER'', N''Promoción producto nuevo'', 0, 1);
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.tipo_visita WHERE clave = ''INFORMATIVA'')
        INSERT INTO educacion_medica.tipo_visita (clave, descripcion, es_taller, activo)
        VALUES (''INFORMATIVA'', N''Informativa'', 0, 1);
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.tipo_visita WHERE clave = ''CAPTACION_QUEJA'')
        INSERT INTO educacion_medica.tipo_visita (clave, descripcion, es_taller, activo)
        VALUES (''CAPTACION_QUEJA'', N''Captación de queja'', 0, 1);
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.tipo_visita WHERE clave = ''OTRO'')
        INSERT INTO educacion_medica.tipo_visita (clave, descripcion, es_taller, activo)
        VALUES (''OTRO'', N''Otro'', 0, 1);

    UPDATE educacion_medica.tipo_visita
       SET descripcion = N''Promoción producto nuevo'',
           es_taller = 0,
           fecha_modificacion = SYSUTCDATETIME()
     WHERE clave = ''TALLER''
       AND descripcion = N''Taller'';');
    PRINT 'Tipos de visita base sembrados/verificados.';

    -- =========================================================================
    -- 2) Columnas en rutas_visitas y talleres
    -- =========================================================================

    IF COL_LENGTH('educacion_medica.rutas_visitas', 'id_tipo_visita') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[rutas_visitas] ADD [id_tipo_visita] int NULL;
        PRINT 'Columna [rutas_visitas].[id_tipo_visita] agregada.';
    END
    ELSE
        PRINT 'Columna [rutas_visitas].[id_tipo_visita] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_rutas_visitas_tipo_visita')
    BEGIN
        EXEC(N'ALTER TABLE educacion_medica.[rutas_visitas] ADD CONSTRAINT [FK_rutas_visitas_tipo_visita]
            FOREIGN KEY ([id_tipo_visita]) REFERENCES educacion_medica.[tipo_visita] ([id_tipo_visita]);');
        PRINT 'FK [FK_rutas_visitas_tipo_visita] creada.';
    END
    ELSE
        PRINT 'FK [FK_rutas_visitas_tipo_visita] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'IX_rutas_visitas_tipo_visita')
        EXEC(N'CREATE INDEX [IX_rutas_visitas_tipo_visita] ON educacion_medica.[rutas_visitas] ([id_tipo_visita]);');

    IF COL_LENGTH('educacion_medica.talleres', 'id_tema_taller') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[talleres] ADD [id_tema_taller] int NULL;
        PRINT 'Columna [talleres].[id_tema_taller] agregada.';
    END
    ELSE
        PRINT 'Columna [talleres].[id_tema_taller] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_talleres_tema_taller')
    BEGIN
        EXEC(N'ALTER TABLE educacion_medica.[talleres] ADD CONSTRAINT [FK_talleres_tema_taller]
            FOREIGN KEY ([id_tema_taller]) REFERENCES educacion_medica.[tema_taller] ([id_tema_taller]);');
        PRINT 'FK [FK_talleres_tema_taller] creada.';
    END
    ELSE
        PRINT 'FK [FK_talleres_tema_taller] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'IX_talleres_tema_taller')
        EXEC(N'CREATE INDEX [IX_talleres_tema_taller] ON educacion_medica.[talleres] ([id_tema_taller]);');

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas_visitas]'), 'id_tipo_visita', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Tipo de visita (FK tipo_visita). NULL = Taller para datos históricos; los nuevos deben capturarlo.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_tipo_visita';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[talleres]'), 'id_tema_taller', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Tema/asunto del taller (FK tema_taller). Opcional; si está vacío, el tema se toma del producto.', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_tema_taller';

    -- =========================================================================
    -- 3) parametros_modulo: tipo / valor_texto + parámetros nuevos
    -- =========================================================================

    IF COL_LENGTH('educacion_medica.parametros_modulo', 'tipo') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[parametros_modulo] ADD [tipo] varchar(20) NOT NULL
            CONSTRAINT [DF_parametros_modulo_tipo] DEFAULT ('numero');
        PRINT 'Columna [parametros_modulo].[tipo] agregada.';
    END
    ELSE
        PRINT 'Columna [parametros_modulo].[tipo] ya existe. Skip.';

    IF COL_LENGTH('educacion_medica.parametros_modulo', 'valor_texto') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[parametros_modulo] ADD [valor_texto] nvarchar(100) NULL;
        PRINT 'Columna [parametros_modulo].[valor_texto] agregada.';
    END
    ELSE
        PRINT 'Columna [parametros_modulo].[valor_texto] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND name = 'CK_parametros_modulo_tipo')
        EXEC(N'ALTER TABLE educacion_medica.[parametros_modulo] ADD CONSTRAINT [CK_parametros_modulo_tipo]
            CHECK ([tipo] IN (''numero'', ''booleano'', ''texto'', ''enum''));');

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[parametros_modulo]'), 'tipo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Tipo del parámetro: numero | booleano | texto | enum. Los históricos son numero.', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'tipo';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[parametros_modulo]'), 'valor_texto', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Valor para parámetros texto/enum (p. ej. SELECCION). NULL en los numéricos.', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'valor_texto';

    -- Seeds con SQL dinámico: la tabla/columnas se acaban de crear.
    EXEC(N'
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''producto_cantidad_default'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''producto_cantidad_default'', 2, ''numero'', NULL, N''Cantidad default del recurso Producto en el alta de taller (editable).'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''alcance_hospital_extraordinario'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''alcance_hospital_extraordinario'', 0, ''enum'', N''SELECCION'', N''Alcance del hospital extraordinario: EJECUTIVO | GERENCIA | SELECCION | CATALOGO.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''matriz_requiere_autorizacion'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''matriz_requiere_autorizacion'', 1, ''booleano'', NULL, N''1 = la matriz pasa por autorización; 0 = solo candado.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''bloqueo_taller_automatico'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''bloqueo_taller_automatico'', 1, ''booleano'', NULL, N''1 = al autorizar la matriz los talleres se bloquean automáticamente.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''min_visitas_ejecutivo_semana'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''min_visitas_ejecutivo_semana'', 0, ''numero'', NULL, N''Mínimo de visitas por ejecutivo por semana; 0 = sin mínimo.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''min_visitas_ejecutivo_mes'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''min_visitas_ejecutivo_mes'', 0, ''numero'', NULL, N''Mínimo de visitas por ejecutivo por mes; 0 = sin mínimo.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''min_hospitales_por_zona'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''min_hospitales_por_zona'', 4, ''numero'', NULL, N''Mínimo recomendado de hospitales por zona en viaje foráneo.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''min_hospitales_especialista_semana'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''min_hospitales_especialista_semana'', 4, ''numero'', NULL, N''Cuota documentada: hospitales por especialista por semana.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''min_talleres_especialista_semana'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''min_talleres_especialista_semana'', 6, ''numero'', NULL, N''Cuota documentada: talleres por especialista por semana.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''meta_talleres_mes_imss'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''meta_talleres_mes_imss'', 64, ''numero'', NULL, N''Meta mensual configurable para IMSS.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''meta_talleres_mes_bienestar'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''meta_talleres_mes_bienestar'', 64, ''numero'', NULL, N''Meta mensual configurable para IMSS Bienestar.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''meta_talleres_mes_descentralizado'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''meta_talleres_mes_descentralizado'', 64, ''numero'', NULL, N''Meta mensual configurable para Descentralizado.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''umbral_cambio_costo_reautorizacion'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''umbral_cambio_costo_reautorizacion'', 0, ''numero'', NULL, N''Delta de costo que obliga a reautorizar la matriz; 0 = sin umbral.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''permite_cambio_hospital'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''permite_cambio_hospital'', 1, ''booleano'', NULL, N''1 = la solicitud de taller puede cambiar el hospital dentro del alcance permitido.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''permite_cambio_producto'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''permite_cambio_producto'', 1, ''booleano'', NULL, N''1 = la solicitud de taller puede cambiar producto/cantidad y recalcular costos.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_misma_ciudad_dia'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_misma_ciudad_dia'', 100, ''numero'', NULL, N''Puntos cuando el especialista ya tiene visita en la misma ciudad el mismo día.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_misma_ciudad_cerca'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_misma_ciudad_cerca'', 50, ''numero'', NULL, N''Puntos cuando el especialista tiene visita en la misma ciudad dentro de la ventana de cercanía.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_misma_institucion'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_misma_institucion'', 25, ''numero'', NULL, N''Puntos cuando el especialista tiene visita en la misma institución dentro de la ventana de cercanía.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_penalizacion_dia_consecutivo'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_penalizacion_dia_consecutivo'', 20, ''numero'', NULL, N''Puntos que se restan cuando el especialista tiene visita el día anterior o siguiente.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_factor_carga_semana'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_factor_carga_semana'', 1, ''numero'', NULL, N''Puntos que se restan por cada visita del especialista en la semana.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_factor_carga_mes'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_factor_carga_mes'', 1, ''numero'', NULL, N''Puntos que se restan por cada visita del especialista en el mes.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_ventana_dias_cercania'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_ventana_dias_cercania'', 1, ''numero'', NULL, N''Días hacia atrás y adelante para considerar misma ciudad o institución cercana.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_historial_hospital'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_historial_hospital'', 5, ''numero'', NULL, N''Puntos por cada visita realizada al mismo hospital; se cuentan hasta 3 visitas.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_historial_institucion'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_historial_institucion'', 5, ''numero'', NULL, N''Puntos una vez cuando el especialista ya visitó otro hospital de la misma institución.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_historial_ciudad'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_historial_ciudad'', 3, ''numero'', NULL, N''Puntos por cada visita realizada en la misma ciudad; se cuentan hasta 3 visitas.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_historial_region'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_historial_region'', 2, ''numero'', NULL, N''Puntos por cada visita realizada en la misma región; se cuentan hasta 3 visitas.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_tope_historial'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_tope_historial'', 25, ''numero'', NULL, N''Máximo de puntos que puede aportar el historial completo a una sugerencia.'');');
    PRINT 'Parámetros del calendario sembrados/verificados.';

    COMMIT TRANSACTION;
    PRINT '0035 completado: catálogos de calendario y parámetros.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0035: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

-- =============================================================================
-- VERIFICACIÓN (ejecutar aparte)
-- =============================================================================
-- SELECT * FROM educacion_medica.tipo_visita ORDER BY id_tipo_visita;
-- SELECT clave, valor, tipo, valor_texto FROM educacion_medica.parametros_modulo ORDER BY clave;
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'educacion_medica' AND TABLE_NAME = 'parametros_modulo';


-- ===================== 0018_20261007-1400_educacion-medica_workflows-seleccion-rutas-matriz.lefarma.sql =====================
-- =============================================================================
-- 0018 — Workflows de Educación Médica (Selección, Rutas y Matriz de Talleres)
-- ADR: lefarma.docs/educacion-medica/decisiones/00006_workflow-seleccion-y-rutas.md
--      (y 00007_modulo-matriz-talleres.md para la matriz)
--
-- CÓMO USAR
--   Entorno NUEVO: 0016 (esquema) -> 0030 (catálogos) -> 0035 (parámetros)
--                  -> 0018 (este script). Si el Asokam está nuevo, 0017.
--   Entornos ya migrados: este script es el VIGENTE; se puede re-ejecutar para
--   recrear los flujos EM (borra y recrea; ver ADVERTENCIA).
--
--   Este script crea la columna config.workflow_pasos.permite_editar si falta
--   y la incluye en todos los pasos que siembra. En una BD nueva NO hace falta
--   ejecutar 0046 (queda solo para entornos existentes).
--
--   ADVERTENCIA: Ejecutar el script COMPLETO en un solo lote (sqlcmd -i, SSMS F5 o
--      DBeaver "Execute script" / Alt+X). NO ejecutarlo sentencia por sentencia:
--      contiene BEGIN TRY/CATCH y una transacción que abarcan todo el cuerpo.
--
-- PATRÓN ÚNICO DE FLUJOS EM (igual a OC/Solicitudes de Personal)
--   - Paso inicial: 'Creada' (estado CREADA) — editable.
--   - Pasos de firma intermedios: AUTORIZAR / DEVOLVER / RECHAZAR / CANCELAR.
--   - Penúltimo paso de firma: CERRAR (final feliz) / DEVOLVER / RECHAZAR.
--     NO tiene CANCELAR (ese paso es el que cierra o rechaza).
--   - Finales SIEMPRE presentes: Cerrada (CERRADA), Rechazada (RECHAZADA),
--     Cancelada (CANCELADA). "Cerrada" equivale a Autorizada por completo.
--   - CANCELAR disponible desde cualquier paso EXCEPTO el penúltimo.
--
-- QUÉ HACE
--   1) Tipos de acción EM por proceso (workflow_tipos_accion es único por
--      codigo + codigo_proceso): siembra AUTORIZAR, ENVIAR, DEVOLVER, CANCELAR,
--      CERRAR y RECHAZAR para EDUCACION_MEDICA_SELECCION, EDUCACION_MEDICA_RUTAS
--      y EDUCACION_MEDICA_MATRIZ (guardas por codigo + codigo_proceso).
--   2) LIMPIEZA "DESDE CERO" de los tres flujos EM: elimina, si existen, los
--      workflows de esos procesos con TODA su configuración (pasos, acciones,
--      condiciones, handlers, notificaciones, recordatorios, participantes,
--      jefes excluidos, mappings y bitácora). Ver ADVERTENCIA abajo.
--   3) INSERTs limpios de los SEIS flujos que deben existir:
--        EDUCACION_MEDICA_SELECCION
--            - 'Selección mensual - IMSS'            (Creada -> GG -> GV IMSS -> Cerrada/Rechazada/Cancelada)
--            - 'Selección mensual - Descentralizado' (Creada -> GG -> GV Desc. -> Cerrada/Rechazada/Cancelada)
--        EDUCACION_MEDICA_RUTAS
--            - 'Rutas - IMSS'                        (Creada -> GV IMSS -> CA -> DC -> Cerrada/Rechazada/Cancelada)
--            - 'Rutas - Descentralizado'             (Creada -> GV Desc. -> CA -> DC -> Cerrada/Rechazada/Cancelada)
--        EDUCACION_MEDICA_MATRIZ
--            - 'Matriz de talleres - IMSS'           (Creada -> GV IMSS -> costos AEM -> CA -> DC -> Cerrada/Rechazada/Cancelada)
--            - 'Matriz de talleres - Descentralizado'(Creada -> GV Desc. -> costos AEM -> CA -> DC -> Cerrada/Rechazada/Cancelada)
--   4) Scope type TIPO_GERENCIA (idempotente), necesario para los mappings
--      por gerencia que se crean en el frontend.
--   5) MIGRACIÓN de estados de dominio y backfill:
--        selecciones_mensuales.estado: Borrador->Creada, Autorizada->Cerrada;
--        CHECK nuevo ('Creada','EnRevision','Cerrada','Rechazada','Cancelada').
--        rutas / rutas_versiones.estado: Draft->Creada, Confirmada->Cerrada;
--        CHECK nuevo ('Creada','Cerrada','Rechazada','Cancelada','Archivada').
--        talleres.estado: Borrador->Creada; CHECK nuevo
--        ('Creada','Elaborado','Revisado','Autorizado','Programado','EnCurso','Realizado','Cancelado').
--        Backfill de id_workflow/id_paso_actual de selecciones y versiones de
--        rutas huérfanas (apuntaban a los workflows borrados).
--
-- REQUISITOS
--   - Esquema de 0016 aplicado (incluye rutas_versiones, las columnas de
--     workflow en selecciones_mensuales/rutas y las tablas de la Matriz) y
--     seeds de 0017.
--   - Estados del catálogo: CREADA, REVISION, PREPARACION, REVISION_DIRECTOR,
--     CERRADA, RECHAZADA y CANCELADA (el script siembra RECHAZADA si falta).
--
-- ⚠️ ADVERTENCIA
--   La sección 2 borra la configuración manual existente de los tres flujos EM
--   (mappings, participantes, notificaciones, recordatorios) y recrea los
--   workflows con IDs nuevos. Tras re-ejecutarlo hay que recrear mappings y
--   participantes en el admin de workflows (ver pasos manuales al final).
--
-- QUÉ NO HACE (se configura en el FRONTEND, admin de workflows)
--   1) MAPPINGS por gerencia (scope TIPO_GERENCIA):
--        EDUCACION_MEDICA_SELECCION + 1 -> 'Selección mensual - IMSS'
--        EDUCACION_MEDICA_SELECCION + 2 -> 'Selección mensual - Descentralizado'
--        EDUCACION_MEDICA_RUTAS     + 1 -> 'Rutas - IMSS'
--        EDUCACION_MEDICA_RUTAS     + 2 -> 'Rutas - Descentralizado'
--        EDUCACION_MEDICA_MATRIZ    + 1 -> 'Matriz de talleres - IMSS'
--        EDUCACION_MEDICA_MATRIZ    + 2 -> 'Matriz de talleres - Descentralizado'
--   2) PARTICIPANTES por paso (selección, rutas y matriz):
--        Selección: Firma GG -> usuario GG; Firma GV -> usuario GV de la gerencia
--        Rutas:     Firma GV -> usuario GV de la gerencia; Revisión CA -> CA; Autorización DC -> DC
--        Matriz:    Creada y Firma GV -> usuario GV de la gerencia;
--                   Registro de costos AEM -> AEM; Revisión CA -> CA; Autorización DC -> DC
--
--   >>> ADVERTENCIA 1: mientras un paso no tenga participantes, el motor permite
--   >>> ejecutar sus acciones a CUALQUIER usuario autenticado.
--   >>> ADVERTENCIA 2: los mappings son OBLIGATORIOS. Sin mapping, el resolver
--   >>> cae al fallback por código compartido y podría elegir la variante
--   >>> equivocada (p. ej. pedir la firma al GV que no corresponde).
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 0. PREFLIGHT: prerrequisitos (falla con mensaje claro si falta algo)
    -- =========================================================================
    DECLARE @faltantes NVARCHAR(MAX) = N'';

    IF OBJECT_ID('educacion_medica.tipo_gerencia') IS NULL
        SET @faltantes += N'educacion_medica.tipo_gerencia (script 0003), ';
    IF OBJECT_ID('educacion_medica.talleres') IS NULL
        SET @faltantes += N'educacion_medica.talleres (script 0003), ';
    IF OBJECT_ID('educacion_medica.equipos_pareo') IS NULL
        SET @faltantes += N'educacion_medica.equipos_pareo (scripts 0010 + 0006), ';
    IF OBJECT_ID('config.workflows') IS NULL
        OR OBJECT_ID('config.workflow_pasos') IS NULL
        OR OBJECT_ID('config.workflow_acciones') IS NULL
        OR OBJECT_ID('config.workflow_tipos_accion') IS NULL
        OR OBJECT_ID('config.workflow_estados') IS NULL
        OR OBJECT_ID('config.workflow_scope_types') IS NULL
        OR OBJECT_ID('config.workflow_participantes') IS NULL
        OR OBJECT_ID('config.workflow_condiciones') IS NULL
        OR OBJECT_ID('config.workflow_notificaciones') IS NULL
        OR OBJECT_ID('config.workflow_notificacion_canal') IS NULL
        OR OBJECT_ID('config.workflow_bitacora') IS NULL
        OR OBJECT_ID('config.workflow_accion_handlers') IS NULL
        OR OBJECT_ID('config.workflow_mappings') IS NULL
        OR OBJECT_ID('config.workflow_jefes_excluidos') IS NULL
        OR OBJECT_ID('config.workflow_recordatorio') IS NULL
        OR OBJECT_ID('config.workflow_recordatorio_canal') IS NULL
        OR OBJECT_ID('config.workflow_recordatorio_log') IS NULL
        SET @faltantes += N'catálogo del motor config.workflow_* (esquema base de la plataforma), ';

    IF LEN(@faltantes) > 0
    BEGIN
        SET @faltantes = LEFT(@faltantes, LEN(@faltantes) - 1); -- quita la última coma
        DECLARE @mensaje NVARCHAR(2048) = N'0018: faltan prerrequisitos -> ' + @faltantes
            + N'. Aplica primero 0016 (esquema) y 0017 (seeds), y vuelve a ejecutar 0018.';
        RAISERROR(@mensaje, 16, 1);
    END

    -- =========================================================================
    -- 0b. Edición por paso: columna requerida por la configuración del workflow
    --     0018 la crea si falta para que una BD nueva quede completa sin 0046.
    -- =========================================================================
    IF COL_LENGTH('config.workflow_pasos', 'permite_editar') IS NULL
    BEGIN
        ALTER TABLE config.workflow_pasos
            ADD permite_editar BIT NOT NULL
                CONSTRAINT DF_workflow_pasos_permite_editar DEFAULT (0);
        PRINT 'Columna [config.workflow_pasos].[permite_editar] agregada.';
    END
    ELSE
        PRINT 'Columna [config.workflow_pasos].[permite_editar] ya existe. Skip.';

    -- =========================================================================
    -- 1. TIPOS DE ACCIÓN EM POR PROCESO (único por codigo + codigo_proceso)
    -- =========================================================================

    DECLARE @procesos TABLE (codigo_proceso VARCHAR(50));
    INSERT INTO @procesos (codigo_proceso)
    VALUES ('EDUCACION_MEDICA_SELECCION'), ('EDUCACION_MEDICA_RUTAS'), ('EDUCACION_MEDICA_MATRIZ');

    DECLARE @tipos TABLE (codigo VARCHAR(50), nombre VARCHAR(100), descripcion VARCHAR(300), cambia_estado BIT);
    INSERT INTO @tipos (codigo, nombre, descripcion, cambia_estado)
    VALUES
        ('AUTORIZAR', 'Autorizar',              'Autoriza y avanza al siguiente paso del workflow de Educación Médica.', 1),
        ('ENVIAR',    'Enviar',                 'Envía al siguiente paso del workflow de Educación Médica (sin firma).', 1),
        ('DEVOLVER',  'Devolver',               'Devuelve al paso anterior para corrección (comentario obligatorio).',   1),
        ('CANCELAR',  'Cancelar',               'Cancela la entidad del workflow de Educación Médica (no disponible en el penúltimo paso).', 1),
        ('CERRAR',    'Cerrar',                 'Cierra la entidad: pasó por todos los pasos y quedó autorizada por completo.', 1),
        ('RECHAZAR',  'Rechazar',               'Rechaza definitivamente la entidad del workflow de Educación Médica (comentario obligatorio).', 1);

    INSERT INTO config.workflow_tipos_accion (codigo, nombre, descripcion, cambia_estado, activo, codigo_proceso)
    SELECT t.codigo, t.nombre, t.descripcion, t.cambia_estado, 1, p.codigo_proceso
    FROM @tipos t
    CROSS JOIN @procesos p
    WHERE NOT EXISTS (
        SELECT 1 FROM config.workflow_tipos_accion x
        WHERE x.codigo = t.codigo AND x.codigo_proceso = p.codigo_proceso
    );
    IF @@ROWCOUNT > 0
        PRINT 'Tipos de acción EM sembrados (AUTORIZAR/ENVIAR/DEVOLVER/CANCELAR/CERRAR/RECHAZAR x 3 procesos).';
    ELSE
        PRINT 'Tipos de acción EM ya existen. Skip.';

    -- =========================================================================
    -- 2. LIMPIEZA "DESDE CERO" DE LOS FLUJOS EM (selección, rutas, matriz)
    --    Borra los workflows de los tres procesos con toda su configuración.
    --    Orden: hijos -> acciones -> pasos -> workflows (respeta las FKs).
    -- =========================================================================

    DECLARE @procesos_em TABLE (codigo_proceso VARCHAR(50) PRIMARY KEY);
    INSERT INTO @procesos_em (codigo_proceso)
    VALUES ('EDUCACION_MEDICA_SELECCION'), ('EDUCACION_MEDICA_RUTAS'), ('EDUCACION_MEDICA_MATRIZ');

    DECLARE @wf_em TABLE (id_workflow INT PRIMARY KEY);
    INSERT INTO @wf_em (id_workflow)
    SELECT w.id_workflow
    FROM config.workflows w
    JOIN @procesos_em t ON t.codigo_proceso = w.codigo_proceso;

    DECLARE @pasos_em TABLE (id_paso INT PRIMARY KEY);
    INSERT INTO @pasos_em (id_paso)
    SELECT p.id_paso
    FROM config.workflow_pasos p
    JOIN @wf_em w ON w.id_workflow = p.id_workflow;

    DECLARE @acciones_em TABLE (id_accion INT PRIMARY KEY);
    INSERT INTO @acciones_em (id_accion)
    SELECT a.id_accion
    FROM config.workflow_acciones a
    JOIN @pasos_em p ON p.id_paso = a.id_paso_origen;

    DECLARE @recordatorios_em TABLE (id_recordatorio INT PRIMARY KEY);
    INSERT INTO @recordatorios_em (id_recordatorio)
    SELECT r.id_recordatorio
    FROM config.workflow_recordatorio r
    JOIN @wf_em w ON w.id_workflow = r.id_workflow;

    -- 2.1 Hijos de recordatorios y canales de notificación
    DELETE l FROM config.workflow_recordatorio_log l
        JOIN @recordatorios_em r ON r.id_recordatorio = l.id_recordatorio;
    DELETE c FROM config.workflow_recordatorio_canal c
        JOIN @recordatorios_em r ON r.id_recordatorio = c.id_recordatorio;
    DELETE c FROM config.workflow_notificacion_canal c
        JOIN config.workflow_notificaciones n ON n.id_notificacion = c.id_notificacion
        WHERE n.id_accion IN (SELECT id_accion FROM @acciones_em)
           OR n.id_paso_destino IN (SELECT id_paso FROM @pasos_em);

    -- 2.2 Configuración dependiente de acciones/pasos
    DELETE n FROM config.workflow_notificaciones n
        WHERE n.id_accion IN (SELECT id_accion FROM @acciones_em)
           OR n.id_paso_destino IN (SELECT id_paso FROM @pasos_em);
    DELETE c FROM config.workflow_condiciones c
        WHERE c.id_accion IN (SELECT id_accion FROM @acciones_em)
           OR c.id_paso_si_cumple IN (SELECT id_paso FROM @pasos_em);
    DELETE h FROM config.workflow_accion_handlers h
        WHERE h.id_accion IN (SELECT id_accion FROM @acciones_em);
    DELETE b FROM config.workflow_bitacora b
        WHERE b.id_workflow IN (SELECT id_workflow FROM @wf_em);

    -- 2.3 Acciones, participantes y configuración del workflow
    DELETE a FROM config.workflow_acciones a
        WHERE a.id_paso_origen IN (SELECT id_paso FROM @pasos_em)
           OR a.id_paso_destino IN (SELECT id_paso FROM @pasos_em);
    DELETE pa FROM config.workflow_participantes pa
        WHERE pa.id_paso IN (SELECT id_paso FROM @pasos_em);
    DELETE j FROM config.workflow_jefes_excluidos j
        WHERE j.id_workflow IN (SELECT id_workflow FROM @wf_em);
    DELETE m FROM config.workflow_mappings m
        WHERE m.id_workflow IN (SELECT id_workflow FROM @wf_em);
    DELETE r FROM config.workflow_recordatorio r
        WHERE r.id_recordatorio IN (SELECT id_recordatorio FROM @recordatorios_em);
    DELETE p FROM config.workflow_pasos p
        WHERE p.id_paso IN (SELECT id_paso FROM @pasos_em);
    DELETE w FROM config.workflows w
        WHERE w.id_workflow IN (SELECT id_workflow FROM @wf_em);

    PRINT 'Limpieza desde cero de los flujos EM (selección, rutas, matriz) completada.';

    -- =========================================================================
    -- 3. CATÁLOGO DEL MOTOR (estados, scope y tipos de acción por proceso)
    -- =========================================================================

    -- 3.1 Estados del catálogo (misma convención que OC y Solicitudes)
    IF NOT EXISTS (SELECT 1 FROM config.workflow_estados WHERE codigo = 'RECHAZADA')
    BEGIN
        INSERT INTO config.workflow_estados (codigo, nombre, color_hex, activo)
        VALUES ('RECHAZADA', 'Rechazada', '#fc3d3d', 1);
        PRINT 'Estado [RECHAZADA] agregado al catálogo config.workflow_estados.';
    END

    DECLARE @eCreada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'CREADA');
    DECLARE @eRevision INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'REVISION');
    DECLARE @ePreparacion INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'PREPARACION');
    DECLARE @eRevisionDirector INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'REVISION_DIRECTOR');
    DECLARE @eCerrada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'CERRADA');
    DECLARE @eRechazada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'RECHAZADA');
    DECLARE @eCancelada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'CANCELADA');

    IF @eCreada IS NULL OR @eRevision IS NULL OR @ePreparacion IS NULL
       OR @eRevisionDirector IS NULL OR @eCerrada IS NULL OR @eRechazada IS NULL OR @eCancelada IS NULL
    BEGIN
        RAISERROR('Faltan estados en config.workflow_estados (se esperan CREADA, REVISION, PREPARACION, REVISION_DIRECTOR, CERRADA, RECHAZADA, CANCELADA).', 16, 1);
    END

    -- 3.2 Scope type TIPO_GERENCIA (para crear los mappings por gerencia en el frontend)
    IF NOT EXISTS (SELECT 1 FROM config.workflow_scope_types WHERE codigo = 'TIPO_GERENCIA')
    BEGIN
        INSERT INTO config.workflow_scope_types (codigo, nombre, nivel_prioridad, descripcion, activo, fecha_creacion)
        VALUES ('TIPO_GERENCIA', 'Tipo de gerencia (Educación Médica)', 20,
                'Rutea EDUCACION_MEDICA_SELECCION, EDUCACION_MEDICA_RUTAS y EDUCACION_MEDICA_MATRIZ a su variante por gerencia (1 = IMSS, 2 = Descentralizado)', 1, GETDATE());
        PRINT 'Scope type [TIPO_GERENCIA] creado (usa este scope para los mappings en el frontend).';
    END
    ELSE
    BEGIN
        PRINT 'Scope type [TIPO_GERENCIA] ya existe. Skip.';
    END

    -- 3.3 Limpieza: el scope SUBPROCESO quedó OBSOLETO (versión previa; el ruteo
    --     ahora es por TIPO_GERENCIA). Solo se elimina si ningún mapping lo usa.
    DELETE s
    FROM config.workflow_scope_types s
    WHERE s.codigo = 'SUBPROCESO'
      AND NOT EXISTS (SELECT 1 FROM config.workflow_mappings m WHERE m.id_scope_type = s.id_scope_type);
    IF @@ROWCOUNT > 0
        PRINT 'Scope type obsoleto [SUBPROCESO] eliminado (sin mappings que lo usen).';

    -- 3.4 Tipos de acción por proceso (sembrados en la sección 1)
    DECLARE @selAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR' AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR'    AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER'  AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selCancelar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CANCELAR'  AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selCerrar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CERRAR'    AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selRechazar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'RECHAZAR'  AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');

    DECLARE @rutAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR' AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR'    AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER'  AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutCancelar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CANCELAR'  AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutCerrar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CERRAR'    AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutRechazar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'RECHAZAR'  AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');

    DECLARE @matAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR' AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR'    AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER'  AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matCancelar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CANCELAR'  AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matCerrar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CERRAR'    AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matRechazar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'RECHAZAR'  AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');

    IF @selAutorizar IS NULL OR @rutAutorizar IS NULL OR @matAutorizar IS NULL
       OR @selCerrar IS NULL OR @rutCerrar IS NULL OR @matCerrar IS NULL
       OR @selRechazar IS NULL OR @rutRechazar IS NULL OR @matRechazar IS NULL
    BEGIN
        RAISERROR('Faltan tipos de acción por proceso en config.workflow_tipos_accion (AUTORIZAR/CERRAR/RECHAZAR).', 16, 1);
    END

    -- =========================================================================
    -- 4. FLUJOS (6 variantes de 6 pasos: Creada + intermedios + 3 finales)
    --    CANCELAR en todos los pasos excepto el penúltimo;
    --    RECHAZAR en todos los intermedios y en el penúltimo;
    --    el penúltimo cierra (CERRAR) o rechaza (RECHAZAR).
    -- =========================================================================

    -----------------------------------------------------------------------------
    -- 4.1 EDUCACION_MEDICA_SELECCION · 'Selección mensual - IMSS'
    --     Creada -> Firma GG -> Firma GV IMSS -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfSelImss INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Selección mensual - IMSS', 'Selección mensual de hospitales de IMSS: firma Gerencia General y después el Gerente de Ventas IMSS, quien cierra o rechaza.', 'EDUCACION_MEDICA_SELECCION', 1, 1, GETDATE());
    SET @wfSelImss = SCOPE_IDENTITY();
    PRINT 'Workflow [Selección mensual - IMSS] creado (id ' + CAST(@wfSelImss AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo, permite_editar)
    VALUES
        (@wfSelImss,  0, 'Creada',                         @eCreada,   'Selección capturada; editable solo en este paso.',                                   1, 0, 0, 0, 0, 1, 1, 1),
        (@wfSelImss, 10, 'Firma Gerencia General',         @eRevision, 'Gerencia General firma y solicita la firma del Gerente de Ventas (IDT-003 5.1.3).', 0, 0, 1, 0, 0, 1, 1, 1),
        (@wfSelImss, 20, 'Firma Gerente de Ventas - IMSS', @eRevision, 'Firma del Gerente de Ventas de la gerencia IMSS; cierra (Queda autorizada) o rechaza.', 0, 0, 1, 0, 0, 1, 1, 1),
        (@wfSelImss, 30, 'Cerrada',                        @eCerrada,  'Selección completa y autorizada; habilita la planificación de rutas.',               0, 1, 0, 0, 0, 1, 1, 0),
        (@wfSelImss, 40, 'Rechazada',                      @eRechazada,'Selección rechazada en alguna firma.',                                               0, 1, 0, 0, 0, 1, 1, 0),
        (@wfSelImss, 50, 'Cancelada',                      @eCancelada,'Selección cancelada por el creador.',                                                0, 1, 0, 0, 0, 1, 1, 0);

    DECLARE @siCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 0);
    DECLARE @siGg     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 10);
    DECLARE @siGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 20);
    DECLARE @siFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 30);
    DECLARE @siRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 40);
    DECLARE @siCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 50);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@siCreada, @siGg,   @selEnviar,   1),
        (@siCreada, @siCan,  @selCancelar, 1),
        (@siGg,     @siGv,   @selAutorizar,1),
        (@siGg,     @siCreada, @selDevolver,1),
        (@siGg,     @siRech, @selRechazar, 1),
        (@siGg,     @siCan,  @selCancelar, 1),
        (@siGv,     @siFin,  @selCerrar,   1),
        (@siGv,     @siCreada, @selDevolver,1),
        (@siGv,     @siRech, @selRechazar, 1);

    -----------------------------------------------------------------------------
    -- 4.2 EDUCACION_MEDICA_SELECCION · 'Selección mensual - Descentralizado'
    --     Creada -> Firma GG -> Firma GV Desc. -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfSelDesc INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Selección mensual - Descentralizado', 'Selección mensual de hospitales Descentralizados: firma Gerencia General y después el Gerente de Ventas Descentralizado, quien cierra o rechaza.', 'EDUCACION_MEDICA_SELECCION', 1, 1, GETDATE());
    SET @wfSelDesc = SCOPE_IDENTITY();
    PRINT 'Workflow [Selección mensual - Descentralizado] creado (id ' + CAST(@wfSelDesc AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo, permite_editar)
    VALUES
        (@wfSelDesc,  0, 'Creada',                                    @eCreada,   'Selección capturada; editable solo en este paso.',                                   1, 0, 0, 0, 0, 1, 1, 1),
        (@wfSelDesc, 10, 'Firma Gerencia General',                    @eRevision, 'Gerencia General firma y solicita la firma del Gerente de Ventas (IDT-003 5.1.3).', 0, 0, 1, 0, 0, 1, 1, 1),
        (@wfSelDesc, 20, 'Firma Gerente de Ventas - Descentralizado', @eRevision, 'Firma del Gerente de Ventas de la gerencia Descentralizado; cierra (Queda autorizada) o rechaza.', 0, 0, 1, 0, 0, 1, 1, 1),
        (@wfSelDesc, 30, 'Cerrada',                                   @eCerrada,  'Selección completa y autorizada; habilita la planificación de rutas.',               0, 1, 0, 0, 0, 1, 1, 0),
        (@wfSelDesc, 40, 'Rechazada',                                 @eRechazada,'Selección rechazada en alguna firma.',                                               0, 1, 0, 0, 0, 1, 1, 0),
        (@wfSelDesc, 50, 'Cancelada',                                 @eCancelada,'Selección cancelada por el creador.',                                                0, 1, 0, 0, 0, 1, 1, 0);

    DECLARE @sdCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 0);
    DECLARE @sdGg     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 10);
    DECLARE @sdGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 20);
    DECLARE @sdFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 30);
    DECLARE @sdRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 40);
    DECLARE @sdCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 50);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@sdCreada, @sdGg,    @selEnviar,   1),
        (@sdCreada, @sdCan,   @selCancelar, 1),
        (@sdGg,     @sdGv,    @selAutorizar,1),
        (@sdGg,     @sdCreada, @selDevolver,1),
        (@sdGg,     @sdRech,  @selRechazar, 1),
        (@sdGg,     @sdCan,   @selCancelar, 1),
        (@sdGv,     @sdFin,   @selCerrar,   1),
        (@sdGv,     @sdCreada, @selDevolver,1),
        (@sdGv,     @sdRech,  @selRechazar, 1);

    -----------------------------------------------------------------------------
    -- 4.3 EDUCACION_MEDICA_RUTAS · 'Rutas - IMSS'
    --     Creada -> Firma GV IMSS -> Revisión CA -> Autorización DC -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfRutImss INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Rutas - IMSS', 'Autorización de la versión de rutas de IMSS: firma GV IMSS, revisión de costos del Coordinador Administrativo y cierre o rechazo de Dirección Corporativa.', 'EDUCACION_MEDICA_RUTAS', 1, 1, GETDATE());
    SET @wfRutImss = SCOPE_IDENTITY();
    PRINT 'Workflow [Rutas - IMSS] creado (id ' + CAST(@wfRutImss AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo, permite_editar)
    VALUES
        (@wfRutImss,  0, 'Creada',                            @eCreada,           'Propuesta generada; editable solo en este paso.',                                       1, 0, 0, 0, 0, 1, 1, 0),
        (@wfRutImss, 10, 'Firma Gerente de Ventas - IMSS',    @eRevision,         'Firma del Gerente de Ventas IMSS (concentra y firma, IDT-003 5.2.3).',                  0, 0, 1, 0, 0, 1, 1, 0),
        (@wfRutImss, 20, 'Revisión Coordinador Administrativo', @ePreparacion,    'Revisa costos y firma la matriz (IDT-004 5.2).',                                        0, 0, 1, 0, 0, 1, 1, 0),
        (@wfRutImss, 30, 'Autorización Dirección Corporativa',  @eRevisionDirector,'Dirección Corporativa cierra (rutas confirmadas) o rechaza (IDT-004 5.2).',            0, 0, 1, 0, 0, 1, 1, 0),
        (@wfRutImss, 40, 'Cerrada',                           @eCerrada,          'Rutas confirmadas; se publican las asignaciones a los ejecutivos.',                     0, 1, 0, 0, 0, 1, 1, 0),
        (@wfRutImss, 50, 'Rechazada',                         @eRechazada,        'Versión rechazada en alguna firma.',                                                    0, 1, 0, 0, 0, 1, 1, 0),
        (@wfRutImss, 60, 'Cancelada',                         @eCancelada,        'Versión cancelada; habilita regenerar (solo el creador puede cancelar).',               0, 1, 0, 0, 0, 1, 1, 0);

    DECLARE @riCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 0);
    DECLARE @riGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 10);
    DECLARE @riCa     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 20);
    DECLARE @riDc     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 30);
    DECLARE @riFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 40);
    DECLARE @riRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 50);
    DECLARE @riCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 60);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@riCreada, @riGv,    @rutEnviar,    1),
        (@riCreada, @riCan,   @rutCancelar,  1),
        (@riGv,     @riCa,    @rutAutorizar, 1),
        (@riGv,     @riCreada,@rutDevolver,  1),
        (@riGv,     @riRech,  @rutRechazar,  1),
        (@riGv,     @riCan,   @rutCancelar,  1),
        (@riCa,     @riDc,    @rutAutorizar, 1),
        (@riCa,     @riCreada,@rutDevolver,  1),
        (@riCa,     @riRech,  @rutRechazar,  1),
        (@riCa,     @riCan,   @rutCancelar,  1),
        (@riDc,     @riFin,   @rutCerrar,    1),
        (@riDc,     @riCreada,@rutDevolver,  1),
        (@riDc,     @riRech,  @rutRechazar,  1);

    -----------------------------------------------------------------------------
    -- 4.4 EDUCACION_MEDICA_RUTAS · 'Rutas - Descentralizado'
    --     Creada -> Firma GV Desc. -> Revisión CA -> Autorización DC -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfRutDesc INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Rutas - Descentralizado', 'Autorización de la versión de rutas Descentralizadas: firma GV Descentralizado, revisión de costos del Coordinador Administrativo y cierre o rechazo de Dirección Corporativa.', 'EDUCACION_MEDICA_RUTAS', 1, 1, GETDATE());
    SET @wfRutDesc = SCOPE_IDENTITY();
    PRINT 'Workflow [Rutas - Descentralizado] creado (id ' + CAST(@wfRutDesc AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo, permite_editar)
    VALUES
        (@wfRutDesc,  0, 'Creada',                                       @eCreada,           'Propuesta generada; editable solo en este paso.',                                       1, 0, 0, 0, 0, 1, 1, 0),
        (@wfRutDesc, 10, 'Firma Gerente de Ventas - Descentralizado',    @eRevision,         'Firma del Gerente de Ventas Descentralizado (concentra y firma, IDT-003 5.2.3).',      0, 0, 1, 0, 0, 1, 1, 0),
        (@wfRutDesc, 20, 'Revisión Coordinador Administrativo',          @ePreparacion,      'Revisa costos y firma la matriz (IDT-004 5.2).',                                        0, 0, 1, 0, 0, 1, 1, 0),
        (@wfRutDesc, 30, 'Autorización Dirección Corporativa',           @eRevisionDirector, 'Dirección Corporativa cierra (rutas confirmadas) o rechaza (IDT-004 5.2).',            0, 0, 1, 0, 0, 1, 1, 0),
        (@wfRutDesc, 40, 'Cerrada',                                      @eCerrada,          'Rutas confirmadas; se publican las asignaciones a los ejecutivos.',                     0, 1, 0, 0, 0, 1, 1, 0),
        (@wfRutDesc, 50, 'Rechazada',                                    @eRechazada,        'Versión rechazada en alguna firma.',                                                    0, 1, 0, 0, 0, 1, 1, 0),
        (@wfRutDesc, 60, 'Cancelada',                                    @eCancelada,        'Versión cancelada; habilita regenerar (solo el creador puede cancelar).',               0, 1, 0, 0, 0, 1, 1, 0);

    DECLARE @rdCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 0);
    DECLARE @rdGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 10);
    DECLARE @rdCa     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 20);
    DECLARE @rdDc     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 30);
    DECLARE @rdFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 40);
    DECLARE @rdRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 50);
    DECLARE @rdCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 60);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@rdCreada, @rdGv,    @rutEnviar,    1),
        (@rdCreada, @rdCan,   @rutCancelar,  1),
        (@rdGv,     @rdCa,    @rutAutorizar, 1),
        (@rdGv,     @rdCreada,@rutDevolver,  1),
        (@rdGv,     @rdRech,  @rutRechazar,  1),
        (@rdGv,     @rdCan,   @rutCancelar,  1),
        (@rdCa,     @rdDc,    @rutAutorizar, 1),
        (@rdCa,     @rdCreada,@rutDevolver,  1),
        (@rdCa,     @rdRech,  @rutRechazar,  1),
        (@rdCa,     @rdCan,   @rutCancelar,  1),
        (@rdDc,     @rdFin,   @rutCerrar,    1),
        (@rdDc,     @rdCreada,@rutDevolver,  1),
        (@rdDc,     @rdRech,  @rutRechazar,  1);

    -----------------------------------------------------------------------------
    -- 4.5 EDUCACION_MEDICA_MATRIZ · 'Matriz de talleres - IMSS'
    --     Creada -> Firma GV IMSS -> Costos AEM -> Revisión CA -> Autorización DC -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfMatImss INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Matriz de talleres - IMSS', 'Autorización de la matriz de talleres de IMSS: firma del Gerente de Ventas IMSS, costos del AEM, revisión del CA y cierre o rechazo de DC.', 'EDUCACION_MEDICA_MATRIZ', 1, 1, GETDATE());
    SET @wfMatImss = SCOPE_IDENTITY();
    PRINT 'Workflow [Matriz de talleres - IMSS] creado (id ' + CAST(@wfMatImss AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo, permite_editar)
    VALUES
        (@wfMatImss,  0, 'Creada',                           @eCreada,           'Los equipos de pareo capturan talleres; la matriz es editable solo en este paso.',  1, 0, 0, 0, 0, 1, 1, 0),
        (@wfMatImss, 10, 'Firma Gerente de Ventas - IMSS',   @eRevision,         'El Gerente de Ventas IMSS revisa la concentración por equipo y firma la matriz (IDT-003 5.2.3).', 0, 0, 1, 0, 0, 1, 1, 0),
        (@wfMatImss, 20, 'Registro de costos - AEM',         @ePreparacion,      'El Auxiliar Administrativo de Educación Médica registra los costos (muestras, folletos, envío, box lunch) y envía (IDT-004 5.1).', 0, 0, 0, 0, 0, 1, 1, 0),
        (@wfMatImss, 30, 'Revisión de costos - CA',          @eRevision,         'El Coordinador Administrativo revisa los costos contra políticas y firma (IDT-004 5.2).', 0, 0, 1, 0, 0, 1, 1, 0),
        (@wfMatImss, 40, 'Autorización - DC',                @eRevisionDirector, 'Dirección Corporativa cierra (matriz autorizada) o rechaza (IDT-004 5.2).',          0, 0, 1, 0, 0, 1, 1, 0),
        (@wfMatImss, 50, 'Cerrada',                          @eCerrada,          'Matriz completa y autorizada; los talleres pasan a Autorizado.',                    0, 1, 0, 0, 0, 1, 1, 0),
        (@wfMatImss, 60, 'Rechazada',                        @eRechazada,        'Matriz rechazada en alguna firma.',                                                 0, 1, 0, 0, 0, 1, 1, 0),
        (@wfMatImss, 70, 'Cancelada',                        @eCancelada,        'Matriz cancelada por el creador.',                                                  0, 1, 0, 0, 0, 1, 1, 0);

    DECLARE @miCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 0);
    DECLARE @miGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 10);
    DECLARE @miAem    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 20);
    DECLARE @miCa     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 30);
    DECLARE @miDc     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 40);
    DECLARE @miFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 50);
    DECLARE @miRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 60);
    DECLARE @miCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 70);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@miCreada, @miGv,    @matEnviar,    1),
        (@miCreada, @miCan,   @matCancelar,  1),
        (@miGv,     @miAem,   @matAutorizar, 1),
        (@miGv,     @miCreada,@matDevolver,  1),
        (@miGv,     @miRech,  @matRechazar,  1),
        (@miGv,     @miCan,   @matCancelar,  1),
        (@miAem,    @miCa,    @matEnviar,    1),
        (@miAem,    @miCreada,@matDevolver,  1),
        (@miAem,    @miRech,  @matRechazar,  1),
        (@miAem,    @miCan,   @matCancelar,  1),
        (@miCa,     @miDc,    @matAutorizar, 1),
        (@miCa,     @miAem,   @matDevolver,  1),
        (@miCa,     @miRech,  @matRechazar,  1),
        (@miCa,     @miCan,   @matCancelar,  1),
        (@miDc,     @miFin,   @matCerrar,    1),
        (@miDc,     @miCa,    @matDevolver,  1),
        (@miDc,     @miRech,  @matRechazar,  1);

    -----------------------------------------------------------------------------
    -- 4.6 EDUCACION_MEDICA_MATRIZ · 'Matriz de talleres - Descentralizado'
    --     Creada -> Firma GV Desc. -> Costos AEM -> Revisión CA -> Autorización DC -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfMatDesc INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Matriz de talleres - Descentralizado', 'Autorización de la matriz de talleres Descentralizados: firma del Gerente de Ventas, costos del AEM, revisión del CA y cierre o rechazo de DC.', 'EDUCACION_MEDICA_MATRIZ', 1, 1, GETDATE());
    SET @wfMatDesc = SCOPE_IDENTITY();
    PRINT 'Workflow [Matriz de talleres - Descentralizado] creado (id ' + CAST(@wfMatDesc AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo, permite_editar)
    VALUES
        (@wfMatDesc,  0, 'Creada',                                    @eCreada,           'Los equipos de pareo capturan talleres; la matriz es editable solo en este paso.',  1, 0, 0, 0, 0, 1, 1, 0),
        (@wfMatDesc, 10, 'Firma Gerente de Ventas - Descentralizado', @eRevision,         'El Gerente de Ventas Descentralizado revisa la concentración por equipo y firma la matriz (IDT-003 5.2.3).', 0, 0, 1, 0, 0, 1, 1, 0),
        (@wfMatDesc, 20, 'Registro de costos - AEM',                  @ePreparacion,      'El Auxiliar Administrativo de Educación Médica registra los costos (muestras, folletos, envío, box lunch) y envía (IDT-004 5.1).', 0, 0, 0, 0, 0, 1, 1, 0),
        (@wfMatDesc, 30, 'Revisión de costos - CA',                   @eRevision,         'El Coordinador Administrativo revisa los costos contra políticas y firma (IDT-004 5.2).', 0, 0, 1, 0, 0, 1, 1, 0),
        (@wfMatDesc, 40, 'Autorización - DC',                         @eRevisionDirector, 'Dirección Corporativa cierra (matriz autorizada) o rechaza (IDT-004 5.2).',          0, 0, 1, 0, 0, 1, 1, 0),
        (@wfMatDesc, 50, 'Cerrada',                                   @eCerrada,          'Matriz completa y autorizada; los talleres pasan a Autorizado.',                    0, 1, 0, 0, 0, 1, 1, 0),
        (@wfMatDesc, 60, 'Rechazada',                                 @eRechazada,        'Matriz rechazada en alguna firma.',                                                 0, 1, 0, 0, 0, 1, 1, 0),
        (@wfMatDesc, 70, 'Cancelada',                                 @eCancelada,        'Matriz cancelada por el creador.',                                                  0, 1, 0, 0, 0, 1, 1, 0);

    DECLARE @mdCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 0);
    DECLARE @mdGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 10);
    DECLARE @mdAem    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 20);
    DECLARE @mdCa     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 30);
    DECLARE @mdDc     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 40);
    DECLARE @mdFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 50);
    DECLARE @mdRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 60);
    DECLARE @mdCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 70);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@mdCreada, @mdGv,    @matEnviar,    1),
        (@mdCreada, @mdCan,   @matCancelar,  1),
        (@mdGv,     @mdAem,   @matAutorizar, 1),
        (@mdGv,     @mdCreada,@matDevolver,  1),
        (@mdGv,     @mdRech,  @matRechazar,  1),
        (@mdGv,     @mdCan,   @matCancelar,  1),
        (@mdAem,    @mdCa,    @matEnviar,    1),
        (@mdAem,    @mdCreada,@matDevolver,  1),
        (@mdAem,    @mdRech,  @matRechazar,  1),
        (@mdAem,    @mdCan,   @matCancelar,  1),
        (@mdCa,     @mdDc,    @matAutorizar, 1),
        (@mdCa,     @mdAem,   @matDevolver,  1),
        (@mdCa,     @mdRech,  @matRechazar,  1),
        (@mdCa,     @mdCan,   @matCancelar,  1),
        (@mdDc,     @mdFin,   @matCerrar,    1),
        (@mdDc,     @mdCa,    @matDevolver,  1),
        (@mdDc,     @mdRech,  @matRechazar,  1);

    -- =========================================================================
    -- 5. ESTADOS DE DOMINIO: nomenclatura nueva + backfill de entidades
    --    (se ejecuta DESPUÉS de recrear los workflows para poder re-vincular)
    -- =========================================================================

    -- 5.1 Relajar CHECKs vigentes (aún permiten los valores viejos)
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.selecciones_mensuales') AND name = 'CK_selecciones_mensuales_estado')
        ALTER TABLE educacion_medica.selecciones_mensuales DROP CONSTRAINT CK_selecciones_mensuales_estado;
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.rutas') AND name = 'CK_rutas_estado')
        ALTER TABLE educacion_medica.rutas DROP CONSTRAINT CK_rutas_estado;
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.rutas_versiones') AND name = 'CK_rutas_versiones_estado')
        ALTER TABLE educacion_medica.rutas_versiones DROP CONSTRAINT CK_rutas_versiones_estado;
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.talleres') AND name = 'CK_talleres_estado')
        ALTER TABLE educacion_medica.talleres DROP CONSTRAINT CK_talleres_estado;

    -- 5.2 Renombrar estados de dominio existentes a la nueva nomenclatura
    UPDATE educacion_medica.selecciones_mensuales SET estado = 'Creada'  WHERE estado = 'Borrador';
    UPDATE educacion_medica.selecciones_mensuales SET estado = 'Cerrada' WHERE estado = 'Autorizada';
    UPDATE educacion_medica.rutas             SET estado = 'Creada'  WHERE estado = 'Draft';
    UPDATE educacion_medica.rutas             SET estado = 'Cerrada' WHERE estado = 'Confirmada';
    UPDATE educacion_medica.rutas_versiones   SET estado = 'Creada'  WHERE estado = 'Draft';
    UPDATE educacion_medica.rutas_versiones   SET estado = 'Cerrada' WHERE estado = 'Confirmada';
    UPDATE educacion_medica.talleres          SET estado = 'Creada'  WHERE estado = 'Borrador';
    PRINT 'Estados de dominio renombrados (Borrador->Creada, Autorizada->Cerrada, Draft->Creada, Confirmada->Cerrada, talleres Borrador->Creada).';

    -- 5.3 CHECKs nuevos + defaults
    ALTER TABLE educacion_medica.selecciones_mensuales ADD CONSTRAINT CK_selecciones_mensuales_estado
        CHECK (estado IN ('Creada','EnRevision','Cerrada','Rechazada','Cancelada'));
    ALTER TABLE educacion_medica.rutas ADD CONSTRAINT CK_rutas_estado
        CHECK (estado IN ('Creada','Cerrada','Rechazada','Cancelada','Archivada'));
    ALTER TABLE educacion_medica.rutas_versiones ADD CONSTRAINT CK_rutas_versiones_estado
        CHECK (estado IN ('Creada','Cerrada','Rechazada','Cancelada','Archivada'));
    ALTER TABLE educacion_medica.talleres ADD CONSTRAINT CK_talleres_estado
        CHECK (estado IN ('Creada','Elaborado','Revisado','Autorizado','Programado','EnCurso','Realizado','Cancelado'));

    DECLARE @df sysname;
    SELECT @df = dc.name FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('educacion_medica.selecciones_mensuales') AND c.name = 'estado';
    IF @df IS NOT NULL EXEC('ALTER TABLE educacion_medica.selecciones_mensuales DROP CONSTRAINT [' + @df + ']');
    ALTER TABLE educacion_medica.selecciones_mensuales ADD CONSTRAINT DF_selecciones_mensuales_estado DEFAULT ('Creada') FOR estado;

    SELECT @df = dc.name FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('educacion_medica.rutas_versiones') AND c.name = 'estado';
    IF @df IS NOT NULL EXEC('ALTER TABLE educacion_medica.rutas_versiones DROP CONSTRAINT [' + @df + ']');
    ALTER TABLE educacion_medica.rutas_versiones ADD CONSTRAINT DF_rutas_versiones_estado DEFAULT ('Creada') FOR estado;

    SELECT @df = dc.name FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('educacion_medica.talleres') AND c.name = 'estado';
    IF @df IS NOT NULL EXEC('ALTER TABLE educacion_medica.talleres DROP CONSTRAINT [' + @df + ']');
    ALTER TABLE educacion_medica.talleres ADD CONSTRAINT DF_talleres_estado DEFAULT ('Creada') FOR estado;

    PRINT 'CHECKs y defaults de estado actualizados (selecciones, rutas, rutas_versiones, talleres).';

    -- 5.4 Backfill: re-vincular selecciones huérfanas al paso que corresponde a su estado
    UPDATE educacion_medica.selecciones_mensuales
    SET id_workflow = w.id_workflow,
        id_paso_actual = p.id_paso,
        id_estado = p.id_estado
    FROM educacion_medica.selecciones_mensuales s
    JOIN (VALUES
            (1, 'Selección mensual - IMSS'),
            (2, 'Selección mensual - Descentralizado')
         ) AS g(id_tipo_gerencia, nombre_workflow)
        ON g.id_tipo_gerencia = s.id_tipo_gerencia
    JOIN config.workflows w
        ON w.codigo_proceso = 'EDUCACION_MEDICA_SELECCION'
       AND w.nombre = g.nombre_workflow
    JOIN (VALUES
            ('Creada', 0),
            ('EnRevision', 10),
            ('Cerrada', 30),
            ('Rechazada', 40),
            ('Cancelada', 50)
         ) AS o(estado, orden)
        ON o.estado = s.estado
    JOIN config.workflow_pasos p
        ON p.id_workflow = w.id_workflow
       AND p.orden = o.orden
    WHERE NOT EXISTS (SELECT 1 FROM config.workflows w2 WHERE w2.id_workflow = s.id_workflow);
    PRINT 'Backfill de selecciones: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' fila(s) re-vinculada(s).';

    -- 5.5 Backfill: re-vincular versiones de rutas huérfanas
    UPDATE educacion_medica.rutas_versiones
    SET id_workflow = w.id_workflow,
        id_paso_actual = p.id_paso,
        id_estado = p.id_estado
    FROM educacion_medica.rutas_versiones v
    JOIN (VALUES
            (1, 'Rutas - IMSS'),
            (2, 'Rutas - Descentralizado')
         ) AS g(id_tipo_gerencia, nombre_workflow)
        ON g.id_tipo_gerencia = v.id_tipo_gerencia
    JOIN config.workflows w
        ON w.codigo_proceso = 'EDUCACION_MEDICA_RUTAS'
       AND w.nombre = g.nombre_workflow
    JOIN (VALUES
            ('Creada', 0),
            ('Cerrada', 40),
            ('Rechazada', 50),
            ('Cancelada', 60),
            ('Archivada', 40)
         ) AS o(estado, orden)
        ON o.estado = v.estado
    JOIN config.workflow_pasos p
        ON p.id_workflow = w.id_workflow
       AND p.orden = o.orden
    WHERE NOT EXISTS (SELECT 1 FROM config.workflows w2 WHERE w2.id_workflow = v.id_workflow);
    PRINT 'Backfill de rutas_versiones: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' fila(s) re-vinculada(s).';

    -- 5.6 Backfill: re-vincular matrices generales huérfanas al paso inicial
    --      (0018 borra y recrea los workflows; sin este backfill las matrices
    --      existentes quedan apuntando a workflows que ya no existen).
    UPDATE educacion_medica.matrices_generales
    SET id_workflow = w.id_workflow,
        id_paso_actual = p.id_paso,
        id_estado = p.id_estado,
        fecha_modificacion = GETDATE()
    FROM educacion_medica.matrices_generales mg
    JOIN (VALUES
            (1, @wfMatImss),
            (2, @wfMatDesc)
         ) AS g(id_tipo_gerencia, id_workflow)
        ON g.id_tipo_gerencia = mg.id_tipo_gerencia
    JOIN config.workflows w
        ON w.id_workflow = g.id_workflow
       AND w.activo = 1
    JOIN config.workflow_pasos p
        ON p.id_workflow = w.id_workflow
       AND p.es_inicio = 1
       AND p.activo = 1
    WHERE NOT EXISTS (SELECT 1 FROM config.workflows w2 WHERE w2.id_workflow = mg.id_workflow);
    PRINT 'Backfill de matrices_generales: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' fila(s) re-vinculada(s).';

    COMMIT TRANSACTION;
    PRINT '0018 completado: 6 flujos EM (selección, rutas, matriz) con patrón Creada + Cerrada/Rechazada/Cancelada.';

    -- =========================================================================
    -- VERIFICACIÓN (ejecutar aparte) y PASOS MANUALES EN EL FRONTEND
    -- =========================================================================
    -- NOTA: si reejecutas 0018, ejecuta después 0040 para recrear los mappings
    --       TIPO_GERENCIA de EDUCACION_MEDICA_MATRIZ que este script elimina en 2.3.
    -- SELECT id_workflow, nombre, codigo_proceso FROM config.workflows
    --   WHERE codigo_proceso LIKE 'EDUCACION_MEDICA%' ORDER BY codigo_proceso, nombre;
    -- SELECT p.id_workflow, p.orden, p.nombre_paso, e.codigo AS estado, p.es_inicio, p.es_final, p.requiere_firma
    --   FROM config.workflow_pasos p LEFT JOIN config.workflow_estados e ON e.id_estado = p.id_estado
    --   WHERE p.id_workflow IN (SELECT id_workflow FROM config.workflows WHERE codigo_proceso LIKE 'EDUCACION_MEDICA%')
    --   ORDER BY p.id_workflow, p.orden;
    -- SELECT po.nombre_paso AS origen, pd.nombre_paso AS destino, ta.codigo AS tipo, ta.codigo_proceso
    --   FROM config.workflow_acciones a
    --   JOIN config.workflow_pasos po ON po.id_paso = a.id_paso_origen
    --   JOIN config.workflow_pasos pd ON pd.id_paso = a.id_paso_destino
    --   LEFT JOIN config.workflow_tipos_accion ta ON ta.id_tipo_accion = a.id_tipo_accion
    --   WHERE po.id_workflow IN (SELECT id_workflow FROM config.workflows WHERE codigo_proceso LIKE 'EDUCACION_MEDICA%')
    --   ORDER BY po.id_workflow, po.orden, pd.orden;
    --
    -- FRONTEND (admin de workflows), después de aplicar:
    --   1) MAPPINGS (scope "Tipo de gerencia (Educación Médica)"):
    --        EDUCACION_MEDICA_SELECCION + 1 -> 'Selección mensual - IMSS'
    --        EDUCACION_MEDICA_SELECCION + 2 -> 'Selección mensual - Descentralizado'
    --        EDUCACION_MEDICA_RUTAS     + 1 -> 'Rutas - IMSS'
    --        EDUCACION_MEDICA_RUTAS     + 2 -> 'Rutas - Descentralizado'
    --        EDUCACION_MEDICA_MATRIZ    + 1 -> 'Matriz de talleres - IMSS'
    --        EDUCACION_MEDICA_MATRIZ    + 2 -> 'Matriz de talleres - Descentralizado'
    --      (Sin estos mappings el resolver NO puede distinguir la variante; crearlos
    --       antes de usar cada flujo.)
    --   2) PARTICIPANTES (por paso, en los 6 workflows):
    --        Selección: Firma GG -> usuario GG;  Firma GV -> usuario GV de la gerencia
    --        Rutas:     Firma GV -> usuario GV de la gerencia;  Revisión CA -> usuario CA;  Autorización DC -> usuario DC
    --        Matriz:    Creada (0) y Firma GV (10) -> usuario GV de la gerencia;
    --                   Registro de costos - AEM (20) -> usuario AEM;
    --                   Revisión de costos - CA (30) -> usuario CA;
    --                   Autorización - DC (40) -> usuario DC
    -- =========================================================================
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0018: ' + ERROR_MESSAGE();
    THROW;
END CATCH


-- ===================== 0040_20261029-1200_educacion-medica_reparar-workflow-matriz.lefarma.sql =====================
-- =============================================================================
-- 0040 — Reparar mappings y matrices huérfanas del workflow de matriz
--
-- QUÉ HACE
--   1) Crea los mappings EDUCACION_MEDICA_MATRIZ + TIPO_GERENCIA para
--      IMSS (gerencia 1) y Descentralizado (gerencia 2), si no existe un
--      mapping activo que apunte a un workflow activo.
--   2) Re-vincula las matrices generales cuyo workflow o paso ya no existe,
--      o cuyo paso no pertenece al workflow, al paso inicial del workflow
--      vigente de su gerencia.
--   3) Alinea id_estado con el paso cuando el estado es inválido.
--
--   NO APLICA EL SCRIPT SOLO: lo revisa y ejecuta el usuario.
--   Requiere 0016 y 0018 aplicados.
--
-- IDEMPOTENTE.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF OBJECT_ID('config.workflow_mappings') IS NULL
   OR OBJECT_ID('config.workflow_pasos') IS NULL
   OR OBJECT_ID('config.workflow_scope_types') IS NULL
   OR OBJECT_ID('config.workflows') IS NULL
   OR OBJECT_ID('educacion_medica.matrices_generales') IS NULL
BEGIN
    RAISERROR('Faltan tablas de workflow o educacion_medica.matrices_generales. Ejecute 0016/0018 primero.', 16, 1);
    RETURN;
END;

DECLARE @scopeTipoGerencia int = 0;

SET @scopeTipoGerencia =
    (SELECT TOP 1 id_scope_type
     FROM config.workflow_scope_types
     WHERE codigo = 'TIPO_GERENCIA' AND activo = 1
     ORDER BY id_scope_type);

IF @scopeTipoGerencia IS NULL
BEGIN
    RAISERROR('No existe el scope type TIPO_GERENCIA. Ejecute 0018 primero.', 16, 1);
    RETURN;
END;

DECLARE @wfImss int =
    (SELECT TOP 1 id_workflow
     FROM config.workflows
     WHERE codigo_proceso = 'EDUCACION_MEDICA_MATRIZ'
       AND nombre = 'Matriz de talleres - IMSS'
       AND activo = 1
     ORDER BY id_workflow DESC);

DECLARE @wfDesc int =
    (SELECT TOP 1 id_workflow
     FROM config.workflows
     WHERE codigo_proceso = 'EDUCACION_MEDICA_MATRIZ'
       AND nombre = 'Matriz de talleres - Descentralizado'
       AND activo = 1
     ORDER BY id_workflow DESC);

IF @wfImss IS NULL AND @wfDesc IS NULL
BEGIN
    RAISERROR('No existen workflows activos de matriz (IMSS/Descentralizado). Ejecute 0018 primero.', 16, 1);
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1) Mappings por gerencia
    -- =========================================================================
    IF @wfImss IS NOT NULL
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM config.workflow_mappings m
            JOIN config.workflows w ON w.id_workflow = m.id_workflow AND w.activo = 1
            WHERE m.codigo_proceso = 'EDUCACION_MEDICA_MATRIZ'
              AND m.id_scope_type = @scopeTipoGerencia
              AND m.scope_id = 1
              AND m.activo = 1
        )
        BEGIN
            INSERT INTO config.workflow_mappings
                (codigo_proceso, id_scope_type, scope_id, id_workflow,
                 prioridad_manual, activo, observaciones, fecha_creacion)
            VALUES
                ('EDUCACION_MEDICA_MATRIZ', @scopeTipoGerencia, 1, @wfImss,
                 100, 1, 'Mapping base IMSS (script 0040)', GETDATE());
            PRINT 'Mapping EDUCACION_MEDICA_MATRIZ + gerencia 1 (IMSS) creado.';
        END
        ELSE
            PRINT 'Mapping EDUCACION_MEDICA_MATRIZ + gerencia 1 (IMSS) ya existe. Skip.';
    END
    ELSE
        PRINT 'ADVERTENCIA: no existe workflow activo "Matriz de talleres - IMSS"; no se creó su mapping.';

    IF @wfDesc IS NOT NULL
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM config.workflow_mappings m
            JOIN config.workflows w ON w.id_workflow = m.id_workflow AND w.activo = 1
            WHERE m.codigo_proceso = 'EDUCACION_MEDICA_MATRIZ'
              AND m.id_scope_type = @scopeTipoGerencia
              AND m.scope_id = 2
              AND m.activo = 1
        )
        BEGIN
            INSERT INTO config.workflow_mappings
                (codigo_proceso, id_scope_type, scope_id, id_workflow,
                 prioridad_manual, activo, observaciones, fecha_creacion)
            VALUES
                ('EDUCACION_MEDICA_MATRIZ', @scopeTipoGerencia, 2, @wfDesc,
                 100, 1, 'Mapping base Descentralizado (script 0040)', GETDATE());
            PRINT 'Mapping EDUCACION_MEDICA_MATRIZ + gerencia 2 (Descentralizado) creado.';
        END
        ELSE
            PRINT 'Mapping EDUCACION_MEDICA_MATRIZ + gerencia 2 (Descentralizado) ya existe. Skip.';
    END
    ELSE
        PRINT 'ADVERTENCIA: no existe workflow activo "Matriz de talleres - Descentralizado"; no se creó su mapping.';

    -- =========================================================================
    -- 2) Re-vincular matrices huérfanas al paso inicial
    -- =========================================================================
    DECLARE @map TABLE (
        id_tipo_gerencia int NOT NULL PRIMARY KEY,
        id_workflow int NOT NULL
    );

    IF @wfImss IS NOT NULL
        INSERT INTO @map (id_tipo_gerencia, id_workflow) VALUES (1, @wfImss);

    IF @wfDesc IS NOT NULL
        INSERT INTO @map (id_tipo_gerencia, id_workflow) VALUES (2, @wfDesc);

    UPDATE mg
    SET id_workflow = w.id_workflow,
        id_paso_actual = p.id_paso,
        id_estado = p.id_estado,
        fecha_modificacion = GETDATE()
    FROM educacion_medica.matrices_generales mg
    JOIN @map m ON m.id_tipo_gerencia = mg.id_tipo_gerencia
    JOIN config.workflows w ON w.id_workflow = m.id_workflow AND w.activo = 1
    CROSS APPLY (
        SELECT TOP 1 p.id_paso, p.id_estado
        FROM config.workflow_pasos p
        WHERE p.id_workflow = w.id_workflow
          AND p.es_inicio = 1
          AND p.activo = 1
        ORDER BY p.orden, p.id_paso
    ) p
    WHERE NOT EXISTS (SELECT 1 FROM config.workflows w2 WHERE w2.id_workflow = mg.id_workflow)
       OR mg.id_paso_actual IS NULL
       OR NOT EXISTS (
            SELECT 1
            FROM config.workflow_pasos p2
            WHERE p2.id_paso = mg.id_paso_actual
              AND p2.id_workflow = w.id_workflow
              AND p2.activo = 1
       );

    PRINT 'Matrices re-vinculadas al paso inicial: ' + CAST(@@ROWCOUNT AS varchar(10)) + ' fila(s).';

    -- =========================================================================
    -- 3) Alinear id_estado cuando el paso es válido pero el estado es inválido
    -- =========================================================================
    UPDATE mg
    SET id_estado = p.id_estado,
        fecha_modificacion = GETDATE()
    FROM educacion_medica.matrices_generales mg
    JOIN config.workflow_pasos p
        ON p.id_paso = mg.id_paso_actual
       AND p.id_workflow = mg.id_workflow
       AND p.activo = 1
    WHERE mg.id_estado IS NULL
       OR NOT EXISTS (SELECT 1 FROM config.workflow_estados e WHERE e.id_estado = mg.id_estado);

    PRINT 'Estados alineados: ' + CAST(@@ROWCOUNT AS varchar(10)) + ' fila(s).';

    IF EXISTS (
        SELECT 1
        FROM educacion_medica.matrices_generales mg
        WHERE mg.id_tipo_gerencia NOT IN (1, 2)
          AND (
              mg.id_workflow IS NULL
              OR NOT EXISTS (SELECT 1 FROM config.workflows w WHERE w.id_workflow = mg.id_workflow)
          )
    )
        PRINT 'ADVERTENCIA: hay matrices de gerencias sin workflow configurado (3/4). Crea su variante antes de usarlas.';

    COMMIT TRANSACTION;
    PRINT '0040 completado: mappings y matrices de talleres reparados.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0040: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

-- =============================================================================
-- VERIFICACIÓN (ejecutar aparte)
-- =============================================================================
-- 1) Mappings de matriz
-- SELECT m.id_mapping, m.codigo_proceso, m.id_scope_type, m.scope_id,
--        m.id_workflow, w.nombre, w.activo AS workflow_activo, m.activo
-- FROM config.workflow_mappings m
-- LEFT JOIN config.workflows w ON w.id_workflow = m.id_workflow
-- WHERE m.codigo_proceso = 'EDUCACION_MEDICA_MATRIZ'
-- ORDER BY m.scope_id, m.id_mapping;
--
-- 2) Matrices y su paso
-- SELECT mg.id_matriz_general, mg.id_tipo_gerencia,
--        CONVERT(varchar(10), mg.periodo, 23) AS periodo,
--        mg.id_workflow, w.nombre AS workflow,
--        mg.id_paso_actual, p.nombre_paso, p.es_inicio, mg.id_estado
-- FROM educacion_medica.matrices_generales mg
-- LEFT JOIN config.workflows w ON w.id_workflow = mg.id_workflow
-- LEFT JOIN config.workflow_pasos p
--        ON p.id_paso = mg.id_paso_actual AND p.id_workflow = mg.id_workflow
-- ORDER BY mg.id_matriz_general;
--
-- 3) Matrices huérfanas (debe devolver 0 filas)
-- SELECT mg.id_matriz_general, mg.id_tipo_gerencia, mg.id_workflow, mg.id_paso_actual
-- FROM educacion_medica.matrices_generales mg
-- LEFT JOIN config.workflows w ON w.id_workflow = mg.id_workflow
-- LEFT JOIN config.workflow_pasos p
--        ON p.id_paso = mg.id_paso_actual AND p.id_workflow = mg.id_workflow
-- WHERE mg.id_workflow IS NULL OR w.id_workflow IS NULL OR p.id_paso IS NULL;


-- ===================== 0041_20261107-1200_educacion-medica_hospital-extension-depuracion-esquema.lefarma.sql =====================
-- =============================================================================
-- 0041 — Hospitales: campos de depuración en hospital_extension
--
-- QUÉ HACE
--   - Agrega a educacion_medica.hospital_extension:
--       mostrar_educacion_medica  BIT           (1 = aparece en el catálogo EM)
--       motivo_clasificacion      NVARCHAR(200) (razón de inclusión/exclusión)
--       requiere_revision         BIT           (1 = pendiente de revisión manual)
--       clasificacion_manual      BIT           (1 = protección contra reejecución)
--   - Crea una tabla de respaldo de la tabla actual.
--   - Agrega un índice para consultas por inclusión/sede/gerencia.
--
-- ALCANCE
--   - Solo modifica educacion_medica.hospital_extension.
--   - No toca Asokam.dbo.genContactosCat.
--   - No elimina registros.
--
-- EJECUCIÓN
--   - Revisar antes de ejecutar.
--   - Ejecutar en LefarmaDev2, en orden: 0041 -> 0042 -> 0043.
--   - Idempotente: guards por columna, índice y tabla de respaldo.
-- =============================================================================

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- -------------------------------------------------------------------------
    -- 0. Respaldo previo (solo si no existe)
    -- -------------------------------------------------------------------------
    IF OBJECT_ID('educacion_medica.hospital_extension_backup_20261107', 'U') IS NULL
    BEGIN
        SELECT *
        INTO educacion_medica.hospital_extension_backup_20261107
        FROM educacion_medica.hospital_extension;

        PRINT 'Respaldo creado: educacion_medica.hospital_extension_backup_20261107';
    END
    ELSE
    BEGIN
        PRINT 'Respaldo ya existe. Skip.';
    END

    -- -------------------------------------------------------------------------
    -- 1. mostrar_educacion_medica
    -- -------------------------------------------------------------------------
    IF COL_LENGTH('educacion_medica.hospital_extension', 'mostrar_educacion_medica') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.hospital_extension
        ADD mostrar_educacion_medica BIT NOT NULL
            CONSTRAINT DF_hospital_extension_mostrar_educacion_medica DEFAULT (0);

        PRINT 'Columna [hospital_extension].[mostrar_educacion_medica] agregada.';
    END
    ELSE
    BEGIN
        PRINT 'Columna [hospital_extension].[mostrar_educacion_medica] ya existe. Skip.';
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
          AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'mostrar_educacion_medica', 'ColumnId')
          AND name = 'MS_Description'
    )
    BEGIN
        EXEC sp_addextendedproperty
            @name = N'MS_Description',
            @value = N'1 = el contacto aparece en el catálogo de Educación Médica. 0 = contacto interno, proveedor, almacén no operativo, duplicado o registro de prueba. La fuente sigue siendo Asokam.dbo.genContactosCat; este campo es la clasificación operativa local.',
            @level0type = N'SCHEMA', @level0name = N'educacion_medica',
            @level1type = N'TABLE',  @level1name = N'hospital_extension',
            @level2type = N'COLUMN', @level2name = N'mostrar_educacion_medica';
    END

    -- -------------------------------------------------------------------------
    -- 2. motivo_clasificacion
    -- -------------------------------------------------------------------------
    IF COL_LENGTH('educacion_medica.hospital_extension', 'motivo_clasificacion') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.hospital_extension
        ADD motivo_clasificacion NVARCHAR(200) NULL;

        PRINT 'Columna [hospital_extension].[motivo_clasificacion] agregada.';
    END
    ELSE
    BEGIN
        PRINT 'Columna [hospital_extension].[motivo_clasificacion] ya existe. Skip.';
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
          AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'motivo_clasificacion', 'ColumnId')
          AND name = 'MS_Description'
    )
    BEGIN
        EXEC sp_addextendedproperty
            @name = N'MS_Description',
            @value = N'Motivo legible de la clasificación: unidad de atención, sede logística, duplicado, proveedor, almacén, registro de prueba o revisión manual.',
            @level0type = N'SCHEMA', @level0name = N'educacion_medica',
            @level1type = N'TABLE',  @level1name = N'hospital_extension',
            @level2type = N'COLUMN', @level2name = N'motivo_clasificacion';
    END

    -- -------------------------------------------------------------------------
    -- 3. requiere_revision
    -- -------------------------------------------------------------------------
    IF COL_LENGTH('educacion_medica.hospital_extension', 'requiere_revision') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.hospital_extension
        ADD requiere_revision BIT NOT NULL
            CONSTRAINT DF_hospital_extension_requiere_revision DEFAULT (0);

        PRINT 'Columna [hospital_extension].[requiere_revision] agregada.';
    END
    ELSE
    BEGIN
        PRINT 'Columna [hospital_extension].[requiere_revision] ya existe. Skip.';
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
          AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'requiere_revision', 'ColumnId')
          AND name = 'MS_Description'
    )
    BEGIN
        EXEC sp_addextendedproperty
            @name = N'MS_Description',
            @value = N'1 = el registro requiere revisión manual (duplicado dudoso, mapeo de región en CDMX, jerarquía incompleta o nombre sospechoso).',
            @level0type = N'SCHEMA', @level0name = N'educacion_medica',
            @level1type = N'TABLE',  @level1name = N'hospital_extension',
            @level2type = N'COLUMN', @level2name = N'requiere_revision';
    END

    -- -------------------------------------------------------------------------
    -- 4. clasificacion_manual
    -- -------------------------------------------------------------------------
    IF COL_LENGTH('educacion_medica.hospital_extension', 'clasificacion_manual') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.hospital_extension
        ADD clasificacion_manual BIT NOT NULL
            CONSTRAINT DF_hospital_extension_clasificacion_manual DEFAULT (0);

        PRINT 'Columna [hospital_extension].[clasificacion_manual] agregada.';
    END
    ELSE
    BEGIN
        PRINT 'Columna [hospital_extension].[clasificacion_manual] ya existe. Skip.';
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
          AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'clasificacion_manual', 'ColumnId')
          AND name = 'MS_Description'
    )
    BEGIN
        EXEC sp_addextendedproperty
            @name = N'MS_Description',
            @value = N'1 = la clasificación fue ajustada manualmente; los scripts de depuración no deben sobrescribirla.',
            @level0type = N'SCHEMA', @level0name = N'educacion_medica',
            @level1type = N'TABLE',  @level1name = N'hospital_extension',
            @level2type = N'COLUMN', @level2name = N'clasificacion_manual';
    END

    -- -------------------------------------------------------------------------
    -- 5. Índice de consulta
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('educacion_medica.hospital_extension')
          AND name = 'IX_hospital_extension_mostrar_sede_gerencia'
    )
    BEGIN
        CREATE INDEX IX_hospital_extension_mostrar_sede_gerencia
        ON educacion_medica.hospital_extension (mostrar_educacion_medica, es_sede_taller, id_tipo_gerencia);

        PRINT 'Índice [IX_hospital_extension_mostrar_sede_gerencia] creado.';
    END
    ELSE
    BEGIN
        PRINT 'Índice [IX_hospital_extension_mostrar_sede_gerencia] ya existe. Skip.';
    END

    COMMIT TRANSACTION;
    PRINT '0041 completado: campos de depuración agregados a hospital_extension.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    PRINT 'ERROR en 0041: ' + ERROR_MESSAGE();
    THROW;
END CATCH;


-- ===================== 0042_20261107-1230_educacion-medica_hospital-extension-depuracion-datos.lefarma.sql =====================
-- =============================================================================
-- 0042 — Hospitales: depuración de datos en hospital_extension
--
-- QUÉ HACE
--   1. Asigna IMSS Bienestar (id_tipo_gerencia = 4) a 385 y sus hijos.
--   2. Remapea su región con el catálogo de regiones de IMSS Bienestar.
--   3. Clasifica mostrar_educacion_medica / es_sede_taller / motivo_clasificacion:
--        - Unidades de atención -> mostrar = 1.
--        - Sub-almacenes/farmacias -> mostrar = 1 (no se excluyen).
--        - Personas, proveedores, transportistas, almacenes/CEDIS, pruebas,
--          duplicados claros -> mostrar = 0 y es_sede_taller = 0.
--   4. Marca requiere_revision para duplicados dudosos, CDMX sin región y
--      jerarquías incompletas.
--
-- ALCANCE
--   - Solo modifica educacion_medica.hospital_extension.
--   - No toca Asokam.dbo.genContactosCat.
--   - No elimina registros.
--
-- EJECUCIÓN
--   - Requiere 0041 aplicado.
--   - Ejecutar una vez; reejecutar solo si se desea recalcular.
--   - Las filas con clasificacion_manual = 1 no se sobrescriben.
-- =============================================================================

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- -------------------------------------------------------------------------
    -- 0. Clasificación base en tabla temporal
    -- -------------------------------------------------------------------------
    IF OBJECT_ID('tempdb..#clasif_contactos') IS NOT NULL
        DROP TABLE #clasif_contactos;

    CREATE TABLE #clasif_contactos
    (
        id_hospital INT NOT NULL PRIMARY KEY,
        codigoContactoPrincipal INT NULL,
        nombreContacto VARCHAR(100) NULL,
        tipo VARCHAR(20) NULL,
        padre_nombre VARCHAR(100) NULL,
        padre_tipo VARCHAR(20) NULL,
        es_logistico BIT NOT NULL,
        es_subalmacen_farmacia BIT NOT NULL
    );

    INSERT INTO #clasif_contactos
    (
        id_hospital,
        codigoContactoPrincipal,
        nombreContacto,
        tipo,
        padre_nombre,
        padre_tipo,
        es_logistico,
        es_subalmacen_farmacia
    )
    SELECT
        he.id_hospital,
        g.codigoContactoPrincipal,
        g.nombreContacto,
        g.tipo,
        p.nombreContacto AS padre_nombre,
        p.tipo AS padre_tipo,
        CASE
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ENTREGA%'
                THEN 1
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE 'ASOKAM%'
                THEN 1
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUB-ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUB ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUBDELEGACIONAL%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%FARMACIA%'
                THEN 0
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%CEDIS%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%BIRMEX%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%DISTRIBUIDORA%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%COMERCIALIZADORA%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%INSUMOS%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%PHARMA%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%TRANSPORT%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%TRASPORT%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%OFICINA%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ADMINISTRATIV%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%PRUEBA%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%FALSE%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%COPIA%'
                THEN 1
            WHEN p.tipo IN ('Privado', 'Distribuidor')
                THEN 1
            WHEN UPPER(ISNULL(p.nombreContacto, '')) LIKE '%DISTRIBUIDORA%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%COMERCIALIZADORA%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%INSUMOS%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%PHARMA%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%TRANSPORT%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%TRASPORT%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%PROVEEDOR%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%COMERCIAL%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%CORPORATIVO%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%COMERLAT%'
                THEN 1
            ELSE 0
        END AS es_logistico,
        CASE
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ENTREGA%'
                THEN 0
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUB-ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUB ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUBDELEGACIONAL%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%FARMACIA%'
                THEN 1
            ELSE 0
        END AS es_subalmacen_farmacia
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g
        ON g.codigoContacto = he.id_hospital
    LEFT JOIN Asokam.dbo.genContactosCat p
        ON p.codigoContacto = g.codigoContactoPrincipal;

    -- -------------------------------------------------------------------------
    -- 1. IMSS Bienestar: gerencia y región
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.id_tipo_gerencia = 4,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 385
       OR c.id_hospital = 385;

    PRINT CONCAT('IMSS Bienestar - gerencia asignada: ', @@ROWCOUNT, ' fila(s).');

    UPDATE he
    SET he.id_region = ze.id_region,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    JOIN Asokam.dbo.genContactosCat g
        ON g.codigoContacto = he.id_hospital
    JOIN educacion_medica.regiones_estados ze
        ON ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
       AND ze.id_tipo_gerencia = 4
    WHERE (g.codigoContacto = 385 OR g.codigoContactoPrincipal = 385)
      AND (he.id_region IS NULL OR he.id_region <> ze.id_region);

    PRINT CONCAT('IMSS Bienestar - región remapeada: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 2. Contactos con codigoContactoPrincipal = 0
    --    Regla general: no son unidades de atención.
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Sin unidad de atención: persona/proveedor/interno',
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 0
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('Principal=0 - no hospitalarios: ', @@ROWCOUNT, ' fila(s).');

    -- Excepciones: hospitales independientes / raíces de hospital.
    -- Se revisan aparte por posibles duplicados contra sus hijos.
    DECLARE @hospitales_independientes TABLE (id_hospital INT PRIMARY KEY);

    INSERT INTO @hospitales_independientes (id_hospital)
    VALUES
        (346), (349), (351), (352), (353), (354), (358), (359), (360),
        (365), (366), (367), (368),
        (13284), (13285), (13286), (13328), (13333);

    UPDATE he
    SET he.mostrar_educacion_medica = 1,
        he.es_sede_taller = 1,
        he.motivo_clasificacion = N'Unidad de atención (revisar duplicado/institución)',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN @hospitales_independientes hi
        ON hi.id_hospital = he.id_hospital
    WHERE he.clasificacion_manual = 0;

    PRINT CONCAT('Principal=0 - hospitales independientes: ', @@ROWCOUNT, ' fila(s).');

    -- Casos especiales con nombre hospitalario que no son unidad de atención.
    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Proveedor: no es unidad de atención',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.id_hospital = 357
      AND he.clasificacion_manual = 0;

    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Revisión manual: nombre incompleto',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.id_hospital = 13376
      AND he.clasificacion_manual = 0;

    -- -------------------------------------------------------------------------
    -- 3. Hijos de 385: IMSS Bienestar
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Logístico: almacén/CEDIS/BIRMEX/distribuidora',
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 385
      AND c.es_logistico = 1
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('385 - logísticos excluidos: ', @@ROWCOUNT, ' fila(s).');

    UPDATE he
    SET he.mostrar_educacion_medica = 1,
        he.es_sede_taller = 1,
        he.motivo_clasificacion = N'Unidad de atención IMSS Bienestar',
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 385
      AND c.es_logistico = 0
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('385 - unidades de atención: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 4. Hijos de 364: IMSS
    --    Se conservan sub-almacenes/farmacias como parte del catálogo.
    --    Los almacenes delegacionales/BIRMEX sí se excluyen (no son atención).
    --    No se modifica es_sede_taller de sub-almacenes/farmacias: la regla
    --    actual decide cuál es sede.
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica =
            CASE
                WHEN c.es_logistico = 1 AND c.es_subalmacen_farmacia = 0 THEN 0
                ELSE 1
            END,
        he.es_sede_taller =
            CASE
                WHEN c.es_logistico = 1 AND c.es_subalmacen_farmacia = 0 THEN 0
                ELSE he.es_sede_taller
            END,
        he.motivo_clasificacion =
            CASE
                WHEN c.es_subalmacen_farmacia = 1
                    THEN N'Sede logística (sub-almacén/farmacia)'
                WHEN c.es_logistico = 1
                    THEN N'Logístico: almacén delegacional/BIRMEX'
                ELSE N'Unidad de atención IMSS'
            END,
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 364
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('364 - unidades/sedes conservadas: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 5. Hijos de 370: ISSSTE bajo Descentralizado
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica = 1,
        he.motivo_clasificacion = N'Unidad de atención ISSSTE (Descentralizado)',
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 370
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('370 - unidades ISSSTE: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 6. Otros padres: proveedores/entregas fuera; hospitales dentro
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Logístico/proveedor: entrega/transporte/distribuidor',
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal NOT IN (0, 364, 370, 385)
      AND c.es_logistico = 1
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('Otros padres - logísticos/proveedores excluidos: ', @@ROWCOUNT, ' fila(s).');

    UPDATE he
    SET he.mostrar_educacion_medica = 1,
        he.motivo_clasificacion = N'Unidad de atención (revisar jerarquía)',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal NOT IN (0, 364, 370, 385)
      AND c.es_logistico = 0
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('Otros padres - unidades conservadas: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 7. Duplicados claros
    --    No se elimina nada; se oculta el registro no canónico.
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Duplicado: se conserva 13352',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.id_hospital IN (353, 693)
      AND he.clasificacion_manual = 0;

    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Duplicado: se conserva 694',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.id_hospital = 354
      AND he.clasificacion_manual = 0;

    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Duplicado: se conserva 700',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.id_hospital = 360
      AND he.clasificacion_manual = 0;

    PRINT 'Duplicados claros ocultados: 353, 693, 354, 360.';

    -- -------------------------------------------------------------------------
    -- 8. Revisiones manuales
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.clasificacion_manual = 0
      AND he.id_hospital IN (
          346,                          -- Centro Regional de Alta Especialidad de Chiapas
          349, 351, 352, 358,           -- Hospitales independientes
          365, 366, 367, 368,           -- Institutos nacionales
          359, 699, 13285,              -- IXTAPALUCA (3 registros)
          13284, 13286,                 -- Regionales nuevos
          13328, 13333,                 -- Hospitales independientes
          13340,                        -- Posible duplicado de 694
          772, 773,                     -- UMAE Trauma y Ortopedia (posible duplicado)
          774, 13338,                   -- Sub-almacén duplicado
          798, 799, 13325, 13352        -- Hijos de 383 / canónicos
      );

    PRINT CONCAT('Registros marcados para revisión manual: ', @@ROWCOUNT, ' fila(s).');

    -- CDMX: unidades visibles sin región (no hay mapeo estado->región para 493).
    -- Incluye hospitales IMSS Bienestar y sub-almacenes/farmacias IMSS.
    UPDATE he
    SET he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.clasificacion_manual = 0
      AND he.mostrar_educacion_medica = 1
      AND he.id_region IS NULL;

    PRINT CONCAT('Unidades visibles sin región (revisión): ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 9. Resumen
    -- -------------------------------------------------------------------------
    SELECT
        mostrar_educacion_medica,
        es_sede_taller,
        requiere_revision,
        COUNT(*) AS total
    FROM educacion_medica.hospital_extension
    GROUP BY mostrar_educacion_medica, es_sede_taller, requiere_revision
    ORDER BY mostrar_educacion_medica DESC, es_sede_taller DESC, requiere_revision DESC;

    SELECT
        id_tipo_gerencia,
        COUNT(*) AS total,
        SUM(CASE WHEN mostrar_educacion_medica = 1 THEN 1 ELSE 0 END) AS visibles
    FROM educacion_medica.hospital_extension
    GROUP BY id_tipo_gerencia
    ORDER BY id_tipo_gerencia;

    COMMIT TRANSACTION;
    PRINT '0042 completado: depuración aplicada a hospital_extension.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    PRINT 'ERROR en 0042: ' + ERROR_MESSAGE();
    THROW;
END CATCH;



-- ===================== 0043_20261107-1300_educacion-medica_hospital-extension-depuracion-verificacion.lefarma.sql =====================
-- =============================================================================
-- 0043 — Hospitales: verificación y listas de revisión (solo lectura)
--
-- QUÉ HACE
--   - Ejecuta conteos y listas para validar la depuración de hospital_extension.
--   - No modifica datos.
--
-- EJECUCIÓN
--   - Requiere 0041 y 0042 aplicados.
--   - Ejecutar en LefarmaDev2.
--   - Revisar especialmente:
--       * Hospitales IMSS Bienestar de CDMX sin región (mapeo manual).
--       * Duplicados dudosos y registros con requiere_revision = 1.
--       * Registros visibles que aún parezcan no hospitalarios.
-- =============================================================================

SET NOCOUNT ON;

-- -----------------------------------------------------------------------------
-- 1. Resumen general
-- -----------------------------------------------------------------------------
SELECT
    'Resumen general' AS bloque,
    COUNT(*) AS total_extensiones,
    SUM(CASE WHEN mostrar_educacion_medica = 1 THEN 1 ELSE 0 END) AS visibles_edm,
    SUM(CASE WHEN mostrar_educacion_medica = 0 THEN 1 ELSE 0 END) AS ocultos_edm,
    SUM(CASE WHEN es_sede_taller = 1 THEN 1 ELSE 0 END) AS sedes_taller,
    SUM(CASE WHEN es_sede_taller = 0 THEN 1 ELSE 0 END) AS no_sedes,
    SUM(CASE WHEN requiere_revision = 1 THEN 1 ELSE 0 END) AS requieren_revision,
    SUM(CASE WHEN clasificacion_manual = 1 THEN 1 ELSE 0 END) AS clasificacion_manual
FROM educacion_medica.hospital_extension;

-- -----------------------------------------------------------------------------
-- 2. Distribución por gerencia
-- -----------------------------------------------------------------------------
SELECT
    tg.id_tipo_gerencia,
    tg.descripcion AS gerencia,
    COUNT(he.id_hospital_extension) AS total,
    SUM(CASE WHEN he.mostrar_educacion_medica = 1 THEN 1 ELSE 0 END) AS visibles,
    SUM(CASE WHEN he.es_sede_taller = 1 THEN 1 ELSE 0 END) AS sedes
FROM educacion_medica.tipo_gerencia tg
LEFT JOIN educacion_medica.hospital_extension he
    ON he.id_tipo_gerencia = tg.id_tipo_gerencia
GROUP BY tg.id_tipo_gerencia, tg.descripcion
ORDER BY tg.id_tipo_gerencia;

-- -----------------------------------------------------------------------------
-- 3. IMSS Bienestar: hijos de 385
-- -----------------------------------------------------------------------------
SELECT
    'IMSS Bienestar - hijos de 385' AS bloque,
    he.id_tipo_gerencia,
    COUNT(*) AS total,
    SUM(CASE WHEN he.id_region IS NULL THEN 1 ELSE 0 END) AS sin_region,
    SUM(CASE WHEN he.mostrar_educacion_medica = 1 THEN 1 ELSE 0 END) AS visibles
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE g.codigoContactoPrincipal = 385
GROUP BY he.id_tipo_gerencia;

-- Debe dar 0 filas con gerencia distinta de 4.
SELECT
    he.id_hospital,
    g.nombreContacto,
    he.id_tipo_gerencia,
    he.id_region
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE g.codigoContactoPrincipal = 385
  AND he.id_tipo_gerencia <> 4;

-- -----------------------------------------------------------------------------
-- 4. CDMX IMSS Bienestar sin región (para mapeo manual del usuario)
--    Se listan solo unidades visibles, no logísticas.
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    g.nombreCorto,
    g.ciudad,
    g.codigoEstado,
    g.calle,
    g.cp,
    he.es_sede_taller,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE he.id_tipo_gerencia = 4
  AND he.id_region IS NULL
  AND he.mostrar_educacion_medica = 1
ORDER BY g.nombreContacto;

-- -----------------------------------------------------------------------------
-- 4B. Todas las unidades visibles sin región (para mapeo manual)
-- -----------------------------------------------------------------------------
SELECT
    tg.descripcion AS gerencia,
    he.id_hospital,
    g.nombreContacto,
    g.ciudad,
    g.codigoEstado,
    he.es_sede_taller,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
LEFT JOIN educacion_medica.tipo_gerencia tg
    ON tg.id_tipo_gerencia = he.id_tipo_gerencia
WHERE he.mostrar_educacion_medica = 1
  AND he.id_region IS NULL
ORDER BY tg.descripcion, g.nombreContacto;

-- -----------------------------------------------------------------------------
-- 5. Duplicados exactos de nombre entre registros visibles
-- -----------------------------------------------------------------------------
WITH visibles AS (
    SELECT
        he.id_hospital,
        he.mostrar_educacion_medica,
        he.es_sede_taller,
        he.motivo_clasificacion,
        g.nombreContacto,
        g.codigoContactoPrincipal,
        g.clues,
        g.ciudad,
        g.codigoEstado,
        UPPER(LTRIM(RTRIM(g.nombreContacto))) COLLATE Latin1_General_CI_AI AS nombre_norm
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g
        ON g.codigoContacto = he.id_hospital
    WHERE he.mostrar_educacion_medica = 1
),
dup AS (
    SELECT nombre_norm
    FROM visibles
    GROUP BY nombre_norm
    HAVING COUNT(*) > 1
)
SELECT
    v.*
FROM visibles v
JOIN dup d
    ON d.nombre_norm = v.nombre_norm
ORDER BY v.nombre_norm, v.id_hospital;

-- -----------------------------------------------------------------------------
-- 6. Registros visibles que aún parecen logísticos/no hospitalarios
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    g.codigoContactoPrincipal,
    p.nombreContacto AS padre,
    p.tipo AS padre_tipo,
    he.es_sede_taller,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
LEFT JOIN Asokam.dbo.genContactosCat p
    ON p.codigoContacto = g.codigoContactoPrincipal
WHERE he.mostrar_educacion_medica = 1
  AND (
      (UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ALMAC%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ALMAC%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%CEDIS%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%BIRMEX%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%DISTRIBUIDORA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%COMERCIALIZADORA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%INSUMOS%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%PHARMA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%TRANSPORT%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%TRASPORT%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ENTREGA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE 'ASOKAM%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%OFICINA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ADMINISTRATIV%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%PRUEBA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%FALSE%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%COPIA%'
       OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%CORPORATIVO%'
       OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%COMERLAT%')
      AND UPPER(ISNULL(g.nombreContacto, '')) NOT LIKE '%ENTREGA%'
      AND UPPER(ISNULL(g.nombreContacto, '')) NOT LIKE '%SUB-ALMAC%'
      AND UPPER(ISNULL(g.nombreContacto, '')) NOT LIKE '%SUB ALMAC%'
      AND UPPER(ISNULL(g.nombreContacto, '')) NOT LIKE '%SUBDELEGACIONAL%'
      AND UPPER(ISNULL(g.nombreContacto, '')) NOT LIKE '%FARMACIA%'
  )
ORDER BY g.nombreContacto;

-- -----------------------------------------------------------------------------
-- 7. Registros con requiere_revision = 1
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    g.codigoContactoPrincipal,
    he.id_tipo_gerencia,
    he.id_region,
    he.mostrar_educacion_medica,
    he.es_sede_taller,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE he.requiere_revision = 1
ORDER BY he.id_tipo_gerencia, g.nombreContacto;

-- -----------------------------------------------------------------------------
-- 8. Visibles que no son sede (sub-almacenes/farmacias conservados)
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    he.id_region,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE he.mostrar_educacion_medica = 1
  AND he.es_sede_taller = 0
ORDER BY g.nombreContacto;

-- -----------------------------------------------------------------------------
-- 9. Ocultos que siguen como sede (debe devolver 0 filas)
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE he.mostrar_educacion_medica = 0
  AND he.es_sede_taller = 1;

-- -----------------------------------------------------------------------------
-- 10. Región de otra gerencia (debe devolver 0 filas)
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    he.id_tipo_gerencia,
    he.id_region,
    r.id_tipo_gerencia AS region_gerencia
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
JOIN educacion_medica.regiones_cat r
    ON r.id_region = he.id_region
WHERE he.id_tipo_gerencia <> r.id_tipo_gerencia;

-- -----------------------------------------------------------------------------
-- 11. Completitud operativa
-- -----------------------------------------------------------------------------
SELECT
    'Quirófanos/SIA/fecha' AS bloque,
    SUM(CASE WHEN numero_quirofanos IS NULL THEN 1 ELSE 0 END) AS quirofanos_null,
    SUM(CASE WHEN con_sia IS NULL THEN 1 ELSE 0 END) AS con_sia_null,
    SUM(CASE WHEN fecha IS NULL THEN 1 ELSE 0 END) AS fecha_null,
    COUNT(*) AS total
FROM educacion_medica.hospital_extension;

-- -----------------------------------------------------------------------------
-- 12. Sedes por gerencia y región
-- -----------------------------------------------------------------------------
SELECT
    tg.descripcion AS gerencia,
    ISNULL(rc.nombre, '(sin región)') AS region,
    COUNT(*) AS sedes
FROM educacion_medica.hospital_extension he
LEFT JOIN educacion_medica.tipo_gerencia tg
    ON tg.id_tipo_gerencia = he.id_tipo_gerencia
LEFT JOIN educacion_medica.regiones_cat rc
    ON rc.id_region = he.id_region
WHERE he.mostrar_educacion_medica = 1
  AND he.es_sede_taller = 1
GROUP BY tg.descripcion, rc.nombre
ORDER BY tg.descripcion, rc.nombre;

-- -----------------------------------------------------------------------------
-- 13. Contactos activos incluibles que siguen sin extensión
-- -----------------------------------------------------------------------------
SELECT
    g.codigoContacto,
    g.nombreContacto,
    g.tipo,
    g.clues,
    g.codigoContactoPrincipal
FROM Asokam.dbo.genContactosCat g
LEFT JOIN educacion_medica.hospital_extension he
    ON he.id_hospital = g.codigoContacto
WHERE g.activo = 1
  AND (g.tipo IS NULL OR g.tipo NOT IN ('Privado', 'Distribuidor'))
  AND he.id_hospital IS NULL
ORDER BY g.nombreContacto;


