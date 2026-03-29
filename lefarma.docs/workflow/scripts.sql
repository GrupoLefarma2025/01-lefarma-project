-- =============================================================================
-- ESQUEMA: config
-- DESCRIPCIÓN: Configuración de usuarios, notificaciones y motor de flujos.
-- =============================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'config')
BEGIN
    EXEC('CREATE SCHEMA config');
END
GO

-- 1. INFORMACIÓN EXTENDIDA Y PREFERENCIAS DEL USUARIO
-- Nota: id_usuario es una relación lógica con la tabla de la otra BD.
CREATE TABLE config.usuario_detalle (
    id_usuario INT PRIMARY KEY, -- ID que viene de la otra BD (Seguridad)
    id_empresa INT NOT NULL,
    id_sucursal INT NOT NULL,
    id_area INT NULL,
    id_centro_costo INT NULL,
    
    -- Perfil Profesional
    puesto VARCHAR(150) NULL,      -- Ej: "Gerente de Finanzas" (Firma 4)
    numero_empleado VARCHAR(50) NULL,
    firma_digital VARCHAR(MAX) NULL, -- Base64 de la firma manuscrita
    avatar_url VARCHAR(255) NULL,

    -- Contacto y Canales Externos
    celular VARCHAR(20) NULL,      -- Usado para SMS y WhatsApp
    id_telegram_chat VARCHAR(100) NULL,
    id_whatsapp_externo VARCHAR(100) NULL,
    
    -- Configuración de Notificaciones (Sección 15 de Specs)
    canal_preferido VARCHAR(20) DEFAULT 'email', -- 'email', 'whatsapp', 'telegram', 'sms'
    notificar_email BIT DEFAULT 1,
    notificar_app BIT DEFAULT 1,      -- Campana de notificaciones en la UI
    notificar_whatsapp BIT DEFAULT 0, 
    notificar_telegram BIT DEFAULT 0,
    notificar_sms BIT DEFAULT 0,
    
    -- Filtros de Alerta (Sección 16 de Specs)
    notificar_solo_urgentes BIT DEFAULT 0,  -- Alertas críticas de firmas
    notificar_resumen_diario BIT DEFAULT 1, -- Resumen de las 8:00 AM (Sección 15.1)
    notificar_rechazos BIT DEFAULT 1,        -- Avisar de inmediato si una OC es rechazada
    notificar_vencimientos BIT DEFAULT 1,    -- Alertas preventivas antes del bloqueo (Sección 16.1)

    -- Continuidad Operativa (Delegación de firmas)
    id_usuario_delegado INT NULL, -- Usuario que firma por mí en mi ausencia
    delegacion_hasta DATE NULL,   -- Fecha límite de la delegación
    
    -- Preferencias de UI
    tema_interfaz VARCHAR(20) DEFAULT 'light',
    dashboard_inicio VARCHAR(50) NULL, -- 'capturista', 'autorizador', 'tesoreria', 'cxp'
    elementos_por_pagina INT DEFAULT 10,
    
    fecha_actualizacion DATETIME DEFAULT GETDATE()
);

-- 2. CABECERA DE WORKFLOWS
CREATE TABLE config.workflows (
    id_workflow INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    codigo_proceso VARCHAR(50) UNIQUE NOT NULL, -- Ej: 'ORDEN_COMPRA', 'SOLICITUD_VIATICOS'
    version INT DEFAULT 1,
    activo BIT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT GETDATE()
);

-- 3. PASOS DEL FLUJO (Las 5 Firmas y Estados)
CREATE TABLE config.workflow_pasos (
    id_paso INT IDENTITY(1,1) PRIMARY KEY,
    id_workflow INT NOT NULL,
    orden INT NOT NULL, -- 10, 20, 30...
    nombre_paso VARCHAR(100) NOT NULL,
    codigo_estado VARCHAR(50) UNIQUE NULL, -- Mapea al enum del dominio: 'EN_REVISION_F2', 'AUTORIZADA', etc.
    descripcion_ayuda VARCHAR(255) NULL,   -- Texto guía para el usuario en el UI
    handler_key VARCHAR(50) NULL,          -- Step-handler específico: 'Firma3Handler', 'Firma4Handler'

    -- Reglas de Validación en el paso
    es_inicio BIT DEFAULT 0,
    es_final BIT DEFAULT 0,
    requiere_firma BIT DEFAULT 0,
    requiere_comentario BIT DEFAULT 0,
    requiere_adjunto BIT DEFAULT 0,
    activo BIT DEFAULT 1,
    CONSTRAINT FK_workflow_pasos_workflow FOREIGN KEY (id_workflow) REFERENCES config.workflows(id_workflow)
);

