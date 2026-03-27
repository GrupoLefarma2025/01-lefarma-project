-- ============================================================================
-- LEFARMA - CREACION DE TABLAS CONSOLIDADO
-- ============================================================================
-- Fecha: 2026-03-27
-- Descripcion: Script consolidado con todos los CREATE TABLE ordenados por dependencias
-- NO INCLUIR: ALTER TABLE (solo CREATE TABLE originales)
-- ============================================================================

USE Lefarma;
GO

-- ============================================================================
-- CREAR SCHEMAS
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'catalogos')
BEGIN
    EXEC('CREATE SCHEMA catalogos');
    PRINT 'Schema [catalogos] creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'config')
BEGIN
    EXEC('CREATE SCHEMA config');
    PRINT 'Schema [config] creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'operaciones')
BEGIN
    EXEC('CREATE SCHEMA operaciones');
    PRINT 'Schema [operaciones] creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'app')
BEGIN
    EXEC('CREATE SCHEMA [app]');
    PRINT 'Schema [app] creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'help')
BEGIN
    EXEC('CREATE SCHEMA [help]');
    PRINT 'Schema [help] creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'archivos')
BEGIN
    EXEC('CREATE SCHEMA archivos');
    PRINT 'Schema [archivos] creado';
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'SCHEMAS CREADOS';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- SCHEMA: catalogos (TABLAS SIN FKs PRIMERO)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- catalogos.empresas
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[empresas]'))
BEGIN
    CREATE TABLE catalogos.empresas (
        id_empresa INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255),
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        clave VARCHAR(50) UNIQUE,
        razon_social VARCHAR(255),
        rfc VARCHAR(13) UNIQUE,
        direccion VARCHAR(255),
        colonia VARCHAR(100),
        ciudad VARCHAR(100),
        estado VARCHAR(100),
        codigo_postal VARCHAR(10),
        telefono VARCHAR(20),
        email VARCHAR(100),
        pagina_web VARCHAR(255),
        numero_empleados INT DEFAULT 0,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [catalogos].[empresas] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.tipos_gasto
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[tipos_gasto]'))
BEGIN
    CREATE TABLE catalogos.tipos_gasto (
        id_tipo_gasto INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255),
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        clave VARCHAR(50) UNIQUE,
        concepto VARCHAR(255),
        cuenta CHAR(3),
        sub_cuenta CHAR(3),
        analitica CHAR(3),
        integracion CHAR(3),
        cuenta_catalogo CHAR(15),
        requiere_comprobacion_pago BIT DEFAULT 1,
        requiere_comprobacion_gasto BIT DEFAULT 1,
        permite_sin_datos_fiscales BIT DEFAULT 0,
        dias_limite_comprobacion INT,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [catalogos].[tipos_gasto] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.tipos_medida
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[tipos_medida]'))
BEGIN
    CREATE TABLE catalogos.tipos_medida (
        id_tipo_medida INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(80) UNIQUE NOT NULL,
        nombre_normalizado VARCHAR(80),
        descripcion VARCHAR(255),
        descripcion_normalizada VARCHAR(255),
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [catalogos].[tipos_medida] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.bancos
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[bancos]'))
BEGIN
    CREATE TABLE catalogos.bancos (
        id_banco INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255) NOT NULL,
        clave VARCHAR(50),
        codigo_swift VARCHAR(20),
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [catalogos].[bancos] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.formas_pago
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[formas_pago]'))
BEGIN
    CREATE TABLE catalogos.formas_pago (
        id_forma_pago INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255) NOT NULL,
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        clave VARCHAR(50),
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [catalogos].[formas_pago] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.gastos
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[gastos]'))
BEGIN
    CREATE TABLE catalogos.gastos (
        id_gasto INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255) NOT NULL,
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        clave VARCHAR(50),
        concepto VARCHAR(255),
        cuenta VARCHAR(3),
        sub_cuenta VARCHAR(3),
        analitica VARCHAR(3),
        integracion VARCHAR(3),
        cuenta_catalogo VARCHAR(15),
        requiere_comprobacion_pago BIT DEFAULT 1,
        requiere_comprobacion_gasto BIT DEFAULT 1,
        permite_sin_datos_fiscales BIT DEFAULT 0,
        dias_limite_comprobacion INT,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [catalogos].[gastos] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.medidas
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[medidas]'))
BEGIN
    CREATE TABLE catalogos.medidas (
        id_medida INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255) NOT NULL,
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [catalogos].[medidas] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.medios_pago
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[medios_pago]'))
BEGIN
    CREATE TABLE catalogos.medios_pago (
        id_medio_pago INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255) NOT NULL,
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        clave VARCHAR(50),
        codigo_sat VARCHAR(10),
        requiere_referencia BIT DEFAULT 0,
        requiere_autorizacion BIT DEFAULT 0,
        limite_monto DECIMAL(18, 2),
        plazo_maximo_dias INT,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [catalogos].[medios_pago] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.centros_costo
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[centros_costo]'))
BEGIN
    CREATE TABLE catalogos.centros_costo (
        id_centro_costo INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255) NOT NULL,
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [catalogos].[centros_costo] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.estatus_orden (con autorreferencia)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[estatus_orden]'))
BEGIN
    CREATE TABLE catalogos.estatus_orden (
        id_estatus_orden INT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion VARCHAR(255),
        siguiente_estatus_id INT NULL,
        requiere_accion BIT DEFAULT 0,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        CONSTRAINT FK_EstatusOrden_SiguienteEstatus FOREIGN KEY (siguiente_estatus_id)
            REFERENCES catalogos.estatus_orden(id_estatus_orden)
    );
    PRINT 'Tabla [catalogos].[estatus_orden] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.regimenes_fiscales
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[regimenes_fiscales]'))
BEGIN
    CREATE TABLE catalogos.regimenes_fiscales (
        id_regimen_fiscal INT IDENTITY(1,1) PRIMARY KEY,
        clave VARCHAR(10) NOT NULL,
        descripcion VARCHAR(255) NOT NULL,
        tipo_persona VARCHAR(10) NOT NULL,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        CONSTRAINT UQ_RegimenFiscal_Clave_Tipo UNIQUE (clave, tipo_persona)
    );
    PRINT 'Tabla [catalogos].[regimenes_fiscales] creada';
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'CATALOGOS - Tablas sin FKs creadas';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- SCHEMA: catalogos (TABLAS CON FKs)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- catalogos.sucursales (FK -> empresas)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[sucursales]'))
BEGIN
    CREATE TABLE catalogos.sucursales (
        id_sucursal INT IDENTITY(1,1) PRIMARY KEY,
        id_empresa INT NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255),
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        clave VARCHAR(50) UNIQUE,
        clave_contable VARCHAR(255) UNIQUE,
        direccion VARCHAR(255),
        codigo_postal VARCHAR(10),
        ciudad VARCHAR(100),
        estado VARCHAR(100),
        telefono VARCHAR(20),
        latitud DECIMAL(10, 7),
        longitud DECIMAL(10, 7),
        numero_empleados INT DEFAULT 0,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Sucursales_Empresas FOREIGN KEY (id_empresa) REFERENCES catalogos.empresas(id_empresa)
    );
    PRINT 'Tabla [catalogos].[sucursales] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.areas (FK -> empresas)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[areas]'))
