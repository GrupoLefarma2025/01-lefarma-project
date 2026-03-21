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
    descripcion_ayuda VARCHAR(255) NULL, -- Texto guía para el usuario en el UI
    
    -- Reglas de Validación en el paso
    es_inicio BIT DEFAULT 0,
    es_final BIT DEFAULT 0,
    requiere_firma BIT DEFAULT 0,
    requiere_comentario BIT DEFAULT 0,
    requiere_adjunto BIT DEFAULT 0,
    
    CONSTRAINT FK_workflow_pasos_workflow FOREIGN KEY (id_workflow) REFERENCES config.workflows(id_workflow)
);

-- 4. PARTICIPANTES (Quién tiene permiso de actuar en cada paso)
CREATE TABLE config.workflow_participantes (
    id_participante INT IDENTITY(1,1) PRIMARY KEY,
    id_paso INT NOT NULL,
    id_rol INT NULL,      -- ID de Rol de la otra BD
    id_usuario INT NULL,  -- ID de Usuario específico de la otra BD
    
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
    
    CONSTRAINT FK_workflow_acciones_origen FOREIGN KEY (id_paso_origen) REFERENCES config.workflow_pasos(id_paso),
    CONSTRAINT FK_workflow_acciones_destino FOREIGN KEY (id_paso_destino) REFERENCES config.workflow_pasos(id_paso)
);

-- 6. NOTIFICACIONES CONFIGURABLES POR ACCIÓN
CREATE TABLE config.workflow_notificaciones (
    id_notificacion INT IDENTITY(1,1) PRIMARY KEY,
    id_accion INT NOT NULL,
    
    -- Canales activos para esta notificación
    enviar_email BIT DEFAULT 1,
    enviar_whatsapp BIT DEFAULT 0,
    enviar_telegram BIT DEFAULT 0,
    
    -- Lógica de destinatarios
    avisar_al_creador BIT DEFAULT 0,
    avisar_al_siguiente BIT DEFAULT 1, -- Avisar al que le toca firmar ahora
    avisar_al_anterior BIT DEFAULT 0,  -- Avisar al que ya firmó (confirmación)
    
    -- Contenido (Templates)
    asunto_template VARCHAR(200) NULL,
    cuerpo_template VARCHAR(MAX) NOT NULL, -- Puede contener tags: {{Folio}}, {{Solicitante}}, {{Monto}}
    
    CONSTRAINT FK_workflow_notificaciones_accion FOREIGN KEY (id_accion) REFERENCES config.workflow_acciones(id_accion)
);

-- 7. REGLAS Y CONDICIONES (Para saltos dinámicos, ej: Si monto > 50k ir a paso X)
CREATE TABLE config.workflow_condiciones (
    id_condicion INT IDENTITY(1,1) PRIMARY KEY,
    id_paso INT NOT NULL,
    campo_evaluacion VARCHAR(50) NOT NULL, -- Ej: 'Total', 'TipoGasto', 'Empresa'
    operador VARCHAR(10) NOT NULL,        -- '>', '<', '=', 'IN'
    valor_comparacion VARCHAR(100) NOT NULL,
    id_paso_si_cumple INT NOT NULL,
    
    CONSTRAINT FK_workflow_condiciones_paso FOREIGN KEY (id_paso) REFERENCES config.workflow_pasos(id_paso)
);

-- ÍNDICES PARA RENDIMIENTO
CREATE INDEX IX_usuario_detalle_empresa_sucursal ON config.usuario_detalle (id_empresa, id_sucursal);
CREATE INDEX IX_workflow_pasos_workflow_orden ON config.workflow_pasos (id_workflow, orden);
CREATE INDEX IX_workflow_acciones_origen ON config.workflow_acciones (id_paso_origen);