-- 4. PARTICIPANTES (Quién tiene permiso de actuar en cada paso)
CREATE TABLE config.workflow_participantes (
    id_participante INT IDENTITY(1,1) PRIMARY KEY,
    id_paso INT NOT NULL,
    id_rol INT NULL,      -- ID de Rol de la otra BD
    id_usuario INT NULL,  -- ID de Usuario específico de la otra BD
    activo BIT DEFAULT 1,
    CONSTRAINT FK_workflow_participantes_paso FOREIGN KEY (id_paso) REFERENCES config.workflow_pasos(id_paso)
);

-- 5. ACCIONES (Las transiciones entre pasos)
CREATE TABLE config.workflow_acciones (
    id_accion INT IDENTITY(1,1) PRIMARY KEY,
    id_paso_origen INT NOT NULL,
    id_paso_destino INT NULL, -- NULL si la acción finaliza/cancela el flujo
    nombre_accion VARCHAR(50) NOT NULL, -- 'Autorizar', 'Rechazar', 'Corregir'
    tipo_accion VARCHAR(20) NOT NULL, -- 'APROBACION', 'RECHAZO', 'RETORNO', 'CANCELACION'
    clase_estetica VARCHAR(20) DEFAULT 'primary', -- Estilo del botón (success, danger, warning)
    activo BIT DEFAULT 1,
    CONSTRAINT FK_workflow_acciones_origen FOREIGN KEY (id_paso_origen) REFERENCES config.workflow_pasos(id_paso),
    CONSTRAINT FK_workflow_acciones_destino FOREIGN KEY (id_paso_destino) REFERENCES config.workflow_pasos(id_paso)
);

-- 6. NOTIFICACIONES CONFIGURABLES POR ACCIÓN (opcionalmente por paso destino)
CREATE TABLE config.workflow_notificaciones (
    id_notificacion INT IDENTITY(1,1) PRIMARY KEY,
    id_accion INT NOT NULL,
    id_paso_destino INT NULL, -- Permite diferenciar templates según el destino real (ramas por condición)
    
    -- Canales activos para esta notificación
    enviar_email BIT DEFAULT 1,
    enviar_whatsapp BIT DEFAULT 0,
    enviar_telegram BIT DEFAULT 0,
    
    -- Lógica de destinatarios
    avisar_al_creador BIT DEFAULT 0,
    avisar_al_siguiente BIT DEFAULT 1, -- Avisar al que le toca firmar ahora
    avisar_al_anterior BIT DEFAULT 0,  -- Avisar al que ya firmó (confirmación)
    activo BIT DEFAULT 1,
    
    -- Contenido (Templates)
    asunto_template VARCHAR(200) NULL,
    cuerpo_template VARCHAR(MAX) NOT NULL, -- Puede contener tags: {{Folio}}, {{Solicitante}}, {{Monto}}
    
    CONSTRAINT FK_workflow_notificaciones_accion FOREIGN KEY (id_accion) REFERENCES config.workflow_acciones(id_accion),
    CONSTRAINT FK_workflow_notificaciones_paso_destino FOREIGN KEY (id_paso_destino) REFERENCES config.workflow_pasos(id_paso)
);

-- 7. REGLAS Y CONDICIONES (Para saltos dinámicos, ej: Si monto > 50k ir a paso X)
CREATE TABLE config.workflow_condiciones (
    id_condicion INT IDENTITY(1,1) PRIMARY KEY,
    id_paso INT NOT NULL,
    campo_evaluacion VARCHAR(50) NOT NULL, -- Ej: 'Total', 'TipoGasto', 'Empresa'
    operador VARCHAR(10) NOT NULL,        -- '>', '<', '=', 'IN'
    valor_comparacion VARCHAR(100) NOT NULL,
    id_paso_si_cumple INT NOT NULL,
    activo BIT DEFAULT 1,
    CONSTRAINT FK_workflow_condiciones_paso FOREIGN KEY (id_paso) REFERENCES config.workflow_pasos(id_paso)
);

-- 8. BITÁCORA INMUTABLE DE EVENTOS (Auditoría de cambios de estado)
-- Cumple requisito no-funcional: "Cada cambio de estado debe registrarse en una bitácora inmutable"
CREATE TABLE config.workflow_bitacora (
    id_evento       INT IDENTITY(1,1) PRIMARY KEY,
    id_orden        INT NOT NULL,               -- ID de la Orden de Compra (esquema operaciones)
    id_workflow     INT NOT NULL,
    id_paso         INT NOT NULL,               -- Paso en el que ocurrió la acción
    id_accion       INT NOT NULL,               -- Acción ejecutada (Autorizar, Rechazar, etc.)
    id_usuario      INT NOT NULL,               -- Usuario que ejecutó la acción (otra BD)
    comentario      VARCHAR(500) NULL,          -- Justificación capturada en el paso
    datos_snapshot  NVARCHAR(MAX) NULL,         -- JSON snapshot del estado de la orden en ese momento
    fecha_evento    DATETIME DEFAULT GETDATE() NOT NULL,

    CONSTRAINT FK_bitacora_workflow FOREIGN KEY (id_workflow) REFERENCES config.workflows(id_workflow),
    CONSTRAINT FK_bitacora_paso    FOREIGN KEY (id_paso)     REFERENCES config.workflow_pasos(id_paso),
    CONSTRAINT FK_bitacora_accion  FOREIGN KEY (id_accion)   REFERENCES config.workflow_acciones(id_accion)
    -- Nota: id_orden e id_usuario son relaciones lógicas con el esquema operaciones y BD de seguridad
);