BEGIN
    CREATE TABLE catalogos.areas (
        id_area INT IDENTITY(1,1) PRIMARY KEY,
        id_empresa INT NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255),
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        clave VARCHAR(50) UNIQUE,
        id_supervisor_responsable INT,
        numero_empleados INT DEFAULT 0,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Areas_Empresas FOREIGN KEY (id_empresa) REFERENCES catalogos.empresas(id_empresa)
    );
    PRINT 'Tabla [catalogos].[areas] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.unidades_medida (FK -> tipos_medida)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[unidades_medida]'))
BEGIN
    CREATE TABLE catalogos.unidades_medida (
        id_unidad_medida INT IDENTITY(1,1) PRIMARY KEY,
        id_tipo_medida INT NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        nombre_normalizado VARCHAR(255),
        descripcion VARCHAR(500),
        descripcion_normalizada VARCHAR(500),
        abreviatura VARCHAR(20) UNIQUE NOT NULL,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_UnidadesMedida_TiposMedida FOREIGN KEY (id_tipo_medida) REFERENCES catalogos.tipos_medida(id_tipo_medida)
    );
    PRINT 'Tabla [catalogos].[unidades_medida] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.cuentas_contables (FK -> centros_costo)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[cuentas_contables]'))
BEGIN
    CREATE TABLE catalogos.cuentas_contables (
        id_cuenta_contable INT IDENTITY(1,1) PRIMARY KEY,
        cuenta VARCHAR(20) NOT NULL,
        descripcion VARCHAR(255) NOT NULL,
        descripcion_normalizada VARCHAR(255) NOT NULL,
        nivel1 VARCHAR(3) NOT NULL,
        nivel2 VARCHAR(10) NOT NULL,
        empresa_prefijo VARCHAR(20),
        centro_costo_id INT NULL,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_CuentasContables_CentrosCosto FOREIGN KEY (centro_costo_id)
            REFERENCES catalogos.centros_costo(id_centro_costo)
    );
    PRINT 'Tabla [catalogos].[cuentas_contables] creada';
END
GO

