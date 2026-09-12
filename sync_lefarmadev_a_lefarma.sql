/* ============================================================================
   SCRIPT: sync_lefarmadev_a_lefarma.sql
   PROPOSITO: Sincronizar LEFARMADEV -> LEFARMA (solo "de mas", nada se borra)
   - Crea las 11 tablas del modulo educacion_medica que existen en Dev y no en Prod
   - Agrega 5 columnas que Dev tiene y Prod no
   - Inserta en Prod los registros que existen en Dev y no en Prod (~23 tablas),
     conservando los IDs de Dev (IDENTITY_INSERT) para preservar integridad FK
   EXCLUIDOS (acordado): ordenes de compra, logs.audit/error, app.SchemaVersions,
   archivos.Archivos, operaciones.comprobantes(+partidas), dbo.pruebaeliminar
   Todo corre en UNA transaccion (XACT_ABORT ON): si algo falla, se revierte.
   Los GO separan lotes: SQL Server enlaza cada lote por separado, asi las
   columnas nuevas (ALTER) son visibles para los INSERT posteriores.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO

    /* ==========================================================================
       SECCION 1 — CREATE TABLE (tablas que existen SOLO en LefarmaDev)
       ========================================================================== */

    IF @@TRANCOUNT = 0 THROW 50000, 'Transaccion abortada; el script se detiene.', 1;

    /* 1.1 config_ranking */
    IF OBJECT_ID('Lefarma.educacion_medica.config_ranking', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.config_ranking (
            id_configuracion        INT           IDENTITY(1,1) NOT NULL,
            nombre                  NVARCHAR(100) NOT NULL,
            version                 INT           NOT NULL,
            activo                  BIT           NOT NULL CONSTRAINT DF_config_ranking_activo DEFAULT ((0)),
            fecha_vigencia_inicio   DATE          NULL,
            fecha_vigencia_fin      DATE          NULL,
            fecha_creacion          DATETIME2(7)  NOT NULL CONSTRAINT DF_config_ranking_fecha_creacion DEFAULT (SYSUTCDATETIME()),
            fecha_modificacion      DATETIME2(7)  NOT NULL CONSTRAINT DF_config_ranking_fecha_modificacion DEFAULT (SYSUTCDATETIME()),
            id_usuario_creacion     INT           NULL,
            id_usuario_modificacion INT           NULL,
            CONSTRAINT PK_config_ranking PRIMARY KEY (id_configuracion),
            CONSTRAINT UQ_config_ranking_nombre_version UNIQUE (nombre, version)
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.indexes WHERE name = 'UX_config_ranking_activa' AND object_id = OBJECT_ID('Lefarma.educacion_medica.config_ranking'))
        CREATE UNIQUE INDEX UX_config_ranking_activa ON Lefarma.educacion_medica.config_ranking (activo) WHERE activo = 1;

    /* 1.2 config_ranking_factores */
    IF OBJECT_ID('Lefarma.educacion_medica.config_ranking_factores', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.config_ranking_factores (
            id_factor           INT            IDENTITY(1,1) NOT NULL,
            id_configuracion    INT            NOT NULL,
            clave               VARCHAR(50)    NOT NULL,
            grupo               VARCHAR(30)    NULL,
            peso                DECIMAL(5,2)   NOT NULL,
            activo              BIT            NOT NULL CONSTRAINT DF_config_ranking_factores_activo DEFAULT ((1)),
            tipo_normalizacion  VARCHAR(30)    NULL,
            parametros_json     NVARCHAR(MAX)  NULL,
            CONSTRAINT PK_config_ranking_factores PRIMARY KEY (id_factor),
            CONSTRAINT UQ_config_ranking_factores_config_clave UNIQUE (id_configuracion, clave)
        );
    END;

    /* 1.3 equipos_pareo */
    IF OBJECT_ID('Lefarma.educacion_medica.equipos_pareo', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.equipos_pareo (
            id_equipo               INT           IDENTITY(1,1) NOT NULL,
            id_ejecutivo            INT           NOT NULL,
            id_especialista         INT           NOT NULL,
            fecha_inicio            DATE          NOT NULL CONSTRAINT DF_equipos_pareo_fecha_inicio DEFAULT (CONVERT([date],GETDATE())),
            fecha_fin               DATE          NULL,
            activo                  BIT           NOT NULL CONSTRAINT DF_equipos_pareo_activo DEFAULT ((1)),
            fecha_creacion          DATETIME2(7)  NOT NULL CONSTRAINT DF_equipos_pareo_fecha_creacion DEFAULT (SYSUTCDATETIME()),
            fecha_modificacion      DATETIME2(7)  NOT NULL CONSTRAINT DF_equipos_pareo_fecha_modificacion DEFAULT (SYSUTCDATETIME()),
            id_usuario_creacion     INT           NULL,
            id_usuario_modificacion INT           NULL,
            CONSTRAINT PK_equipos_pareo PRIMARY KEY (id_equipo)
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.indexes WHERE name = 'UX_equipos_pareo_ejecutivo_activo' AND object_id = OBJECT_ID('Lefarma.educacion_medica.equipos_pareo'))
        CREATE UNIQUE INDEX UX_equipos_pareo_ejecutivo_activo ON Lefarma.educacion_medica.equipos_pareo (id_ejecutivo) WHERE activo = 1;

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.indexes WHERE name = 'UX_equipos_pareo_especialista_activo' AND object_id = OBJECT_ID('Lefarma.educacion_medica.equipos_pareo'))
        CREATE UNIQUE INDEX UX_equipos_pareo_especialista_activo ON Lefarma.educacion_medica.equipos_pareo (id_especialista) WHERE activo = 1;

    /* 1.4 parametros_modulo (PK NO identity: clave) */
    IF OBJECT_ID('Lefarma.educacion_medica.parametros_modulo', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.parametros_modulo (
            clave                   VARCHAR(50)   NOT NULL,
            valor                   DECIMAL(10,2) NOT NULL,
            descripcion             NVARCHAR(200) NULL,
            activo                  BIT           NOT NULL CONSTRAINT DF_parametros_modulo_activo DEFAULT ((1)),
            fecha_creacion          DATETIME2(7)  NOT NULL CONSTRAINT DF_parametros_modulo_fecha_creacion DEFAULT (SYSUTCDATETIME()),
            fecha_modificacion      DATETIME2(7)  NOT NULL CONSTRAINT DF_parametros_modulo_fecha_modificacion DEFAULT (SYSUTCDATETIME()),
            id_usuario_creacion     INT           NULL,
            id_usuario_modificacion INT           NULL,
            CONSTRAINT PK_parametros_modulo PRIMARY KEY (clave)
        );
    END;

    /* 1.5 selecciones_mensuales */
    IF OBJECT_ID('Lefarma.educacion_medica.selecciones_mensuales', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.selecciones_mensuales (
            id_seleccion_mensual    INT           IDENTITY(1,1) NOT NULL,
            fecha_seleccion         DATE          NOT NULL,
            id_tipo_gerencia        INT           NULL,
            fecha_inicio_vigencia   DATE          NULL,
            fecha_fin_vigencia      DATE          NULL,
            talleres_objetivo_mes   INT           NULL,
            activo                  BIT           NOT NULL CONSTRAINT DF_selecciones_mensuales_activo DEFAULT ((1)),
            fecha_creacion          DATETIME2(7)  NOT NULL CONSTRAINT DF_selecciones_mensuales_fecha_creacion DEFAULT (SYSUTCDATETIME()),
            fecha_modificacion      DATETIME2(7)  NOT NULL CONSTRAINT DF_selecciones_mensuales_fecha_modificacion DEFAULT (SYSUTCDATETIME()),
            id_usuario_creacion     INT           NULL,
            id_usuario_modificacion INT           NULL,
            firma_gv_fecha          DATETIME2(7)  NULL,
            firma_gg_fecha          DATETIME2(7)  NULL,
            estado                  VARCHAR(15)   NOT NULL CONSTRAINT DF_selecciones_mensuales_estado DEFAULT ('Borrador'),
            CONSTRAINT PK_selecciones_mensuales PRIMARY KEY (id_seleccion_mensual)
        );
    END;

    /* 1.6 selecciones_zonas */
    IF OBJECT_ID('Lefarma.educacion_medica.selecciones_zonas', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.selecciones_zonas (
            id_zona                 INT           IDENTITY(1,1) NOT NULL,
            id_seleccion_mensual    INT           NOT NULL,
            nombre                  NVARCHAR(80)  NULL,
            centro_latitud          DECIMAL(10,7) NULL,
            centro_longitud         DECIMAL(10,7) NULL,
            cantidad_hospitales     INT           NOT NULL,
            algoritmo               VARCHAR(50)   NULL,
            fecha_calculo           DATETIME2(7)  NOT NULL CONSTRAINT DF_selecciones_zonas_fecha_calculo DEFAULT (SYSUTCDATETIME()),
            id_equipo               INT           NULL,
            fecha_creacion          DATETIME2(7)  NOT NULL CONSTRAINT DF_selecciones_zonas_fecha_creacion DEFAULT (SYSUTCDATETIME()),
            fecha_modificacion      DATETIME2(7)  NOT NULL CONSTRAINT DF_selecciones_zonas_fecha_modificacion DEFAULT (SYSUTCDATETIME()),
            id_usuario_creacion     INT           NULL,
            id_usuario_modificacion INT           NULL,
            CONSTRAINT PK_selecciones_zonas PRIMARY KEY (id_zona)
        );
    END;

    /* 1.7 ranking_ejecuciones */
    IF OBJECT_ID('Lefarma.educacion_medica.ranking_ejecuciones', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.ranking_ejecuciones (
            id_ranking_ejecucion    INT           IDENTITY(1,1) NOT NULL,
            id_seleccion_mensual    INT           NOT NULL,
            id_configuracion        INT           NOT NULL,
            version_algoritmo       VARCHAR(20)   NOT NULL,
            cantidad_solicitada     INT           NOT NULL,
            cantidad_candidatos     INT           NOT NULL,
            pesos_efectivos_json    NVARCHAR(MAX) NOT NULL,
            filtros_json            NVARCHAR(MAX) NULL,
            fecha_ejecucion         DATETIME2(7)  NOT NULL CONSTRAINT DF_ranking_ejecuciones_fecha_ejecucion DEFAULT (SYSUTCDATETIME()),
            id_usuario_ejecucion    INT           NULL,
            CONSTRAINT PK_ranking_ejecuciones PRIMARY KEY (id_ranking_ejecucion)
        );
    END;

    /* 1.8 selecciones_mensuales_hospitales */
    IF OBJECT_ID('Lefarma.educacion_medica.selecciones_mensuales_hospitales', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.selecciones_mensuales_hospitales (
            id_seleccion_hospital   INT           IDENTITY(1,1) NOT NULL,
            id_seleccion_mensual    INT           NOT NULL,
            id_hospital             INT           NULL,
            region                  VARCHAR(60)   NULL,
            entidad_federativa      VARCHAR(60)   NULL,
            ciudad_municipio        NVARCHAR(120) NULL,
            id_ejecutivo            INT           NULL,
            producto_a_promocionar  NVARCHAR(150) NULL,
            observaciones           NVARCHAR(300) NULL,
            fecha_creacion          DATETIME2(7)  NOT NULL CONSTRAINT DF_selecciones_mensuales_hospitales_fecha_creacion DEFAULT (SYSUTCDATETIME()),
            fecha_modificacion      DATETIME2(7)  NOT NULL CONSTRAINT DF_selecciones_mensuales_hospitales_fecha_modificacion DEFAULT (SYSUTCDATETIME()),
            id_usuario_creacion     INT           NULL,
            id_usuario_modificacion INT           NULL,
            latitud_snapshot        DECIMAL(10,7) NULL,
            longitud_snapshot       DECIMAL(10,7) NULL,
            id_zona                 INT           NULL,
            id_ranking_ejecucion    INT           NULL,
            score_sugerencia        DECIMAL(5,2)  NULL,
            CONSTRAINT PK_selecciones_mensuales_hospitales PRIMARY KEY (id_seleccion_hospital),
            CONSTRAINT UQ_seleccion_hospital_unica UNIQUE (id_seleccion_mensual, id_hospital)
        );
    END;

    /* 1.9 ranking_ejecucion_hospitales */
    IF OBJECT_ID('Lefarma.educacion_medica.ranking_ejecucion_hospitales', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.ranking_ejecucion_hospitales (
            id_ejecucion_hospital   INT           IDENTITY(1,1) NOT NULL,
            id_ranking_ejecucion    INT           NOT NULL,
            id_hospital             INT           NOT NULL,
            posicion                INT           NOT NULL,
            score_total             DECIMAL(5,2)  NOT NULL,
            porcentaje_completitud  DECIMAL(5,2)  NOT NULL,
            es_top_sugerido         BIT           NOT NULL,
            decision                VARCHAR(25)   NOT NULL CONSTRAINT DF_ranking_ejecucion_hospitales_decision DEFAULT ('SinDecision'),
            factores_json           NVARCHAR(MAX) NOT NULL,
            CONSTRAINT PK_ranking_ejecucion_hospitales PRIMARY KEY (id_ejecucion_hospital),
            CONSTRAINT UQ_ejecucion_hospital_unica UNIQUE (id_ranking_ejecucion, id_hospital)
        );
    END;

    /* 1.10 rutas */
    IF OBJECT_ID('Lefarma.educacion_medica.rutas', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.rutas (
            id_ruta                 INT           IDENTITY(1,1) NOT NULL,
            id_seleccion_mensual    INT           NOT NULL,
            id_equipo               INT           NOT NULL,
            version                 INT           NOT NULL,
            nombre                  NVARCHAR(80)  NULL,
            estado                  VARCHAR(15)   NOT NULL CONSTRAINT DF_rutas_estado DEFAULT ('Draft'),
            fecha_confirmacion      DATETIME2(7)  NULL,
            fecha_creacion          DATETIME2(7)  NOT NULL CONSTRAINT DF_rutas_fecha_creacion DEFAULT (SYSUTCDATETIME()),
            fecha_modificacion      DATETIME2(7)  NOT NULL CONSTRAINT DF_rutas_fecha_modificacion DEFAULT (SYSUTCDATETIME()),
            id_usuario_creacion     INT           NULL,
            id_usuario_modificacion INT           NULL,
            CONSTRAINT PK_rutas PRIMARY KEY (id_ruta)
        );
    END;

    /* 1.11 rutas_visitas */
    IF OBJECT_ID('Lefarma.educacion_medica.rutas_visitas', 'U') IS NULL
    BEGIN
        CREATE TABLE Lefarma.educacion_medica.rutas_visitas (
            id_ruta_visita          INT           IDENTITY(1,1) NOT NULL,
            id_ruta                 INT           NOT NULL,
            id_seleccion_hospital   INT           NOT NULL,
            id_hospital             INT           NULL,
            fecha_visita            DATE          NOT NULL,
            orden                   TINYINT       NOT NULL,
            hora_salida             TIME(7)       NULL,
            hora_llegada            TIME(7)       NULL,
            fecha_creacion          DATETIME2(7)  NOT NULL CONSTRAINT DF_rutas_visitas_fecha_creacion DEFAULT (SYSUTCDATETIME()),
            fecha_modificacion      DATETIME2(7)  NOT NULL CONSTRAINT DF_rutas_visitas_fecha_modificacion DEFAULT (SYSUTCDATETIME()),
            id_usuario_creacion     INT           NULL,
            id_usuario_modificacion INT           NULL,
            CONSTRAINT PK_rutas_visitas PRIMARY KEY (id_ruta_visita),
            CONSTRAINT UQ_rutas_visitas_hospital UNIQUE (id_ruta, id_seleccion_hospital),
            CONSTRAINT UQ_rutas_visitas_orden UNIQUE (id_ruta, fecha_visita, orden)
        );
    END;
GO

    /* ==========================================================================
       SECCION 1.2 — Foreign Keys de las tablas nuevas (mismos nombres que en Dev)
       ========================================================================== */

    IF @@TRANCOUNT = 0 THROW 50000, 'Transaccion abortada; el script se detiene.', 1;

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_config_ranking_factores_config')
        ALTER TABLE Lefarma.educacion_medica.config_ranking_factores
            ADD CONSTRAINT FK_config_ranking_factores_config
            FOREIGN KEY (id_configuracion) REFERENCES Lefarma.educacion_medica.config_ranking (id_configuracion);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_selecciones_mensuales_tipo_gerencia')
        ALTER TABLE Lefarma.educacion_medica.selecciones_mensuales
            ADD CONSTRAINT FK_selecciones_mensuales_tipo_gerencia
            FOREIGN KEY (id_tipo_gerencia) REFERENCES Lefarma.educacion_medica.tipo_gerencia (id_tipo_gerencia);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_seleccion_zona_seleccion')
        ALTER TABLE Lefarma.educacion_medica.selecciones_zonas
            ADD CONSTRAINT FK_seleccion_zona_seleccion
            FOREIGN KEY (id_seleccion_mensual) REFERENCES Lefarma.educacion_medica.selecciones_mensuales (id_seleccion_mensual);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_seleccion_zona_equipo')
        ALTER TABLE Lefarma.educacion_medica.selecciones_zonas
            ADD CONSTRAINT FK_seleccion_zona_equipo
            FOREIGN KEY (id_equipo) REFERENCES Lefarma.educacion_medica.equipos_pareo (id_equipo);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_ranking_ejecuciones_seleccion')
        ALTER TABLE Lefarma.educacion_medica.ranking_ejecuciones
            ADD CONSTRAINT FK_ranking_ejecuciones_seleccion
            FOREIGN KEY (id_seleccion_mensual) REFERENCES Lefarma.educacion_medica.selecciones_mensuales (id_seleccion_mensual);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_ranking_ejecuciones_config')
        ALTER TABLE Lefarma.educacion_medica.ranking_ejecuciones
            ADD CONSTRAINT FK_ranking_ejecuciones_config
            FOREIGN KEY (id_configuracion) REFERENCES Lefarma.educacion_medica.config_ranking (id_configuracion);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_seleccion_hospital_seleccion')
        ALTER TABLE Lefarma.educacion_medica.selecciones_mensuales_hospitales
            ADD CONSTRAINT FK_seleccion_hospital_seleccion
            FOREIGN KEY (id_seleccion_mensual) REFERENCES Lefarma.educacion_medica.selecciones_mensuales (id_seleccion_mensual);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_seleccion_hospital_ranking_ejecucion')
        ALTER TABLE Lefarma.educacion_medica.selecciones_mensuales_hospitales
            ADD CONSTRAINT FK_seleccion_hospital_ranking_ejecucion
            FOREIGN KEY (id_ranking_ejecucion) REFERENCES Lefarma.educacion_medica.ranking_ejecuciones (id_ranking_ejecucion);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_ejecucion_hospital_ejecucion')
        ALTER TABLE Lefarma.educacion_medica.ranking_ejecucion_hospitales
            ADD CONSTRAINT FK_ejecucion_hospital_ejecucion
            FOREIGN KEY (id_ranking_ejecucion) REFERENCES Lefarma.educacion_medica.ranking_ejecuciones (id_ranking_ejecucion);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_rutas_seleccion')
        ALTER TABLE Lefarma.educacion_medica.rutas
            ADD CONSTRAINT FK_rutas_seleccion
            FOREIGN KEY (id_seleccion_mensual) REFERENCES Lefarma.educacion_medica.selecciones_mensuales (id_seleccion_mensual);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_rutas_equipo')
        ALTER TABLE Lefarma.educacion_medica.rutas
            ADD CONSTRAINT FK_rutas_equipo
            FOREIGN KEY (id_equipo) REFERENCES Lefarma.educacion_medica.equipos_pareo (id_equipo);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_rutas_visitas_ruta')
        ALTER TABLE Lefarma.educacion_medica.rutas_visitas
            ADD CONSTRAINT FK_rutas_visitas_ruta
            FOREIGN KEY (id_ruta) REFERENCES Lefarma.educacion_medica.rutas (id_ruta);

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.foreign_keys WHERE name = 'FK_rutas_visitas_seleccion_hospital')
        ALTER TABLE Lefarma.educacion_medica.rutas_visitas
            ADD CONSTRAINT FK_rutas_visitas_seleccion_hospital
            FOREIGN KEY (id_seleccion_hospital) REFERENCES Lefarma.educacion_medica.selecciones_mensuales_hospitales (id_seleccion_hospital);
GO

    /* ==========================================================================
       SECCION 2 — ALTER TABLE ADD COLUMN (columnas que Dev tiene y Prod no)
       ========================================================================== */

    IF @@TRANCOUNT = 0 THROW 50000, 'Transaccion abortada; el script se detiene.', 1;

    IF COL_LENGTH('Lefarma.config.workflow_bitacora', 'tipo_entidad') IS NULL
        ALTER TABLE Lefarma.config.workflow_bitacora ADD tipo_entidad VARCHAR(30) NULL;
    IF COL_LENGTH('Lefarma.config.workflow_bitacora', 'id_entidad') IS NULL
        ALTER TABLE Lefarma.config.workflow_bitacora ADD id_entidad INT NULL;

    IF COL_LENGTH('Lefarma.config.workflow_canal_templates', 'codigo_proceso') IS NULL
        ALTER TABLE Lefarma.config.workflow_canal_templates ADD codigo_proceso VARCHAR(50) NULL;
    IF COL_LENGTH('Lefarma.config.workflow_canal_templates', 'url_button') IS NULL
        ALTER TABLE Lefarma.config.workflow_canal_templates ADD url_button VARCHAR(200) NULL;

    /* --- Alinear UNIQUE con Dev: en Dev es (codigo_canal, codigo_proceso); en Prod era (codigo_canal) --- */
    IF EXISTS (SELECT 1 FROM Lefarma.sys.key_constraints WHERE name = 'UX_workflow_canal_templates_canal'
               AND parent_object_id = OBJECT_ID('Lefarma.config.workflow_canal_templates'))
        ALTER TABLE Lefarma.config.workflow_canal_templates DROP CONSTRAINT UX_workflow_canal_templates_canal;

    IF COL_LENGTH('Lefarma.educacion_medica.hospital_extension', 'es_zona_metropolitana') IS NULL
        ALTER TABLE Lefarma.educacion_medica.hospital_extension ADD es_zona_metropolitana BIT NULL;
GO

    /* Lote aparte: el UPDATE/CREATE INDEX referencian codigo_proceso, que el ALTER del lote
       anterior acaba de crear. Si vivieran en el mismo lote, SQL Server los enlazaria antes
       de ejecutar el ALTER y fallaria con Msg 207 (Invalid column name). */
    IF @@TRANCOUNT = 0 THROW 50000, 'Transaccion abortada; el script se detiene.', 1;

    /* --- Backfill: rellenar codigo_proceso/url_button en las 2 filas existentes con los valores de Dev --- */
    UPDATE p SET p.codigo_proceso = d.codigo_proceso, p.url_button = d.url_button
    FROM Lefarma.config.workflow_canal_templates p
    INNER JOIN LefarmaDev.config.workflow_canal_templates d ON d.id_template = p.id_template
    WHERE p.codigo_proceso IS NULL AND d.codigo_proceso IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.indexes WHERE name = 'UX_workflow_canal_templates_canal_proceso'
                   AND object_id = OBJECT_ID('Lefarma.config.workflow_canal_templates'))
        CREATE UNIQUE INDEX UX_workflow_canal_templates_canal_proceso
            ON Lefarma.config.workflow_canal_templates (codigo_canal, codigo_proceso);
GO

    /* ==========================================================================
       SECCION 3 — INSERT ... SELECT (registros en Dev que no existen en Prod)
       Orden por dependencias FK. Se conservan los IDs de Dev (IDENTITY_INSERT).
       ========================================================================== */

    IF @@TRANCOUNT = 0 THROW 50000, 'Transaccion abortada; el script se detiene.', 1;

    /* ------------------------------------------------------------------
       Limpieza de IDENTITY_INSERT: SQL Server permite tener la opcion ON para
       UNA SOLA tabla por sesion. Si una corrida anterior aborto en medio de un
       bloque, el SET ... ON pudo quedar activo y la siguiente corrida fallaria
       con Msg 8107 al intentar encender otra tabla. Estos SET ... OFF son
       no-op cuando la tabla ya esta apagada; garantizan re-ejecucion segura.
       ------------------------------------------------------------------ */
    SET IDENTITY_INSERT Lefarma.config.workflows OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_tipos_accion OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_pasos OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_acciones OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_participantes OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_mappings OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_canal_templates OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_jefes_excluidos OFF;
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_config OFF;
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_override OFF;
    SET IDENTITY_INSERT Lefarma.rh.tipo_solicitud OFF;
    SET IDENTITY_INSERT Lefarma.rh.dias_habiles OFF;
    SET IDENTITY_INSERT Lefarma.rh.saldos_vacaciones_anuales OFF;
    SET IDENTITY_INSERT Lefarma.rh.incidencias_checado_notificaciones_historial OFF;
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal OFF;
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal_detalle OFF;
    SET IDENTITY_INSERT Lefarma.staging.proveedores OFF;
    SET IDENTITY_INSERT Lefarma.staging.proveedor_forma_pago_cuentas OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.tipo_gerencia OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.hospital_extension OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.parametros_anestesias OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.config_ranking OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.config_ranking_factores OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.equipos_pareo OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.selecciones_mensuales OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.selecciones_zonas OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.ranking_ejecuciones OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.selecciones_mensuales_hospitales OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.ranking_ejecucion_hospitales OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.rutas OFF;
    SET IDENTITY_INSERT Lefarma.educacion_medica.rutas_visitas OFF;

    /* ---- config.usuario_detalle (PK int, NO identity) ---- */
    INSERT INTO Lefarma.config.usuario_detalle
        (id_usuario, id_empresa, id_sucursal, id_area, id_centro_costo, puesto, numero_empleado, firma_digital,
         telefono_oficina, extension, celular, telegram_chat, notificar_email, notificar_app, notificar_whatsapp,
         notificar_sms, notificar_telegram, notificar_solo_urgentes, notificar_resumen_diario, notificar_rechazos,
         notificar_vencimientos, id_usuario_delegado, delegacion_hasta, avatar_url, tema_interfaz, dashboard_inicio,
         activo, fecha_creacion, fecha_modificacion, firma_path, firma_documento, destinatarios_incidencias_default)
    SELECT d.id_usuario, d.id_empresa, d.id_sucursal, d.id_area, d.id_centro_costo, d.puesto, d.numero_empleado, d.firma_digital,
           d.telefono_oficina, d.extension, d.celular, d.telegram_chat, d.notificar_email, d.notificar_app, d.notificar_whatsapp,
           d.notificar_sms, d.notificar_telegram, d.notificar_solo_urgentes, d.notificar_resumen_diario, d.notificar_rechazos,
           d.notificar_vencimientos, d.id_usuario_delegado, d.delegacion_hasta, d.avatar_url, d.tema_interfaz, d.dashboard_inicio,
           d.activo, d.fecha_creacion, d.fecha_modificacion, d.firma_path, d.firma_documento, d.destinatarios_incidencias_default
    FROM LefarmaDev.config.usuario_detalle d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.usuario_detalle p WHERE p.id_usuario = d.id_usuario);

    /* ---- config.workflows ---- */
    SET IDENTITY_INSERT Lefarma.config.workflows ON;
    INSERT INTO Lefarma.config.workflows (id_workflow, nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    SELECT d.id_workflow, d.nombre, d.descripcion, d.codigo_proceso, d.version, d.activo, d.fecha_creacion
    FROM LefarmaDev.config.workflows d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflows p WHERE p.id_workflow = d.id_workflow);
    SET IDENTITY_INSERT Lefarma.config.workflows OFF;

    /* ---- config.workflow_tipos_accion ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_tipos_accion ON;
    INSERT INTO Lefarma.config.workflow_tipos_accion (id_tipo_accion, codigo, nombre, descripcion, cambia_estado, activo)
    SELECT d.id_tipo_accion, d.codigo, d.nombre, d.descripcion, d.cambia_estado, d.activo
    FROM LefarmaDev.config.workflow_tipos_accion d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_tipos_accion p WHERE p.id_tipo_accion = d.id_tipo_accion);
    SET IDENTITY_INSERT Lefarma.config.workflow_tipos_accion OFF;

    /* ---- config.workflow_pasos ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_pasos ON;
    INSERT INTO Lefarma.config.workflow_pasos
        (id_paso, id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, handler_key,
         es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, activo, permite_adjunto)
    SELECT d.id_paso, d.id_workflow, d.orden, d.nombre_paso, d.id_estado, d.descripcion_ayuda, d.handler_key,
           d.es_inicio, d.es_final, d.requiere_firma, d.requiere_comentario, d.requiere_adjunto, d.activo, d.permite_adjunto
    FROM LefarmaDev.config.workflow_pasos d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_pasos p WHERE p.id_paso = d.id_paso);
    SET IDENTITY_INSERT Lefarma.config.workflow_pasos OFF;

    /* ---- config.workflow_acciones ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_acciones ON;
    INSERT INTO Lefarma.config.workflow_acciones (id_accion, id_paso_origen, id_paso_destino, id_tipo_accion, activo, envia_concentrado)
    SELECT d.id_accion, d.id_paso_origen, d.id_paso_destino, d.id_tipo_accion, d.activo, d.envia_concentrado
    FROM LefarmaDev.config.workflow_acciones d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_acciones p WHERE p.id_accion = d.id_accion);
    SET IDENTITY_INSERT Lefarma.config.workflow_acciones OFF;

    /* ---- config.workflow_participantes ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_participantes ON;
    INSERT INTO Lefarma.config.workflow_participantes
        (id_participante, id_paso, id_rol, id_usuario, activo, nivel_jefe, requiere_jefe_inmediato)
    SELECT d.id_participante, d.id_paso, d.id_rol, d.id_usuario, d.activo, d.nivel_jefe, d.requiere_jefe_inmediato
    FROM LefarmaDev.config.workflow_participantes d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_participantes p WHERE p.id_participante = d.id_participante);
    SET IDENTITY_INSERT Lefarma.config.workflow_participantes OFF;

    /* ---- config.workflow_mappings ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_mappings ON;
    INSERT INTO Lefarma.config.workflow_mappings
        (id_mapping, codigo_proceso, id_scope_type, scope_id, id_workflow, prioridad_manual, activo,
         observaciones, fecha_creacion, creado_por, fecha_actualizacion)
    SELECT d.id_mapping, d.codigo_proceso, d.id_scope_type, d.scope_id, d.id_workflow, d.prioridad_manual, d.activo,
           d.observaciones, d.fecha_creacion, d.creado_por, d.fecha_actualizacion
    FROM LefarmaDev.config.workflow_mappings d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_mappings p WHERE p.id_mapping = d.id_mapping);
    SET IDENTITY_INSERT Lefarma.config.workflow_mappings OFF;

    /* ---- config.workflow_canal_templates ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_canal_templates ON;
    INSERT INTO Lefarma.config.workflow_canal_templates
        (id_template, codigo_canal, nombre, layout_html, activo, fecha_modificacion, codigo_proceso, url_button)
    SELECT d.id_template, d.codigo_canal, d.nombre, d.layout_html, d.activo, d.fecha_modificacion, d.codigo_proceso, d.url_button
    FROM LefarmaDev.config.workflow_canal_templates d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_canal_templates p WHERE p.id_template = d.id_template);
    SET IDENTITY_INSERT Lefarma.config.workflow_canal_templates OFF;

    /* ---- config.workflow_jefes_excluidos ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_jefes_excluidos ON;
    INSERT INTO Lefarma.config.workflow_jefes_excluidos
        (id_exclusion, id_workflow, id_usuario_jefe, activo, fecha_creacion, fecha_modificacion)
    SELECT d.id_exclusion, d.id_workflow, d.id_usuario_jefe, d.activo, d.fecha_creacion, d.fecha_modificacion
    FROM LefarmaDev.config.workflow_jefes_excluidos d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_jefes_excluidos p WHERE p.id_exclusion = d.id_exclusion);
    SET IDENTITY_INSERT Lefarma.config.workflow_jefes_excluidos OFF;

    /* ---- config.empleado_jefes_config ---- */
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_config ON;
    INSERT INTO Lefarma.config.empleado_jefes_config
        (id_config, id_usuario, nivel, aplica, activo, fecha_creacion, fecha_modificacion)
    SELECT d.id_config, d.id_usuario, d.nivel, d.aplica, d.activo, d.fecha_creacion, d.fecha_modificacion
    FROM LefarmaDev.config.empleado_jefes_config d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.empleado_jefes_config p WHERE p.id_config = d.id_config);
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_config OFF;

    /* ---- config.empleado_jefes_override ---- */
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_override ON;
    INSERT INTO Lefarma.config.empleado_jefes_override
        (id_override, id_usuario, nivel, id_usuario_jefe, activo, fecha_creacion, fecha_modificacion)
    SELECT d.id_override, d.id_usuario, d.nivel, d.id_usuario_jefe, d.activo, d.fecha_creacion, d.fecha_modificacion
    FROM LefarmaDev.config.empleado_jefes_override d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.empleado_jefes_override p WHERE p.id_override = d.id_override);
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_override OFF;

    /* ---- rh.tipo_solicitud ---- */
    SET IDENTITY_INSERT Lefarma.rh.tipo_solicitud ON;
    INSERT INTO Lefarma.rh.tipo_solicitud
        (id_tipo_solicitud, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, categoria,
         requiere_reposicion_tiempo, requiere_fecha_fin, requiere_fecha_regreso, requiere_lugar_comision,
         descuenta_nomina, descuenta_vacaciones, requiere_documentacion, activo, fecha_creacion, fecha_modificacion,
         limite_por_periodo, periodo_limite, total_para_descuento, permite_fechas_pasadas, permite_fechas_futuras,
         toma_en_cuenta_checado, requiere_incidencias_existentes, pide_dias_solicitados)
    SELECT d.id_tipo_solicitud, d.nombre, d.nombre_normalizado, d.descripcion, d.descripcion_normalizada, d.clave, d.categoria,
           d.requiere_reposicion_tiempo, d.requiere_fecha_fin, d.requiere_fecha_regreso, d.requiere_lugar_comision,
           d.descuenta_nomina, d.descuenta_vacaciones, d.requiere_documentacion, d.activo, d.fecha_creacion, d.fecha_modificacion,
           d.limite_por_periodo, d.periodo_limite, d.total_para_descuento, d.permite_fechas_pasadas, d.permite_fechas_futuras,
           d.toma_en_cuenta_checado, d.requiere_incidencias_existentes, d.pide_dias_solicitados
    FROM LefarmaDev.rh.tipo_solicitud d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.tipo_solicitud p WHERE p.id_tipo_solicitud = d.id_tipo_solicitud);
    SET IDENTITY_INSERT Lefarma.rh.tipo_solicitud OFF;

    /* ---- rh.dias_habiles ---- */
    SET IDENTITY_INSERT Lefarma.rh.dias_habiles ON;
    INSERT INTO Lefarma.rh.dias_habiles
        (id_dia_habil, id_empresa, id_sucursal, anio, mes, dia, fecha, descripcion, activo,
         fecha_creacion, consume_saldo, permite_saldo_negativo, es_dia_laboral)
    SELECT d.id_dia_habil, d.id_empresa, d.id_sucursal, d.anio, d.mes, d.dia, d.fecha, d.descripcion, d.activo,
           d.fecha_creacion, d.consume_saldo, d.permite_saldo_negativo, d.es_dia_laboral
    FROM LefarmaDev.rh.dias_habiles d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.dias_habiles p WHERE p.id_dia_habil = d.id_dia_habil);
    SET IDENTITY_INSERT Lefarma.rh.dias_habiles OFF;

    /* ---- rh.saldos_vacaciones_anuales ---- */
    SET IDENTITY_INSERT Lefarma.rh.saldos_vacaciones_anuales ON;
    INSERT INTO Lefarma.rh.saldos_vacaciones_anuales
        (id_saldo, id_usuario, id_empresa, anio, dias_generados, dias_vencidos, dias_compensados,
         dias_ajustados, dias_tomados, activo, fecha_creacion, fecha_modificacion)
    SELECT d.id_saldo, d.id_usuario, d.id_empresa, d.anio, d.dias_generados, d.dias_vencidos, d.dias_compensados,
           d.dias_ajustados, d.dias_tomados, d.activo, d.fecha_creacion, d.fecha_modificacion
    FROM LefarmaDev.rh.saldos_vacaciones_anuales d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.saldos_vacaciones_anuales p WHERE p.id_saldo = d.id_saldo);
    SET IDENTITY_INSERT Lefarma.rh.saldos_vacaciones_anuales OFF;

    /* ---- rh.incidencias_checado_notificaciones_historial ---- */
    SET IDENTITY_INSERT Lefarma.rh.incidencias_checado_notificaciones_historial ON;
    INSERT INTO Lefarma.rh.incidencias_checado_notificaciones_historial
        (id, notification_id, nomina, nombre, periodo, fecha_inicio, fecha_fin, asunto, mensaje, canales,
         exitoso, error, enviado_por, fecha_envio)
    SELECT d.id, d.notification_id, d.nomina, d.nombre, d.periodo, d.fecha_inicio, d.fecha_fin, d.asunto, d.mensaje, d.canales,
           d.exitoso, d.error, d.enviado_por, d.fecha_envio
    FROM LefarmaDev.rh.incidencias_checado_notificaciones_historial d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.incidencias_checado_notificaciones_historial p WHERE p.id = d.id);
    SET IDENTITY_INSERT Lefarma.rh.incidencias_checado_notificaciones_historial OFF;

    /* ---- rh.solicitudes_personal ---- */
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal ON;
    INSERT INTO Lefarma.rh.solicitudes_personal
        (id_solicitud, folio, id_empresa, id_sucursal, id_area, id_usuario_solicitante, id_estado, id_workflow,
         id_paso_actual, id_tipo_solicitud, lugar_comision, motivo, id_usuario_creador, fecha_envio,
         fecha_inicio, fecha_fin, fecha_reposicion, dias_solicitados, fecha_regreso, fecha_creacion, fecha_modificacion)
    SELECT d.id_solicitud, d.folio, d.id_empresa, d.id_sucursal, d.id_area, d.id_usuario_solicitante, d.id_estado, d.id_workflow,
           d.id_paso_actual, d.id_tipo_solicitud, d.lugar_comision, d.motivo, d.id_usuario_creador, d.fecha_envio,
           d.fecha_inicio, d.fecha_fin, d.fecha_reposicion, d.dias_solicitados, d.fecha_regreso, d.fecha_creacion, d.fecha_modificacion
    FROM LefarmaDev.rh.solicitudes_personal d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.solicitudes_personal p WHERE p.id_solicitud = d.id_solicitud);
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal OFF;

    /* ---- rh.solicitudes_personal_detalle ---- */
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal_detalle ON;
    INSERT INTO Lefarma.rh.solicitudes_personal_detalle (id_detalle, id_solicitud, fecha, comentario, fecha_creacion)
    SELECT d.id_detalle, d.id_solicitud, d.fecha, d.comentario, d.fecha_creacion
    FROM LefarmaDev.rh.solicitudes_personal_detalle d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.solicitudes_personal_detalle p WHERE p.id_detalle = d.id_detalle);
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal_detalle OFF;

    /* ---- staging.proveedores ---- */
    SET IDENTITY_INSERT Lefarma.staging.proveedores ON;
    INSERT INTO Lefarma.staging.proveedores
        (id_staging, id_proveedor, razon_social, razon_social_normalizada, rfc, codigo_postal, regimen_fiscal_id,
         uso_cfdi, sin_datos_fiscales, estatus, cambio_estatus_por, fecha_registro, fecha_modificacion,
         fecha_staging, editado_por)
    SELECT d.id_staging, d.id_proveedor, d.razon_social, d.razon_social_normalizada, d.rfc, d.codigo_postal, d.regimen_fiscal_id,
           d.uso_cfdi, d.sin_datos_fiscales, d.estatus, d.cambio_estatus_por, d.fecha_registro, d.fecha_modificacion,
           d.fecha_staging, d.editado_por
    FROM LefarmaDev.staging.proveedores d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.staging.proveedores p WHERE p.id_staging = d.id_staging);
    SET IDENTITY_INSERT Lefarma.staging.proveedores OFF;

    /* ---- staging.proveedor_forma_pago_cuentas ---- */
    SET IDENTITY_INSERT Lefarma.staging.proveedor_forma_pago_cuentas ON;
    INSERT INTO Lefarma.staging.proveedor_forma_pago_cuentas
        (id_staging_cuenta, id_staging, id_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta,
         beneficiario, correo_notificacion, activo, id_cuen, caratula_path)
    SELECT d.id_staging_cuenta, d.id_staging, d.id_forma_pago, d.id_banco, d.numero_cuenta, d.clabe, d.numero_tarjeta,
           d.beneficiario, d.correo_notificacion, d.activo, d.id_cuen, d.caratula_path
    FROM LefarmaDev.staging.proveedor_forma_pago_cuentas d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.staging.proveedor_forma_pago_cuentas p WHERE p.id_staging_cuenta = d.id_staging_cuenta);
    SET IDENTITY_INSERT Lefarma.staging.proveedor_forma_pago_cuentas OFF;

    /* ---- educacion_medica.tipo_gerencia ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.tipo_gerencia ON;
    INSERT INTO Lefarma.educacion_medica.tipo_gerencia
        (id_tipo_gerencia, descripcion, activo, fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
    SELECT d.id_tipo_gerencia, d.descripcion, d.activo, d.fecha_creacion, d.fecha_modificacion, d.id_usuario_creacion, d.id_usuario_modificacion
    FROM LefarmaDev.educacion_medica.tipo_gerencia d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.tipo_gerencia p WHERE p.id_tipo_gerencia = d.id_tipo_gerencia);
    SET IDENTITY_INSERT Lefarma.educacion_medica.tipo_gerencia OFF;

    /* ---- educacion_medica.hospital_extension ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.hospital_extension ON;
    INSERT INTO Lefarma.educacion_medica.hospital_extension
        (id_hospital_extension, id_hospital, fecha, id_tipo_gerencia, con_sia, numero_quirofanos,
         anestesias_totales, anestesias_generales, anestesias_regionales, anestesias_epidurales, anestesias_subdurales,
         anestesias_mixtas_obesos, anestesias_mixtas_no_obesos, activo, fecha_creacion, fecha_modificacion,
         id_usuario_creacion, id_usuario_modificacion, es_zona_metropolitana)
    SELECT d.id_hospital_extension, d.id_hospital, d.fecha, d.id_tipo_gerencia, d.con_sia, d.numero_quirofanos,
           d.anestesias_totales, d.anestesias_generales, d.anestesias_regionales, d.anestesias_epidurales, d.anestesias_subdurales,
           d.anestesias_mixtas_obesos, d.anestesias_mixtas_no_obesos, d.activo, d.fecha_creacion, d.fecha_modificacion,
           d.id_usuario_creacion, d.id_usuario_modificacion, d.es_zona_metropolitana
    FROM LefarmaDev.educacion_medica.hospital_extension d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.hospital_extension p WHERE p.id_hospital_extension = d.id_hospital_extension);
    SET IDENTITY_INSERT Lefarma.educacion_medica.hospital_extension OFF;

    /* ---- educacion_medica.parametros_anestesias ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.parametros_anestesias ON;
    INSERT INTO Lefarma.educacion_medica.parametros_anestesias
        (id_parametro_anestesia, anio, clave, valor, descripcion, orden, activo,
         fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
    SELECT d.id_parametro_anestesia, d.anio, d.clave, d.valor, d.descripcion, d.orden, d.activo,
           d.fecha_creacion, d.fecha_modificacion, d.id_usuario_creacion, d.id_usuario_modificacion
    FROM LefarmaDev.educacion_medica.parametros_anestesias d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.parametros_anestesias p WHERE p.id_parametro_anestesia = d.id_parametro_anestesia);
    SET IDENTITY_INSERT Lefarma.educacion_medica.parametros_anestesias OFF;

    /* ---- educacion_medica.config_ranking ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.config_ranking ON;
    INSERT INTO Lefarma.educacion_medica.config_ranking
        (id_configuracion, nombre, version, activo, fecha_vigencia_inicio, fecha_vigencia_fin,
         fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
    SELECT d.id_configuracion, d.nombre, d.version, d.activo, d.fecha_vigencia_inicio, d.fecha_vigencia_fin,
           d.fecha_creacion, d.fecha_modificacion, d.id_usuario_creacion, d.id_usuario_modificacion
    FROM LefarmaDev.educacion_medica.config_ranking d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.config_ranking p WHERE p.id_configuracion = d.id_configuracion);
    SET IDENTITY_INSERT Lefarma.educacion_medica.config_ranking OFF;

    /* ---- educacion_medica.config_ranking_factores ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.config_ranking_factores ON;
    INSERT INTO Lefarma.educacion_medica.config_ranking_factores
        (id_factor, id_configuracion, clave, grupo, peso, activo, tipo_normalizacion, parametros_json)
    SELECT d.id_factor, d.id_configuracion, d.clave, d.grupo, d.peso, d.activo, d.tipo_normalizacion, d.parametros_json
    FROM LefarmaDev.educacion_medica.config_ranking_factores d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.config_ranking_factores p WHERE p.id_factor = d.id_factor);
    SET IDENTITY_INSERT Lefarma.educacion_medica.config_ranking_factores OFF;

    /* ---- educacion_medica.parametros_modulo (PK clave, NO identity) ---- */
    INSERT INTO Lefarma.educacion_medica.parametros_modulo
        (clave, valor, descripcion, activo, fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
    SELECT d.clave, d.valor, d.descripcion, d.activo, d.fecha_creacion, d.fecha_modificacion, d.id_usuario_creacion, d.id_usuario_modificacion
    FROM LefarmaDev.educacion_medica.parametros_modulo d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.parametros_modulo p WHERE p.clave = d.clave);

    /* ---- educacion_medica.equipos_pareo ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.equipos_pareo ON;
    INSERT INTO Lefarma.educacion_medica.equipos_pareo
        (id_equipo, id_ejecutivo, id_especialista, fecha_inicio, fecha_fin, activo,
         fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
    SELECT d.id_equipo, d.id_ejecutivo, d.id_especialista, d.fecha_inicio, d.fecha_fin, d.activo,
           d.fecha_creacion, d.fecha_modificacion, d.id_usuario_creacion, d.id_usuario_modificacion
    FROM LefarmaDev.educacion_medica.equipos_pareo d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.equipos_pareo p WHERE p.id_equipo = d.id_equipo);
    SET IDENTITY_INSERT Lefarma.educacion_medica.equipos_pareo OFF;

    /* ---- educacion_medica.selecciones_mensuales ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.selecciones_mensuales ON;
    INSERT INTO Lefarma.educacion_medica.selecciones_mensuales
        (id_seleccion_mensual, fecha_seleccion, id_tipo_gerencia, fecha_inicio_vigencia, fecha_fin_vigencia,
         talleres_objetivo_mes, activo, fecha_creacion, fecha_modificacion, id_usuario_creacion,
         id_usuario_modificacion, firma_gv_fecha, firma_gg_fecha, estado)
    SELECT d.id_seleccion_mensual, d.fecha_seleccion, d.id_tipo_gerencia, d.fecha_inicio_vigencia, d.fecha_fin_vigencia,
           d.talleres_objetivo_mes, d.activo, d.fecha_creacion, d.fecha_modificacion, d.id_usuario_creacion,
           d.id_usuario_modificacion, d.firma_gv_fecha, d.firma_gg_fecha, d.estado
    FROM LefarmaDev.educacion_medica.selecciones_mensuales d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.selecciones_mensuales p WHERE p.id_seleccion_mensual = d.id_seleccion_mensual);
    SET IDENTITY_INSERT Lefarma.educacion_medica.selecciones_mensuales OFF;

    /* ---- educacion_medica.selecciones_zonas ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.selecciones_zonas ON;
    INSERT INTO Lefarma.educacion_medica.selecciones_zonas
        (id_zona, id_seleccion_mensual, nombre, centro_latitud, centro_longitud, cantidad_hospitales,
         algoritmo, fecha_calculo, id_equipo, fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
    SELECT d.id_zona, d.id_seleccion_mensual, d.nombre, d.centro_latitud, d.centro_longitud, d.cantidad_hospitales,
           d.algoritmo, d.fecha_calculo, d.id_equipo, d.fecha_creacion, d.fecha_modificacion, d.id_usuario_creacion, d.id_usuario_modificacion
    FROM LefarmaDev.educacion_medica.selecciones_zonas d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.selecciones_zonas p WHERE p.id_zona = d.id_zona);
    SET IDENTITY_INSERT Lefarma.educacion_medica.selecciones_zonas OFF;

    /* ---- educacion_medica.ranking_ejecuciones ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.ranking_ejecuciones ON;
    INSERT INTO Lefarma.educacion_medica.ranking_ejecuciones
        (id_ranking_ejecucion, id_seleccion_mensual, id_configuracion, version_algoritmo, cantidad_solicitada,
         cantidad_candidatos, pesos_efectivos_json, filtros_json, fecha_ejecucion, id_usuario_ejecucion)
    SELECT d.id_ranking_ejecucion, d.id_seleccion_mensual, d.id_configuracion, d.version_algoritmo, d.cantidad_solicitada,
           d.cantidad_candidatos, d.pesos_efectivos_json, d.filtros_json, d.fecha_ejecucion, d.id_usuario_ejecucion
    FROM LefarmaDev.educacion_medica.ranking_ejecuciones d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.ranking_ejecuciones p WHERE p.id_ranking_ejecucion = d.id_ranking_ejecucion);
    SET IDENTITY_INSERT Lefarma.educacion_medica.ranking_ejecuciones OFF;

    /* ---- educacion_medica.selecciones_mensuales_hospitales ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.selecciones_mensuales_hospitales ON;
    INSERT INTO Lefarma.educacion_medica.selecciones_mensuales_hospitales
        (id_seleccion_hospital, id_seleccion_mensual, id_hospital, region, entidad_federativa, ciudad_municipio,
         id_ejecutivo, producto_a_promocionar, observaciones, fecha_creacion, fecha_modificacion,
         id_usuario_creacion, id_usuario_modificacion, latitud_snapshot, longitud_snapshot, id_zona,
         id_ranking_ejecucion, score_sugerencia)
    SELECT d.id_seleccion_hospital, d.id_seleccion_mensual, d.id_hospital, d.region, d.entidad_federativa, d.ciudad_municipio,
           d.id_ejecutivo, d.producto_a_promocionar, d.observaciones, d.fecha_creacion, d.fecha_modificacion,
           d.id_usuario_creacion, d.id_usuario_modificacion, d.latitud_snapshot, d.longitud_snapshot, d.id_zona,
           d.id_ranking_ejecucion, d.score_sugerencia
    FROM LefarmaDev.educacion_medica.selecciones_mensuales_hospitales d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.selecciones_mensuales_hospitales p WHERE p.id_seleccion_hospital = d.id_seleccion_hospital);
    SET IDENTITY_INSERT Lefarma.educacion_medica.selecciones_mensuales_hospitales OFF;

    /* ---- educacion_medica.ranking_ejecucion_hospitales ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.ranking_ejecucion_hospitales ON;
    INSERT INTO Lefarma.educacion_medica.ranking_ejecucion_hospitales
        (id_ejecucion_hospital, id_ranking_ejecucion, id_hospital, posicion, score_total,
         porcentaje_completitud, es_top_sugerido, decision, factores_json)
    SELECT d.id_ejecucion_hospital, d.id_ranking_ejecucion, d.id_hospital, d.posicion, d.score_total,
           d.porcentaje_completitud, d.es_top_sugerido, d.decision, d.factores_json
    FROM LefarmaDev.educacion_medica.ranking_ejecucion_hospitales d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.ranking_ejecucion_hospitales p WHERE p.id_ejecucion_hospital = d.id_ejecucion_hospital);
    SET IDENTITY_INSERT Lefarma.educacion_medica.ranking_ejecucion_hospitales OFF;

    /* ---- educacion_medica.rutas ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.rutas ON;
    INSERT INTO Lefarma.educacion_medica.rutas
        (id_ruta, id_seleccion_mensual, id_equipo, version, nombre, estado, fecha_confirmacion,
         fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
    SELECT d.id_ruta, d.id_seleccion_mensual, d.id_equipo, d.version, d.nombre, d.estado, d.fecha_confirmacion,
           d.fecha_creacion, d.fecha_modificacion, d.id_usuario_creacion, d.id_usuario_modificacion
    FROM LefarmaDev.educacion_medica.rutas d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.rutas p WHERE p.id_ruta = d.id_ruta);
    SET IDENTITY_INSERT Lefarma.educacion_medica.rutas OFF;

    /* ---- educacion_medica.rutas_visitas ---- */
    SET IDENTITY_INSERT Lefarma.educacion_medica.rutas_visitas ON;
    INSERT INTO Lefarma.educacion_medica.rutas_visitas
        (id_ruta_visita, id_ruta, id_seleccion_hospital, id_hospital, fecha_visita, orden,
         hora_salida, hora_llegada, fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
    SELECT d.id_ruta_visita, d.id_ruta, d.id_seleccion_hospital, d.id_hospital, d.fecha_visita, d.orden,
           d.hora_salida, d.hora_llegada, d.fecha_creacion, d.fecha_modificacion, d.id_usuario_creacion, d.id_usuario_modificacion
    FROM LefarmaDev.educacion_medica.rutas_visitas d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.educacion_medica.rutas_visitas p WHERE p.id_ruta_visita = d.id_ruta_visita);
    SET IDENTITY_INSERT Lefarma.educacion_medica.rutas_visitas OFF;