-- ÍNDICES PARA RENDIMIENTO
CREATE INDEX IX_usuario_detalle_empresa_sucursal ON config.usuario_detalle (id_empresa, id_sucursal);
CREATE INDEX IX_workflow_pasos_workflow_orden ON config.workflow_pasos (id_workflow, orden);
CREATE INDEX IX_workflow_acciones_origen ON config.workflow_acciones (id_paso_origen);
CREATE INDEX IX_workflow_bitacora_orden ON config.workflow_bitacora (id_orden);
CREATE INDEX IX_workflow_bitacora_fecha ON config.workflow_bitacora (fecha_evento);

-- =============================================================================
-- ESQUEMA: operaciones
-- DESCRIPCIÓN: Módulo de órdenes de compra y procesos operativos.
-- =============================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'operaciones')
BEGIN
    EXEC('CREATE SCHEMA operaciones');
END
GO

-- 1. ÓRDENES DE COMPRA (Cabecera)
CREATE TABLE operaciones.ordenes_compra (
    id_orden INT IDENTITY(1,1) PRIMARY KEY,
    folio VARCHAR(50) UNIQUE NOT NULL, -- OC-2026-00001
    
    -- Relaciones con catálogos
    id_empresa INT NOT NULL,
    id_sucursal INT NOT NULL,
    id_area INT NOT NULL,
    id_tipo_gasto INT NOT NULL,
    id_forma_pago INT NOT NULL,
    id_usuario_creador INT NOT NULL, -- Usuario que captura la orden
    
    -- Estado y workflow
    estado INT NOT NULL DEFAULT 1, -- Mapea al enum EstadoOC (1=Creada, 2=EnRevisionF2, etc.)
    id_paso_actual INT NULL, -- FK lógica a config.workflow_pasos
    
    -- Datos del proveedor
    sin_datos_fiscales BIT NOT NULL DEFAULT 0,
    razon_social_proveedor VARCHAR(255) NOT NULL,
    rfc_proveedor VARCHAR(13) NULL,
    codigo_postal_proveedor VARCHAR(10) NULL,
    id_regimen_fiscal INT NULL,
    persona_contacto VARCHAR(150) NULL,
    nota_forma_pago VARCHAR(500) NULL,
    notas_generales VARCHAR(1000) NULL,
    
    -- Campos asignados en Firma 3 (CxP - Polo)
    id_centro_costo INT NULL,
    cuenta_contable VARCHAR(50) NULL,
    
    -- Campos configurados en Firma 4 (GAF - Diego)
    requiere_comprobacion_pago BIT NOT NULL DEFAULT 1,
    requiere_comprobacion_gasto BIT NOT NULL DEFAULT 1,
    
    -- Fechas
    fecha_solicitud DATE NOT NULL,
    fecha_limite_pago DATE NOT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),
    fecha_modificacion DATETIME NULL,
    fecha_autorizacion DATETIME NULL,
    
    -- Totales calculados
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_iva DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_retenciones DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_otros_impuestos DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0
);

-- 2. PARTIDAS DE ÓRDENES DE COMPRA
CREATE TABLE operaciones.ordenes_compra_partidas (
    id_partida INT IDENTITY(1,1) PRIMARY KEY,
    id_orden INT NOT NULL,
    numero_partida INT NOT NULL, -- Secuencia dentro de la orden: 1, 2, 3...
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

-- ÍNDICES PARA RENDIMIENTO
CREATE INDEX IX_ordenes_compra_folio ON operaciones.ordenes_compra (folio);
CREATE INDEX IX_ordenes_compra_estado ON operaciones.ordenes_compra (estado);
CREATE INDEX IX_ordenes_compra_fecha_creacion ON operaciones.ordenes_compra (fecha_creacion);
CREATE INDEX IX_ordenes_compra_empresa ON operaciones.ordenes_compra (id_empresa, id_sucursal);
CREATE INDEX IX_ordenes_compra_usuario_creador ON operaciones.ordenes_compra (id_usuario_creador);
CREATE INDEX IX_ordenes_compra_partidas_orden ON operaciones.ordenes_compra_partidas (id_orden);