-- ---------------------------------------------------------------------------
-- catalogos.proveedores (FK -> regimenes_fiscales)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[proveedores]'))
BEGIN
    CREATE TABLE catalogos.proveedores (
        id_proveedor INT IDENTITY(1,1) PRIMARY KEY,
        razon_social VARCHAR(255) NOT NULL,
        razon_social_normalizada VARCHAR(255) NOT NULL,
        rfc VARCHAR(13),
        codigo_postal VARCHAR(10),
        regimen_fiscal_id INT NULL,
        persona_contacto VARCHAR(255),
        nota_forma_pago VARCHAR(500),
        notas_generales VARCHAR(1000),
        sin_datos_fiscales BIT DEFAULT 0,
        autorizado_por_cxp BIT DEFAULT 0,
        fecha_registro DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Proveedores_RegimenFiscal FOREIGN KEY (regimen_fiscal_id)
            REFERENCES catalogos.regimenes_fiscales(id_regimen_fiscal),
        CONSTRAINT UQ_Proveedores_RFC UNIQUE (rfc)
    );
    PRINT 'Tabla [catalogos].[proveedores] creada';
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'CATALOGOS - Tablas con FKs creadas';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- SCHEMA: config
-- ============================================================================

-- ---------------------------------------------------------------------------
-- config.usuario_detalle
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[usuario_detalle]'))
BEGIN
    CREATE TABLE config.usuario_detalle (
        id_usuario INT PRIMARY KEY,
        id_empresa INT NOT NULL,
        id_sucursal INT NOT NULL,
        id_area INT NULL,
        id_centro_costo INT NULL,
        puesto VARCHAR(150) NULL,
        numero_empleado VARCHAR(50) NULL,
        firma_digital VARCHAR(MAX) NULL,
        avatar_url VARCHAR(255) NULL,
        celular VARCHAR(20) NULL,
        id_telegram_chat VARCHAR(100) NULL,
        id_whatsapp_externo VARCHAR(100) NULL,
        canal_preferido VARCHAR(20) DEFAULT 'email',
        notificar_email BIT DEFAULT 1,
        notificar_app BIT DEFAULT 1,
        notificar_whatsapp BIT DEFAULT 0,
        notificar_telegram BIT DEFAULT 0,
        notificar_sms BIT DEFAULT 0,
        notificar_solo_urgentes BIT DEFAULT 0,
        notificar_resumen_diario BIT DEFAULT 1,
        notificar_rechazos BIT DEFAULT 1,
        notificar_vencimientos BIT DEFAULT 1,
        id_usuario_delegado INT NULL,
        delegacion_hasta DATE NULL,
        tema_interfaz VARCHAR(20) DEFAULT 'light',
        dashboard_inicio VARCHAR(50) NULL,
        elementos_por_pagina INT DEFAULT 10,
        fecha_actualizacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [config].[usuario_detalle] creada';
END
GO

-- ---------------------------------------------------------------------------
-- config.workflows
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[workflows]'))
BEGIN
    CREATE TABLE config.workflows (
        id_workflow INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion VARCHAR(255) NULL,
        codigo_proceso VARCHAR(50) UNIQUE NOT NULL,
        version INT DEFAULT 1,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla [config].[workflows] creada';
END
GO

-- ---------------------------------------------------------------------------
-- config.workflow_pasos (FK -> workflows)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[workflow_pasos]'))
BEGIN
    CREATE TABLE config.workflow_pasos (
        id_paso INT IDENTITY(1,1) PRIMARY KEY,
        id_workflow INT NOT NULL,
        orden INT NOT NULL,
        nombre_paso VARCHAR(100) NOT NULL,
        codigo_estado VARCHAR(50) UNIQUE NULL,
        descripcion_ayuda VARCHAR(255) NULL,
        handler_key VARCHAR(50) NULL,
        es_inicio BIT DEFAULT 0,
        es_final BIT DEFAULT 0,
        requiere_firma BIT DEFAULT 0,
        requiere_comentario BIT DEFAULT 0,
        requiere_adjunto BIT DEFAULT 0,
        CONSTRAINT FK_workflow_pasos_workflow FOREIGN KEY (id_workflow) REFERENCES config.workflows(id_workflow)
    );
    PRINT 'Tabla [config].[workflow_pasos] creada';
END
GO

-- ---------------------------------------------------------------------------
-- config.workflow_participantes (FK -> workflow_pasos)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[workflow_participantes]'))
BEGIN
    CREATE TABLE config.workflow_participantes (
        id_participante INT IDENTITY(1,1) PRIMARY KEY,
        id_paso INT NOT NULL,
        id_rol INT NULL,
        id_usuario INT NULL,
        CONSTRAINT FK_workflow_participantes_paso FOREIGN KEY (id_paso) REFERENCES config.workflow_pasos(id_paso)
    );
    PRINT 'Tabla [config].[workflow_participantes] creada';
END
GO

-- ---------------------------------------------------------------------------
-- config.workflow_acciones (FK -> workflow_pasos)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[workflow_acciones]'))
BEGIN
    CREATE TABLE config.workflow_acciones (
        id_accion INT IDENTITY(1,1) PRIMARY KEY,
        id_paso_origen INT NOT NULL,
        id_paso_destino INT NULL,
        nombre_accion VARCHAR(50) NOT NULL,
        tipo_accion VARCHAR(20) NOT NULL,
        clase_estetica VARCHAR(20) DEFAULT 'primary',
        CONSTRAINT FK_workflow_acciones_origen FOREIGN KEY (id_paso_origen) REFERENCES config.workflow_pasos(id_paso),
        CONSTRAINT FK_workflow_acciones_destino FOREIGN KEY (id_paso_destino) REFERENCES config.workflow_pasos(id_paso)
    );
    PRINT 'Tabla [config].[workflow_acciones] creada';
END
GO

-- ---------------------------------------------------------------------------
-- config.workflow_condiciones (FK -> workflow_pasos)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[workflow_condiciones]'))
BEGIN
    CREATE TABLE config.workflow_condiciones (
        id_condicion INT IDENTITY(1,1) PRIMARY KEY,
        id_paso INT NOT NULL,
        campo_evaluacion VARCHAR(50) NOT NULL,
        operador VARCHAR(10) NOT NULL,
        valor_comparacion VARCHAR(100) NOT NULL,
        id_paso_si_cumple INT NOT NULL,
        CONSTRAINT FK_workflow_condiciones_paso FOREIGN KEY (id_paso) REFERENCES config.workflow_pasos(id_paso)
    );
    PRINT 'Tabla [config].[workflow_condiciones] creada';
END
GO

-- ---------------------------------------------------------------------------
-- config.workflow_notificaciones (FK -> workflow_acciones, workflow_pasos)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[workflow_notificaciones]'))
BEGIN
    CREATE TABLE config.workflow_notificaciones (
        id_notificacion INT IDENTITY(1,1) PRIMARY KEY,
        id_accion INT NOT NULL,
        id_paso_destino INT NULL,
        enviar_email BIT DEFAULT 1,
        enviar_whatsapp BIT DEFAULT 0,
        enviar_telegram BIT DEFAULT 0,
        avisar_al_creador BIT DEFAULT 0,
        avisar_al_siguiente BIT DEFAULT 1,
        avisar_al_anterior BIT DEFAULT 0,
        asunto_template VARCHAR(200) NULL,
        cuerpo_template VARCHAR(MAX) NOT NULL,
        CONSTRAINT FK_workflow_notificaciones_accion FOREIGN KEY (id_accion) REFERENCES config.workflow_acciones(id_accion),
        CONSTRAINT FK_workflow_notificaciones_paso_destino FOREIGN KEY (id_paso_destino) REFERENCES config.workflow_pasos(id_paso)
    );
    PRINT 'Tabla [config].[workflow_notificaciones] creada';
END
GO

-- ---------------------------------------------------------------------------
-- config.workflow_bitacora (FK -> workflows, workflow_pasos, workflow_acciones)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[workflow_bitacora]'))
BEGIN
    CREATE TABLE config.workflow_bitacora (
        id_evento INT IDENTITY(1,1) PRIMARY KEY,
        id_orden INT NOT NULL,
        id_workflow INT NOT NULL,
        id_paso INT NOT NULL,
        id_accion INT NOT NULL,
        id_usuario INT NOT NULL,
        comentario VARCHAR(500) NULL,
        datos_snapshot NVARCHAR(MAX) NULL,
        fecha_evento DATETIME DEFAULT GETDATE() NOT NULL,
        CONSTRAINT FK_bitacora_workflow FOREIGN KEY (id_workflow) REFERENCES config.workflows(id_workflow),
        CONSTRAINT FK_bitacora_paso FOREIGN KEY (id_paso) REFERENCES config.workflow_pasos(id_paso),
        CONSTRAINT FK_bitacora_accion FOREIGN KEY (id_accion) REFERENCES config.workflow_acciones(id_accion)
    );
    PRINT 'Tabla [config].[workflow_bitacora] creada';
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'CONFIG - Tablas creadas';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- SCHEMA: operaciones
-- ============================================================================

-- ---------------------------------------------------------------------------
-- operaciones.ordenes_compra
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]'))
BEGIN
    CREATE TABLE operaciones.ordenes_compra (
        id_orden INT IDENTITY(1,1) PRIMARY KEY,
        folio VARCHAR(50) UNIQUE NOT NULL,
        id_empresa INT NOT NULL,
        id_sucursal INT NOT NULL,
        id_area INT NOT NULL,
        id_tipo_gasto INT NOT NULL,
        id_forma_pago INT NOT NULL,
        id_usuario_creador INT NOT NULL,
        estado INT NOT NULL DEFAULT 1,
        id_paso_actual INT NULL,
        sin_datos_fiscales BIT NOT NULL DEFAULT 0,
        razon_social_proveedor VARCHAR(255) NOT NULL,
        rfc_proveedor VARCHAR(13) NULL,
        codigo_postal_proveedor VARCHAR(10) NULL,
        id_regimen_fiscal INT NULL,
        persona_contacto VARCHAR(150) NULL,
        nota_forma_pago VARCHAR(500) NULL,
        notas_generales VARCHAR(1000) NULL,
        id_centro_costo INT NULL,
        cuenta_contable VARCHAR(50) NULL,
        requiere_comprobacion_pago BIT NOT NULL DEFAULT 1,
        requiere_comprobacion_gasto BIT NOT NULL DEFAULT 1,
        fecha_solicitud DATE NOT NULL,
        fecha_limite_pago DATE NOT NULL,
        fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),
        fecha_modificacion DATETIME NULL,
        fecha_autorizacion DATETIME NULL,
        subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_iva DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_retenciones DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_otros_impuestos DECIMAL(18,2) NOT NULL DEFAULT 0,
        total DECIMAL(18,2) NOT NULL DEFAULT 0
    );
    PRINT 'Tabla [operaciones].[ordenes_compra] creada';