GO

    /* ==========================================================================
       SECCION 4 — Verificacion: conteos en Lefarma despues de la sincronizacion
       ========================================================================== */

    IF @@TRANCOUNT = 0 THROW 50000, 'Transaccion abortada; el script se detiene.', 1;

    SELECT 'config.workflows' AS tabla, COUNT(*) AS filas FROM Lefarma.config.workflows
    UNION ALL SELECT 'config.workflow_pasos', COUNT(*) FROM Lefarma.config.workflow_pasos
    UNION ALL SELECT 'config.workflow_acciones', COUNT(*) FROM Lefarma.config.workflow_acciones
    UNION ALL SELECT 'config.workflow_participantes', COUNT(*) FROM Lefarma.config.workflow_participantes
    UNION ALL SELECT 'config.workflow_mappings', COUNT(*) FROM Lefarma.config.workflow_mappings
    UNION ALL SELECT 'config.workflow_canal_templates', COUNT(*) FROM Lefarma.config.workflow_canal_templates
    UNION ALL SELECT 'config.workflow_jefes_excluidos', COUNT(*) FROM Lefarma.config.workflow_jefes_excluidos
    UNION ALL SELECT 'config.empleado_jefes_config', COUNT(*) FROM Lefarma.config.empleado_jefes_config
    UNION ALL SELECT 'config.empleado_jefes_override', COUNT(*) FROM Lefarma.config.empleado_jefes_override
    UNION ALL SELECT 'config.usuario_detalle', COUNT(*) FROM Lefarma.config.usuario_detalle
    UNION ALL SELECT 'educacion_medica.config_ranking', COUNT(*) FROM Lefarma.educacion_medica.config_ranking
    UNION ALL SELECT 'educacion_medica.config_ranking_factores', COUNT(*) FROM Lefarma.educacion_medica.config_ranking_factores
    UNION ALL SELECT 'educacion_medica.equipos_pareo', COUNT(*) FROM Lefarma.educacion_medica.equipos_pareo
    UNION ALL SELECT 'educacion_medica.parametros_modulo', COUNT(*) FROM Lefarma.educacion_medica.parametros_modulo
    UNION ALL SELECT 'educacion_medica.ranking_ejecuciones', COUNT(*) FROM Lefarma.educacion_medica.ranking_ejecuciones
    UNION ALL SELECT 'educacion_medica.ranking_ejecucion_hospitales', COUNT(*) FROM Lefarma.educacion_medica.ranking_ejecucion_hospitales
    UNION ALL SELECT 'educacion_medica.rutas', COUNT(*) FROM Lefarma.educacion_medica.rutas
    UNION ALL SELECT 'educacion_medica.rutas_visitas', COUNT(*) FROM Lefarma.educacion_medica.rutas_visitas
    UNION ALL SELECT 'educacion_medica.selecciones_mensuales', COUNT(*) FROM Lefarma.educacion_medica.selecciones_mensuales
    UNION ALL SELECT 'educacion_medica.selecciones_mensuales_hospitales', COUNT(*) FROM Lefarma.educacion_medica.selecciones_mensuales_hospitales
    UNION ALL SELECT 'educacion_medica.selecciones_zonas', COUNT(*) FROM Lefarma.educacion_medica.selecciones_zonas
    UNION ALL SELECT 'educacion_medica.tipo_gerencia', COUNT(*) FROM Lefarma.educacion_medica.tipo_gerencia
    UNION ALL SELECT 'educacion_medica.hospital_extension', COUNT(*) FROM Lefarma.educacion_medica.hospital_extension
    UNION ALL SELECT 'educacion_medica.parametros_anestesias', COUNT(*) FROM Lefarma.educacion_medica.parametros_anestesias
    UNION ALL SELECT 'rh.dias_habiles', COUNT(*) FROM Lefarma.rh.dias_habiles
    UNION ALL SELECT 'rh.saldos_vacaciones_anuales', COUNT(*) FROM Lefarma.rh.saldos_vacaciones_anuales
    UNION ALL SELECT 'rh.incidencias_checado_notificaciones_historial', COUNT(*) FROM Lefarma.rh.incidencias_checado_notificaciones_historial
    UNION ALL SELECT 'rh.solicitudes_personal', COUNT(*) FROM Lefarma.rh.solicitudes_personal
    UNION ALL SELECT 'rh.solicitudes_personal_detalle', COUNT(*) FROM Lefarma.rh.solicitudes_personal_detalle
    UNION ALL SELECT 'rh.tipo_solicitud', COUNT(*) FROM Lefarma.rh.tipo_solicitud
    UNION ALL SELECT 'staging.proveedores', COUNT(*) FROM Lefarma.staging.proveedores
    UNION ALL SELECT 'staging.proveedor_forma_pago_cuentas', COUNT(*) FROM Lefarma.staging.proveedor_forma_pago_cuentas;
GO

IF @@TRANCOUNT > 0
BEGIN
    COMMIT TRANSACTION;
    PRINT 'SINCRONIZACION COMPLETADA CORRECTAMENTE (commit aplicado).';
END
ELSE
    PRINT 'NO SE APLICO NADA: la transaccion fue abortada por errores anteriores. Revisar mensajes previos.';
GO