END
GO

-- ---------------------------------------------------------------------------
-- operaciones.ordenes_compra_partidas (FK -> ordenes_compra)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra_partidas]'))
BEGIN
    CREATE TABLE operaciones.ordenes_compra_partidas (
        id_partida INT IDENTITY(1,1) PRIMARY KEY,
        id_orden INT NOT NULL,
        numero_partida INT NOT NULL,
        descripcion VARCHAR(500) NOT NULL,
        cantidad DECIMAL(18,3) NOT NULL,
        id_unidad_medida INT NOT NULL,
        precio_unitario DECIMAL(18,2) NOT NULL,
        descuento DECIMAL(18,2) NOT NULL DEFAULT 0,
        porcentaje_iva DECIMAL(5,2) NOT NULL DEFAULT 16.00,
        total_retenciones DECIMAL(18,2) NOT NULL DEFAULT 0,
        otros_impuestos DECIMAL(18,2) NOT NULL DEFAULT 0,
        deducible BIT NOT NULL DEFAULT 1,
        total DECIMAL(18,2) NOT NULL,
        CONSTRAINT FK_ordenes_compra_partidas_orden FOREIGN KEY (id_orden) 
            REFERENCES operaciones.ordenes_compra(id_orden) ON DELETE CASCADE,
        CONSTRAINT UQ_orden_numero_partida UNIQUE (id_orden, numero_partida)
    );
    PRINT 'Tabla [operaciones].[ordenes_compra_partidas] creada';
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'OPERACIONES - Tablas creadas';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- SCHEMA: app (Notificaciones)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- app.Notifications
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notifications' AND schema_id = SCHEMA_ID('app'))
BEGIN
    CREATE TABLE [app].[Notifications] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [Title] NVARCHAR(255) NOT NULL,
        [Message] NVARCHAR(MAX) NOT NULL,
        [Type] NVARCHAR(50) NOT NULL DEFAULT 'info',
        [Priority] NVARCHAR(50) NOT NULL DEFAULT 'normal',
        [Category] NVARCHAR(100) NOT NULL DEFAULT 'system',
        [TemplateId] NVARCHAR(255) NULL,
        [TemplateData] NVARCHAR(MAX) NULL,
        [CreatedBy] NVARCHAR(256) NOT NULL DEFAULT 'system',
        [ScheduledFor] DATETIME2 NULL,
        [ExpiresAt] DATETIME2 NULL,
        [RetryCount] INT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Tabla [app].[Notifications] creada';
END
GO

-- ---------------------------------------------------------------------------
-- app.NotificationChannels (FK -> Notifications)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationChannels' AND schema_id = SCHEMA_ID('app'))
BEGIN
    CREATE TABLE [app].[NotificationChannels] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [NotificationId] INT NOT NULL,
        [ChannelType] NVARCHAR(50) NOT NULL,
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'pending',
        [Recipient] NVARCHAR(500) NOT NULL,
        [SentAt] DATETIME2 NULL,
        [ErrorMessage] NVARCHAR(MAX) NULL,
        [RetryCount] INT NOT NULL DEFAULT 0,
        [ExternalId] NVARCHAR(255) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_NotificationChannels_Notifications FOREIGN KEY ([NotificationId])
            REFERENCES [app].[Notifications]([Id]) ON DELETE CASCADE
    );
    PRINT 'Tabla [app].[NotificationChannels] creada';
END
GO

-- ---------------------------------------------------------------------------
-- app.UserNotifications (FK -> Notifications)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserNotifications' AND schema_id = SCHEMA_ID('app'))
BEGIN
    CREATE TABLE [app].[UserNotifications] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [NotificationId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [IsRead] BIT NOT NULL DEFAULT 0,
        [ReadAt] DATETIME2 NULL,
        [ReceivedVia] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_UserNotifications_Notifications FOREIGN KEY ([NotificationId])
            REFERENCES [app].[Notifications]([Id]) ON DELETE CASCADE
    );
    PRINT 'Tabla [app].[UserNotifications] creada';
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'APP - Tablas de notificaciones creadas';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- SCHEMA: help (Sistema de Ayuda)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- help.HelpModules
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HelpModules' AND schema_id = SCHEMA_ID('help'))
BEGIN
    CREATE TABLE [help].HelpModules (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [nombre] NVARCHAR(50) NOT NULL UNIQUE,
        [label] NVARCHAR(100) NOT NULL,
        [orden] INT NOT NULL DEFAULT 0,
        [activo] BIT NOT NULL DEFAULT 1,
        [fecha_creacion] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [fecha_actualizacion] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Tabla [help].[HelpModules] creada';
END
GO

-- ---------------------------------------------------------------------------
-- help.HelpArticles (FK -> HelpModules)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HelpArticles' AND schema_id = SCHEMA_ID('help'))
BEGIN
    CREATE TABLE [help].HelpArticles (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [titulo] NVARCHAR(200) NOT NULL,
        [contenido] NVARCHAR(MAX) NOT NULL,
        [resumen] NVARCHAR(500) NULL,
        [modulo_id] INT NULL,
        [modulo] NVARCHAR(50) NOT NULL DEFAULT '',
        [tipo] NVARCHAR(50) NOT NULL DEFAULT 'usuario',
        [categoria] NVARCHAR(100) NULL,
        [orden] INT NOT NULL DEFAULT 0,
        [activo] BIT NOT NULL DEFAULT 1,
        [fecha_creacion] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [fecha_actualizacion] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [creado_por] NVARCHAR(100) NULL,
        [actualizado_por] NVARCHAR(100) NULL,
        CONSTRAINT [FK_HelpArticles_HelpModules] FOREIGN KEY ([modulo_id])
            REFERENCES [help].HelpModules([id]) ON DELETE CASCADE
    );
    PRINT 'Tabla [help].[HelpArticles] creada';
END
GO

-- ---------------------------------------------------------------------------
-- help.HelpImages
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HelpImages' AND schema_id = SCHEMA_ID('help'))
BEGIN
    CREATE TABLE [help].HelpImages (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [nombre_original] NVARCHAR(255) NOT NULL,
        [nombre_archivo] NVARCHAR(255) NOT NULL,
        [ruta_relativa] NVARCHAR(500) NOT NULL,
        [tamano_bytes] BIGINT NOT NULL,
        [mime_type] NVARCHAR(100) NOT NULL,
        [ancho] INT NULL,
        [alto] INT NULL,
        [fecha_subida] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [subido_por] NVARCHAR(100) NULL
    );
    PRINT 'Tabla [help].[HelpImages] creada';
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'HELP - Tablas del sistema de ayuda creadas';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- SCHEMA: archivos
-- ============================================================================

-- ---------------------------------------------------------------------------
-- archivos.Archivos
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('archivos') AND name = 'Archivos')
BEGIN
    CREATE TABLE archivos.Archivos (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EntidadTipo NVARCHAR(100) NOT NULL,
        EntidadId INT NOT NULL,
        Carpeta NVARCHAR(500) NOT NULL,
        NombreOriginal NVARCHAR(255) NOT NULL,
        NombreFisico NVARCHAR(255) NOT NULL,
        Extension NVARCHAR(20) NOT NULL,
        TipoMime NVARCHAR(100) NOT NULL,
        TamanoBytes BIGINT NOT NULL,
        Metadata NVARCHAR(MAX) NULL,
        FechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
        FechaEdicion DATETIME2 NULL,
        UsuarioId INT NULL,
        Activo BIT NOT NULL DEFAULT 1
    );
    PRINT 'Tabla [archivos].[Archivos] creada';
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'ARCHIVOS - Tabla creada';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- INDICES
-- ============================================================================

-- Indices catalogos
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CuentasContables_Cuenta' AND object_id = OBJECT_ID('[catalogos].[cuentas_contables]'))
    CREATE NONCLUSTERED INDEX IX_CuentasContables_Cuenta ON catalogos.cuentas_contables(cuenta);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Proveedores_RazonSocial' AND object_id = OBJECT_ID('[catalogos].[proveedores]'))
    CREATE NONCLUSTERED INDEX IX_Proveedores_RazonSocial ON catalogos.proveedores(razon_social_normalizada);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Proveedores_RFC' AND object_id = OBJECT_ID('[catalogos].[proveedores]'))
    CREATE NONCLUSTERED INDEX IX_Proveedores_RFC ON catalogos.proveedores(rfc);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Proveedores_AutorizadoPorCxP' AND object_id = OBJECT_ID('[catalogos].[proveedores]'))
    CREATE NONCLUSTERED INDEX IX_Proveedores_AutorizadoPorCxP ON catalogos.proveedores(autorizado_por_cxp);

-- Indices config
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_usuario_detalle_empresa_sucursal' AND object_id = OBJECT_ID('[config].[usuario_detalle]'))
    CREATE INDEX IX_usuario_detalle_empresa_sucursal ON config.usuario_detalle (id_empresa, id_sucursal);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_workflow_pasos_workflow_orden' AND object_id = OBJECT_ID('[config].[workflow_pasos]'))
    CREATE INDEX IX_workflow_pasos_workflow_orden ON config.workflow_pasos (id_workflow, orden);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_workflow_acciones_origen' AND object_id = OBJECT_ID('[config].[workflow_acciones]'))
    CREATE INDEX IX_workflow_acciones_origen ON config.workflow_acciones (id_paso_origen);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_workflow_bitacora_orden' AND object_id = OBJECT_ID('[config].[workflow_bitacora]'))
    CREATE INDEX IX_workflow_bitacora_orden ON config.workflow_bitacora (id_orden);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_workflow_bitacora_fecha' AND object_id = OBJECT_ID('[config].[workflow_bitacora]'))
    CREATE INDEX IX_workflow_bitacora_fecha ON config.workflow_bitacora (fecha_evento);

-- Indices operaciones
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ordenes_compra_folio' AND object_id = OBJECT_ID('[operaciones].[ordenes_compra]'))
    CREATE INDEX IX_ordenes_compra_folio ON operaciones.ordenes_compra (folio);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ordenes_compra_estado' AND object_id = OBJECT_ID('[operaciones].[ordenes_compra]'))
    CREATE INDEX IX_ordenes_compra_estado ON operaciones.ordenes_compra (estado);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ordenes_compra_fecha_creacion' AND object_id = OBJECT_ID('[operaciones].[ordenes_compra]'))
    CREATE INDEX IX_ordenes_compra_fecha_creacion ON operaciones.ordenes_compra (fecha_creacion);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ordenes_compra_empresa' AND object_id = OBJECT_ID('[operaciones].[ordenes_compra]'))
    CREATE INDEX IX_ordenes_compra_empresa ON operaciones.ordenes_compra (id_empresa, id_sucursal);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ordenes_compra_usuario_creador' AND object_id = OBJECT_ID('[operaciones].[ordenes_compra]'))
    CREATE INDEX IX_ordenes_compra_usuario_creador ON operaciones.ordenes_compra (id_usuario_creador);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ordenes_compra_partidas_orden' AND object_id = OBJECT_ID('[operaciones].[ordenes_compra_partidas]'))
    CREATE INDEX IX_ordenes_compra_partidas_orden ON operaciones.ordenes_compra_partidas (id_orden);

-- Indices app
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Notifications_CreatedAt' AND object_id = OBJECT_ID('[app].[Notifications]'))
    CREATE INDEX IX_Notifications_CreatedAt ON [app].[Notifications]([CreatedAt]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Notifications_ExpiresAt' AND object_id = OBJECT_ID('[app].[Notifications]'))
    CREATE INDEX IX_Notifications_ExpiresAt ON [app].[Notifications]([ExpiresAt]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Notifications_ScheduledFor' AND object_id = OBJECT_ID('[app].[Notifications]'))
    CREATE INDEX IX_Notifications_ScheduledFor ON [app].[Notifications]([ScheduledFor]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NotificationChannels_NotificationId' AND object_id = OBJECT_ID('[app].[NotificationChannels]'))
    CREATE INDEX IX_NotificationChannels_NotificationId ON [app].[NotificationChannels]([NotificationId]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NotificationChannels_ChannelType' AND object_id = OBJECT_ID('[app].[NotificationChannels]'))
    CREATE INDEX IX_NotificationChannels_ChannelType ON [app].[NotificationChannels]([ChannelType]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NotificationChannels_Status' AND object_id = OBJECT_ID('[app].[NotificationChannels]'))
    CREATE INDEX IX_NotificationChannels_Status ON [app].[NotificationChannels]([Status]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NotificationChannels_SentAt' AND object_id = OBJECT_ID('[app].[NotificationChannels]'))
    CREATE INDEX IX_NotificationChannels_SentAt ON [app].[NotificationChannels]([SentAt]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserNotifications_UserId' AND object_id = OBJECT_ID('[app].[UserNotifications]'))
    CREATE INDEX IX_UserNotifications_UserId ON [app].[UserNotifications]([UserId]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserNotifications_NotificationId' AND object_id = OBJECT_ID('[app].[UserNotifications]'))
    CREATE INDEX IX_UserNotifications_NotificationId ON [app].[UserNotifications]([NotificationId]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserNotifications_IsRead' AND object_id = OBJECT_ID('[app].[UserNotifications]'))
    CREATE INDEX IX_UserNotifications_IsRead ON [app].[UserNotifications]([IsRead]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserNotifications_UserId_NotificationId' AND object_id = OBJECT_ID('[app].[UserNotifications]'))
    CREATE INDEX IX_UserNotifications_UserId_NotificationId ON [app].[UserNotifications]([UserId], [NotificationId]);

-- Indices help
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_HelpModules_orden_activo' AND object_id = OBJECT_ID('[help].[HelpModules]'))
    CREATE NONCLUSTERED INDEX [IX_HelpModules_orden_activo] ON [help].HelpModules([orden], [activo]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_HelpArticles_modulo_activo' AND object_id = OBJECT_ID('[help].[HelpArticles]'))
    CREATE NONCLUSTERED INDEX [IX_HelpArticles_modulo_activo] ON [help].HelpArticles([modulo], [activo]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_HelpArticles_modulo_id_activo' AND object_id = OBJECT_ID('[help].[HelpArticles]'))
    CREATE NONCLUSTERED INDEX [IX_HelpArticles_modulo_id_activo] ON [help].HelpArticles([modulo_id], [activo]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_HelpArticles_tipo_activo' AND object_id = OBJECT_ID('[help].[HelpArticles]'))
    CREATE NONCLUSTERED INDEX [IX_HelpArticles_tipo_activo] ON [help].HelpArticles([tipo], [activo]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_HelpArticles_categoria_activo' AND object_id = OBJECT_ID('[help].[HelpArticles]'))
    CREATE NONCLUSTERED INDEX [IX_HelpArticles_categoria_activo] ON [help].HelpArticles([categoria], [activo]) WHERE [categoria] IS NOT NULL;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_HelpImages_nombre_archivo' AND object_id = OBJECT_ID('[help].[HelpImages]'))
    CREATE NONCLUSTERED INDEX [IX_HelpImages_nombre_archivo] ON [help].HelpImages([nombre_archivo]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_HelpImages_fecha_subida' AND object_id = OBJECT_ID('[help].[HelpImages]'))
    CREATE NONCLUSTERED INDEX [IX_HelpImages_fecha_subida] ON [help].HelpImages([fecha_subida] DESC);

-- Indices archivos
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Archivos_Entidad' AND object_id = OBJECT_ID('archivos.Archivos'))
    CREATE INDEX IX_Archivos_Entidad ON archivos.Archivos (EntidadTipo, EntidadId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Archivos_Carpeta' AND object_id = OBJECT_ID('archivos.Archivos'))
    CREATE INDEX IX_Archivos_Carpeta ON archivos.Archivos (Carpeta);

PRINT '';
PRINT '============================================================';
PRINT 'INDICES CREADOS';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- RESUMEN FINAL
-- ============================================================================
PRINT '';
PRINT '================================================================';
PRINT 'SCRIPT COMPLETADO EXITOSAMENTE';
PRINT '================================================================';
PRINT '';
PRINT 'TABLAS CREADAS POR SCHEMA:';
PRINT '';
PRINT 'catalogos (16 tablas):';
PRINT '  - empresas, sucursales, areas, tipos_gasto, tipos_medida';
PRINT '  - unidades_medida, bancos, formas_pago, gastos, medidas';
PRINT '  - medios_pago, centros_costo, cuentas_contables, estatus_orden';
PRINT '  - regimenes_fiscales, proveedores';
PRINT '';
PRINT 'config (8 tablas):';
PRINT '  - usuario_detalle, workflows, workflow_pasos, workflow_participantes';
PRINT '  - workflow_acciones, workflow_condiciones, workflow_notificaciones';
PRINT '  - workflow_bitacora';
PRINT '';
PRINT 'operaciones (2 tablas):';
PRINT '  - ordenes_compra, ordenes_compra_partidas';
PRINT '';
PRINT 'app (3 tablas):';
PRINT '  - Notifications, NotificationChannels, UserNotifications';
PRINT '';
PRINT 'help (3 tablas):';
PRINT '  - HelpModules, HelpArticles, HelpImages';
PRINT '';
PRINT 'archivos (1 tabla):';
PRINT '  - Archivos';
PRINT '';
PRINT 'TOTAL: 33 tablas creadas';
PRINT '================================================================';
GO
