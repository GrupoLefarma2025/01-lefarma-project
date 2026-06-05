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

-- 2.1  Tabla de Tipos de Scope (Jerarquía)
CREATE TABLE Lefarma.config.workflow_scope_types (
	id_scope_type int IDENTITY(1,1) NOT NULL,
	codigo varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
	nombre varchar(100) COLLATE Modern_Spanish_CI_AS NOT NULL,
	nivel_prioridad int NOT NULL,
	descripcion varchar(255) COLLATE Modern_Spanish_CI_AS NULL,
	activo bit DEFAULT 1 NOT NULL,
	fecha_creacion datetime DEFAULT getdate() NOT NULL,
	CONSTRAINT PK__workflow__E022807453270961 PRIMARY KEY (id_scope_type),
	CONSTRAINT UQ__workflow__40F9A2065EEFEDC6 UNIQUE (codigo)
);

-- 2.2 Tabla de Mapeos (La matriz de decisiones)
CREATE TABLE Lefarma.config.workflow_mappings (
	id_mapping int IDENTITY(1,1) NOT NULL,
	codigo_proceso varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
	id_scope_type int NOT NULL,
	scope_id int NULL,
	id_workflow int NOT NULL,
	prioridad_manual int DEFAULT 100 NOT NULL,
	activo bit DEFAULT 1 NOT NULL,
	observaciones varchar(255) COLLATE Modern_Spanish_CI_AS NULL,
	fecha_creacion datetime DEFAULT getdate() NOT NULL,
	creado_por int NULL,
	fecha_actualizacion datetime NULL,
	CONSTRAINT PK__workflow__695465FA42C8DA7F PRIMARY KEY (id_mapping),
	CONSTRAINT FK_workflow_mappings_scope_type FOREIGN KEY (id_scope_type) REFERENCES Lefarma.config.workflow_scope_types(id_scope_type),
	CONSTRAINT FK_workflow_mappings_workflows FOREIGN KEY (id_workflow) REFERENCES Lefarma.config.workflows(id_workflow)
);

-- 2.3 Tabla de estados del workflow
CREATE TABLE Lefarma.config.workflow_estados (
	id_estado int NOT NULL,
	codigo varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
	nombre varchar(100) COLLATE Modern_Spanish_CI_AS NOT NULL,
	color_hex varchar(10) COLLATE Modern_Spanish_CI_AS NULL,
	activo bit DEFAULT 1 NULL,
	CONSTRAINT PK__workflow__86989FB295017A50 PRIMARY KEY (id_estado),
	CONSTRAINT UQ__workflow__40F9A206AB286E33 UNIQUE (codigo)
);

-- 3. PASOS DEL FLUJO (Las 5 Firmas y Estados)
CREATE TABLE config.workflow_pasos (
    id_paso INT IDENTITY(1,1) PRIMARY KEY,
    id_workflow INT NOT NULL,
    orden INT NOT NULL, -- 10, 20, 30...
    nombre_paso VARCHAR(100) NOT NULL,
    id_estado VARCHAR(50) UNIQUE NULL, -- Mapea al enum del dominio: 'EN_REVISION_F2', 'AUTORIZADA', etc.
    descripcion_ayuda VARCHAR(255) NULL,   -- Texto guía para el usuario en el UI

    -- Reglas de Validación en el paso
    es_inicio BIT DEFAULT 0,
    es_final BIT DEFAULT 0,
    requiere_firma BIT DEFAULT 0,
    requiere_comentario BIT DEFAULT 0,
    requiere_adjunto BIT DEFAULT 0,     -- 1 = adjunto OBLIGATORIO para ejecutar cualquier acción del paso
    permite_adjunto BIT DEFAULT 1,      -- 0 = oculta el uploader libre en el modal de firma (pasos finales/informativos)
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

-- 6. TIPOS DE NOTIFICACIÓN (catálogo editable de tipos con colores e iconos)
-- Define las categorías visuales de notificaciones. ColorTema/ColorClaro son inyectados
-- como {{ColorTema}} y {{ColorClaro}} en el layout HTML del canal para personalizar el color del header.
CREATE TABLE config.workflow_tipo_notificacion (
    id_tipo       INT IDENTITY(1,1) PRIMARY KEY,
    codigo        VARCHAR(30) NOT NULL,      -- 'aprobacion' | 'rechazo' | 'pendiente' | 'pago' | 'devolucion' | 'info'
    nombre        VARCHAR(100) NOT NULL,
    color_tema    VARCHAR(7) NOT NULL,        -- color principal (hex) ej: '#16a34a'
    color_claro   VARCHAR(7) NOT NULL,        -- color claro de fondo (hex) ej: '#dcfce7'
    icono         VARCHAR(10) NOT NULL,       -- emoji corto ej: '✅'
    activo        BIT NOT NULL DEFAULT 1,
    CONSTRAINT UX_workflow_tipo_notificacion_codigo UNIQUE (codigo)
);

-- 7. NOTIFICACIONES CONFIGURABLES POR ACCIÓN (opcionalmente por paso destino)
CREATE TABLE config.workflow_notificaciones (
    id_notificacion INT IDENTITY(1,1) PRIMARY KEY,
    id_accion INT NOT NULL,
    id_paso_destino INT NULL,         -- Permite diferenciar templates según el destino real (ramas por condición)
    id_tipo_notificacion INT NULL,    -- FK a workflow_tipo_notificacion; NULL usa defaults de color
    
    -- Canales activos para esta notificación
    enviar_email BIT DEFAULT 1,
    enviar_whatsapp BIT DEFAULT 0,
    enviar_telegram BIT DEFAULT 0,
    
    -- Lógica de destinatarios
    avisar_al_creador BIT DEFAULT 0,
    avisar_al_siguiente BIT DEFAULT 1, -- Avisar al que le toca firmar ahora
    avisar_al_anterior BIT DEFAULT 0,  -- Avisar al que ya firmó (confirmación)
    avisar_a_autorizadores_previos BIT NOT NULL DEFAULT 0, -- Avisar a todos los que aprobaron pasos anteriores
    activo BIT DEFAULT 1,
    
    -- Opciones de contenido
    incluir_partidas BIT NOT NULL DEFAULT 0, -- Si es 1, genera {{Partidas}} con tabla HTML de partidas
    -- Nota: asunto_template y cuerpo_template viven en workflow_notificacion_canal (por canal)
    
    CONSTRAINT FK_workflow_notificaciones_accion FOREIGN KEY (id_accion) REFERENCES config.workflow_acciones(id_accion),
    CONSTRAINT FK_workflow_notificaciones_paso_destino FOREIGN KEY (id_paso_destino) REFERENCES config.workflow_pasos(id_paso),
    CONSTRAINT FK_workflow_notificaciones_tipo FOREIGN KEY (id_tipo_notificacion) REFERENCES config.workflow_tipo_notificacion(id_tipo)
);

-- 7. PLANTILLAS DE CANAL POR WORKFLOW (layout HTML editable por canal)
-- Almacena el "wrapper" completo que envuelve el cuerpo_template de cada notificación.
-- {{Contenido}} es reemplazado por el cuerpo interpolado; el resto de vars sigue disponible.
CREATE TABLE config.workflow_canal_templates (
    id_template INT IDENTITY(1,1) PRIMARY KEY,
    codigo_canal VARCHAR(50) NOT NULL,  -- 'email' | 'in_app' | 'whatsapp' | 'telegram'
    nombre VARCHAR(100) NOT NULL,
    layout_html NVARCHAR(MAX) NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    fecha_modificacion DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UX_workflow_canal_templates_canal UNIQUE (codigo_canal)
);

-- 8. CAMPOS CONFIGURABLES POR WORKFLOW (metadatos para UI dinámica)
-- Actúa como "diccionario" de campos que el workflow puede solicitar/validar.
-- propiedad_entidad: nombre exacto de la propiedad C# en OrdenCompra (para reflexión en FieldUpdater).
-- validar_fiscal:    solo relevante para tipo_control='Archivo'; si 1, se verificará con webservice CFDI.
CREATE TABLE config.workflow_campos (
    id_workflow_campo INT IDENTITY(1,1) PRIMARY KEY,
    id_workflow INT NOT NULL,
    nombre_tecnico VARCHAR(100) NOT NULL,    -- Ej: 'id_centro_costo'
    etiqueta_usuario VARCHAR(120) NOT NULL,  -- Ej: 'Centro de costo'
    tipo_control VARCHAR(30) NOT NULL,       -- Texto | Selector | Checkbox | Archivo | Numero | Fecha
    source_catalog VARCHAR(120) NULL,        -- Ej: 'catalogos/CentrosCosto' (solo para Selector)
    propiedad_entidad NVARCHAR(100) NULL,    -- Nombre C# en OrdenCompra, ej: 'IdCentroCosto' (NULL para Archivo)
    validar_fiscal BIT NOT NULL DEFAULT 0,  -- 1 = validar con webservice CFDI al recibir (solo Archivo)
    activo BIT DEFAULT 1,
    CONSTRAINT FK_workflow_campos_workflow FOREIGN KEY (id_workflow) REFERENCES config.workflows(id_workflow),
    CONSTRAINT UX_workflow_campos_workflow_nombre UNIQUE (id_workflow, nombre_tecnico)
);

-- 9. HANDLERS DINÁMICOS POR ACCIÓN (Funciones de negocio configurables)
-- Dos tipos únicos: RequiredFields (valida presencia) y FieldUpdater (escribe en entidad).
-- id_workflow_campo: enlaza directamente al campo del diccionario (reemplaza configuracion_json para campo).
CREATE TABLE config.workflow_accion_handlers (
    id_handler INT IDENTITY(1,1) PRIMARY KEY,
    id_accion INT NOT NULL,
    handler_key VARCHAR(100) NOT NULL,       -- 'Field' | 'Document'
    requerido BIT NOT NULL DEFAULT 1,        -- 1=obligatorio, 0=opcional
    configuracion_json NVARCHAR(MAX) NULL,   -- Reservado para parámetros adicionales futuros
    orden_ejecucion INT NOT NULL DEFAULT 1,  -- Secuencia de ejecución
    activo BIT DEFAULT 1,
    id_workflow_campo INT NULL,              -- FK al campo vinculado (diccionario)
    CONSTRAINT FK_workflow_accion_handlers_accion FOREIGN KEY (id_accion) REFERENCES config.workflow_acciones(id_accion),
    CONSTRAINT FK_handler_workflow_campo FOREIGN KEY (id_workflow_campo) REFERENCES config.workflow_campos(id_workflow_campo) ON DELETE SET NULL
);

-- 9. REGLAS Y CONDICIONES (Para saltos dinámicos, ej: Si monto > 50k ir a paso X)
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

-- 10. BITÁCORA INMUTABLE DE EVENTOS (Auditoría de cambios de estado)
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
CREATE INDEX IX_workflow_accion_handlers_accion_orden_activo ON config.workflow_accion_handlers (id_accion, orden_ejecucion, activo);
CREATE INDEX IX_workflow_bitacora_orden ON config.workflow_bitacora (id_orden);
CREATE INDEX IX_workflow_bitacora_fecha ON config.workflow_bitacora (fecha_evento);

-- 11. RECORDATORIOS AUTOMÁTICOS POR PASO
-- Configura reglas de envío periódico para recordar a los usuarios sobre órdenes pendientes.
-- El BackgroundService evalúa estos recordatorios cada hora y envía resúmenes agrupados por usuario.
CREATE TABLE config.workflow_recordatorio (
    id_recordatorio     INT IDENTITY(1,1) PRIMARY KEY,
    id_workflow         INT NOT NULL,
    id_paso             INT NULL,          -- NULL = aplica a todos los pasos con participantes activos
    nombre              VARCHAR(100) NOT NULL,
    activo              BIT NOT NULL DEFAULT 1,

    -- Trigger de tiempo
    -- 'horario': se envía diariamente a hora_envio en los dias_semana indicados
    -- 'recurrente': se envía cada intervalo_horas horas desde el último envío
    -- 'fecha_especifica': se envía una sola vez en fecha_especifica
    tipo_trigger        VARCHAR(20) NOT NULL DEFAULT 'horario', -- 'horario' | 'recurrente' | 'fecha_especifica'
    hora_envio          TIME NULL,          -- Para 'horario': ej. 09:00
    dias_semana         VARCHAR(20) NULL,   -- Para 'horario': '1,2,3,4,5' (1=lunes…7=domingo)
    intervalo_horas     INT NULL,           -- Para 'recurrente': cada N horas
    fecha_especifica    DATE NULL,          -- Para 'fecha_especifica': fecha única de envío

    -- Condiciones de activación (AND lógico entre las que estén definidas)
    min_ordenes_pendientes  INT NULL,       -- Solo enviar si el usuario tiene >= N órdenes pendientes
    min_dias_en_paso        INT NULL,       -- Solo si la orden lleva >= N días en el paso actual
    monto_minimo            DECIMAL(18,2) NULL, -- Filtrar solo órdenes con total >= monto
    monto_maximo            DECIMAL(18,2) NULL, -- Filtrar solo órdenes con total <= monto

    -- Escalación a jerarquía
    escalar_a_jerarquia     BIT NOT NULL DEFAULT 0,  -- Notifica también al rol/paso anterior como superior
    dias_para_escalar       INT NULL,                -- Escalar si la orden lleva >= N días sin acción

    -- Destinatarios
    enviar_al_responsable   BIT NOT NULL DEFAULT 1,  -- Notifica al usuario/rol asignado al paso

    -- Canales
    enviar_email            BIT NOT NULL DEFAULT 1,
    enviar_whatsapp         BIT NOT NULL DEFAULT 0,
    enviar_telegram         BIT NOT NULL DEFAULT 0,

    fecha_creacion          DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_workflow_recordatorio_workflow FOREIGN KEY (id_workflow) REFERENCES config.workflows(id_workflow),
    CONSTRAINT FK_workflow_recordatorio_paso FOREIGN KEY (id_paso) REFERENCES config.workflow_pasos(id_paso),
    CONSTRAINT CK_workflow_recordatorio_trigger CHECK (tipo_trigger IN ('horario', 'recurrente', 'fecha_especifica'))
);

-- Modificaciones a tablas existentes (ejecutar en BD existentes):
-- ALTER TABLE config.workflow_recordatorio DROP COLUMN asunto_template;
-- ALTER TABLE config.workflow_recordatorio DROP COLUMN cuerpo_template;
-- ALTER TABLE config.workflow_recordatorio DROP COLUMN listado_row_html;

-- 12. TEMPLATES POR CANAL DE RECORDATORIO
-- Permite definir contenido distinto según el canal (email = HTML rico, in_app = texto corto, whatsapp = texto plano).
-- Todo el contenido del recordatorio vive aquí; no hay fallback genérico en el recordatorio padre.
CREATE TABLE config.workflow_recordatorio_canal (
    id_recordatorio_canal   INT IDENTITY(1,1) PRIMARY KEY,
    id_recordatorio         INT NOT NULL,
    codigo_canal            VARCHAR(20) NOT NULL,       -- 'email' | 'in_app' | 'whatsapp' | 'telegram'
    asunto_template         VARCHAR(500) NULL,          -- NULL = sin asunto (canales que no lo usan)
    cuerpo_template         NVARCHAR(MAX) NOT NULL,
    -- Template HTML de fila del listado de órdenes (solo este canal).
    -- Variables: {{Folio}}, {{Proveedor}}, {{Total}}, {{DiasEspera}}. NULL = default del worker.
    listado_row_html        NVARCHAR(500) NULL,
    activo                  BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_recordatorio_canal_recordatorio FOREIGN KEY (id_recordatorio)
        REFERENCES config.workflow_recordatorio(id_recordatorio) ON DELETE CASCADE,
    CONSTRAINT UX_recordatorio_canal UNIQUE (id_recordatorio, codigo_canal),
    CONSTRAINT CK_recordatorio_canal CHECK (codigo_canal IN ('email', 'in_app', 'whatsapp', 'telegram'))
);

CREATE INDEX IX_recordatorio_canal_recordatorio ON config.workflow_recordatorio_canal (id_recordatorio, activo);

-- Modificación a tabla existente (ejecutar en BD existentes):
-- ALTER TABLE config.workflow_recordatorio_canal ADD listado_row_html NVARCHAR(500) NULL;

-- 13. LOG DE RECORDATORIOS ENVIADOS
-- Evita duplicados y sirve como auditoría. Permite al worker saber cuándo fue el último envío.
CREATE TABLE config.workflow_recordatorio_log (
    id_log              INT IDENTITY(1,1) PRIMARY KEY,
    id_recordatorio     INT NOT NULL,
    id_usuario          INT NOT NULL,       -- Usuario notificado (ID de BD de Seguridad)
    id_orden            INT NULL,           -- NULL si es resumen multi-orden
    ordenes_incluidas   INT NULL,           -- Cuántas órdenes se incluyeron en el resumen
    fecha_envio         DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    canal               VARCHAR(20) NOT NULL,    -- 'email' | 'inapp' | 'whatsapp' | 'telegram'
    estado              VARCHAR(20) NOT NULL DEFAULT 'enviado', -- 'enviado' | 'error'
    detalle_error       VARCHAR(500) NULL,

    CONSTRAINT FK_recordatorio_log_recordatorio FOREIGN KEY (id_recordatorio) REFERENCES config.workflow_recordatorio(id_recordatorio) ON DELETE CASCADE
);

CREATE INDEX IX_workflow_recordatorio_workflow_activo ON config.workflow_recordatorio (id_workflow, activo);
CREATE INDEX IX_recordatorio_log_recordatorio_usuario ON config.workflow_recordatorio_log (id_recordatorio, id_usuario, fecha_envio);

-- 14. PLANTILLAS DE NOTIFICACIÓN BASE (Catálogo de referencia)
-- Catálogo de plantillas reutilizables para pre-llenar el editor al crear notificaciones o recordatorios.
-- NO se enlaza por FK — es un helper de UX. El usuario selecciona una, edita y guarda en la tabla de canal.
-- Variables email: {{Folio}}, {{NombreResponsable}}, {{Total}}, {{Proveedor}}, {{Comentario}}, {{ListadoPendientes}}, {{Folios}}, etc.
CREATE TABLE config.workflow_notificaciones_plantillas (
    id_plantilla            INT IDENTITY(1,1) PRIMARY KEY,
    nombre                  NVARCHAR(200) NOT NULL,
    -- Tipo de notificación al que aplica esta plantilla (NULL = genérica, sirve para cualquier tipo)
    codigo_tipo_notificacion VARCHAR(50) NULL,   -- 'aprobacion' | 'rechazo' | 'pendiente' | 'recordatorio' | etc.
    codigo_canal             VARCHAR(20) NOT NULL, -- 'email' | 'in_app' | 'whatsapp' | 'telegram'
    asunto_template          VARCHAR(500) NULL,
    cuerpo_template          NVARCHAR(MAX) NOT NULL,
    -- HTML de fila del listado de órdenes para este canal (NULL = default del worker)
    listado_row_html         NVARCHAR(500) NULL,
    activo                   BIT NOT NULL DEFAULT 1,

    CONSTRAINT CK_notificaciones_plantillas_canal
        CHECK (codigo_canal IN ('email', 'in_app', 'whatsapp', 'telegram'))
);

CREATE INDEX IX_notificaciones_plantillas_tipo_canal
    ON config.workflow_notificaciones_plantillas (codigo_tipo_notificacion, codigo_canal, activo);

-- 15. TEMPLATES POR CANAL DE NOTIFICACIÓN
-- Permite definir contenido específico por canal para cada workflow_notificacion.
-- El dispatcher usa el canal-específico primero; fallback a asunto_template/cuerpo_template de workflow_notificaciones.
CREATE TABLE config.workflow_notificacion_canal (
    id_notificacion_canal   INT IDENTITY(1,1) PRIMARY KEY,
    id_notificacion         INT NOT NULL,
    codigo_canal            VARCHAR(20) NOT NULL,       -- 'email' | 'in_app' | 'whatsapp' | 'telegram'
    asunto_template         VARCHAR(500) NULL,
    cuerpo_template         NVARCHAR(MAX) NOT NULL,
    listado_row_html        NVARCHAR(500) NULL,
    activo                  BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_notificacion_canal_notificacion FOREIGN KEY (id_notificacion)
        REFERENCES config.workflow_notificaciones(id_notificacion) ON DELETE CASCADE,
    CONSTRAINT UX_notificacion_canal UNIQUE (id_notificacion, codigo_canal),
    CONSTRAINT CK_notificacion_canal CHECK (codigo_canal IN ('email', 'in_app', 'whatsapp', 'telegram', 'sms'))
);

CREATE INDEX IX_notificacion_canal_notificacion ON config.workflow_notificacion_canal (id_notificacion, activo);

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
    id_workflow INT NULL, -- FK lógica a config.workflows
    id_paso_actual INT NULL, -- FK lógica a config.workflow_pasos
    
    -- Proveedor (FK al catálogo + datos capturados en la orden)
    id_proveedor                INT            NULL,
    sin_datos_fiscales          BIT            NOT NULL DEFAULT 0,
    razon_social_proveedor      VARCHAR(255)   NOT NULL,
    rfc_proveedor               VARCHAR(13)    NULL,
    codigo_postal_proveedor     VARCHAR(10)    NULL,
    id_regimen_fiscal           INT            NULL,
    persona_contacto            VARCHAR(150)   NULL,
    nota_forma_pago             VARCHAR(500)   NULL,
    notas_generales             VARCHAR(1000)  NULL,
    
    -- Campos asignados en Firma 3 (CxP - Polo)
    id_centro_costo INT NULL,
    id_cuenta_contable INT NULL,            -- FK lógica a catalogos.cuentas_contables
    
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

    -- Proveedor específico de la partida (puede diferir del proveedor principal)
    id_proveedor INT NULL,

    -- Facturación
    requiere_factura     BIT            NOT NULL DEFAULT 1,
    tipo_comprobante     VARCHAR(20)    NULL,          -- 'factura', 'ticket', etc.
    cantidad_facturada   DECIMAL(18,3)  NULL,
    importe_facturado    DECIMAL(18,2)  NULL,
    estado_facturacion   TINYINT        NOT NULL DEFAULT 0, -- 0=Pendiente, 1=Parcial, 2=Completa
    
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

-- =============================================================================
-- TABLAS: COMPROBANTES / FACTURAS CFDI
-- Soporta CFDI (XML + PDF), comprobantes simples (ticket, nota, recibo)
-- y comprobantes de pago (SPEI, transferencia, cheque, efectivo, tarjeta).
-- La relación principal es siempre comprobante → partida via comprobantes_partidas.
-- NUNCA comprobante → orden directa.
-- Categoría: 'gasto' = facturas/comprobantes de gasto; 'pago' = comprobantes de pago.
-- =============================================================================

-- 1. CABECERA DE COMPROBANTE (CFDI o simple)
CREATE TABLE operaciones.comprobantes (
    id_comprobante      INT IDENTITY(1,1) PRIMARY KEY,

    -- Referencias
    id_empresa          INT NOT NULL,
    id_usuario_subio    INT NOT NULL,
    id_paso_workflow    INT NULL,            -- paso del workflow en que se subió

    -- Categoría: 'gasto' = factura/ticket/nota; 'pago' = transferencia/cheque/SPEI
    categoria           VARCHAR(10)  NOT NULL DEFAULT 'gasto',

    -- Tipo
    tipo_comprobante    VARCHAR(20)  NOT NULL, -- 'cfdi', 'ticket', 'nota', 'recibo', 'manual'
    es_cfdi             BIT          NOT NULL DEFAULT 0,

    -- Datos CFDI (solo cuando es_cfdi = 1)
    uuid_cfdi           CHAR(36)     NULL,
    version_cfdi        VARCHAR(5)   NULL,    -- '4.0'
    serie               VARCHAR(25)  NULL,
    folio_cfdi          VARCHAR(40)  NULL,
    fecha_emision       DATETIME     NULL,
    rfc_emisor          VARCHAR(13)  NULL,
    nombre_emisor       VARCHAR(255) NULL,
    rfc_receptor        VARCHAR(13)  NULL,
    nombre_receptor     VARCHAR(255) NULL,
    uso_cfdi            VARCHAR(10)  NULL,    -- 'G01', 'G03', etc.
    metodo_pago         VARCHAR(3)   NULL,    -- 'PUE', 'PPD'
    forma_pago_cfdi     VARCHAR(3)   NULL,    -- '01'=Efectivo, '03'=Transferencia, etc.
    moneda              VARCHAR(3)   NULL DEFAULT 'MXN',
    tipo_cambio         DECIMAL(10,6) NULL DEFAULT 1,

    -- Totales (CFDI o capturados manualmente)
    subtotal            DECIMAL(18,2) NOT NULL DEFAULT 0,
    descuento           DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_iva           DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_retenciones   DECIMAL(18,2) NOT NULL DEFAULT 0,
    total               DECIMAL(18,2) NOT NULL DEFAULT 0,

    -- XML raw almacenado para parseo y auditoría (CFDI).
    -- Los archivos físicos (XML, PDF, imágenes, fotos) se guardan en archivos.Archivos
    -- con EntidadTipo = 'Comprobante' y EntidadId = id_comprobante, carpeta='comprobantes'.
    -- El campo Metadata de archivos.Archivos distingue el tipo:
    --   {"tipo":"xml_cfdi"} | {"tipo":"pdf_cfdi"} | {"tipo":"imagen_comprobante"}
    --   {"tipo":"comprobante_pago","subtipo":"spei","monto":1000,"paso":7,"idOrdenCompra":17}
    xml_original        NVARCHAR(MAX) NULL,

    -- Campos exclusivos de categoria='pago' (transferencia, SPEI, cheque, etc.)
    referencia_pago     VARCHAR(100) NULL,   -- folio/número de operación
    fecha_pago          DATETIME     NULL,   -- fecha en que se realizó el pago
    monto_pago          DECIMAL(18,2) NULL,  -- monto pagado (iguala campo total para pagos)

    -- Estado asignación: 0=Pendiente, 1=Parcial, 2=Aplicado, 3=Rechazado
    estado              TINYINT      NOT NULL DEFAULT 0,

    -- Auditoría
    fecha_creacion      DATETIME     NOT NULL DEFAULT GETDATE(),
    fecha_modificacion  DATETIME     NULL
);

-- 2. CONCEPTOS DEL XML CFDI
--    Solo se puebla cuando es_cfdi = 1. Un comprobante puede tener N conceptos.
CREATE TABLE operaciones.comprobantes_conceptos (
    id_concepto         INT IDENTITY(1,1) PRIMARY KEY,
    id_comprobante      INT          NOT NULL,
    numero_concepto     INT          NOT NULL,       -- secuencia 1, 2, 3…
    clave_prod_serv     VARCHAR(10)  NULL,            -- ClaveProdServ SAT
    clave_unidad        VARCHAR(10)  NULL,            -- ClaveUnidad SAT
    descripcion         VARCHAR(1000) NOT NULL,
    cantidad            DECIMAL(18,6) NOT NULL,
    valor_unitario      DECIMAL(18,6) NOT NULL,
    descuento           DECIMAL(18,2) NOT NULL DEFAULT 0,
    importe             DECIMAL(18,2) NOT NULL,
    tasa_iva            DECIMAL(5,4)  NULL,           -- 0.16, 0.08, 0.00
    importe_iva         DECIMAL(18,2) NULL,
    -- Acumulados de asignación (actualizados por el servicio al asignar partidas)
    cantidad_asignada   DECIMAL(18,6) NOT NULL DEFAULT 0,
    importe_asignado    DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT FK_conceptos_comprobante FOREIGN KEY (id_comprobante)
        REFERENCES operaciones.comprobantes(id_comprobante) ON DELETE CASCADE,
    CONSTRAINT UQ_concepto_por_comprobante UNIQUE (id_comprobante, numero_concepto)
);

-- 3. TABLA PUENTE: COMPROBANTE ↔ PARTIDA DE OC
--    Relación central del sistema. id_concepto es NULL para comprobantes sin CFDI.
CREATE TABLE operaciones.comprobantes_partidas (
    id_asignacion       INT IDENTITY(1,1) PRIMARY KEY,
    id_comprobante      INT          NOT NULL,
    id_concepto         INT          NULL,           -- NULL para comprobantes sin CFDI
    id_partida          INT          NOT NULL,       -- ordenes_compra_partidas.id_partida
    id_usuario_asigno   INT          NOT NULL,
    id_paso_workflow    INT          NULL,

    -- Cantidades e importes de esta asignación específica
    cantidad_asignada   DECIMAL(18,6) NOT NULL,
    importe_asignado    DECIMAL(18,2) NOT NULL,

    notas               VARCHAR(500) NULL,
    fecha_asignacion    DATETIME     NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_asignacion_comprobante FOREIGN KEY (id_comprobante)
        REFERENCES operaciones.comprobantes(id_comprobante),
    CONSTRAINT FK_asignacion_concepto FOREIGN KEY (id_concepto)
        REFERENCES operaciones.comprobantes_conceptos(id_concepto),
    CONSTRAINT FK_asignacion_partida FOREIGN KEY (id_partida)
        REFERENCES operaciones.ordenes_compra_partidas(id_partida)
);

-- ÍNDICES COMPROBANTES
-- UUID único solo para registros CFDI (índice filtrado)
CREATE UNIQUE INDEX UX_comprobantes_uuid
    ON operaciones.comprobantes(uuid_cfdi)
    WHERE uuid_cfdi IS NOT NULL;
CREATE INDEX IX_comprobantes_empresa_fecha
    ON operaciones.comprobantes(id_empresa, fecha_creacion);
CREATE INDEX IX_comprobantes_conceptos_comprobante
    ON operaciones.comprobantes_conceptos(id_comprobante);
CREATE INDEX IX_comprobantes_partidas_partida
    ON operaciones.comprobantes_partidas(id_partida);
CREATE INDEX IX_comprobantes_partidas_comprobante
    ON operaciones.comprobantes_partidas(id_comprobante);

-- =============================================================================
-- STORED PROCEDURE: config.sp_procesar_recordatorios
-- DESCRIPCIÓN: Llama al endpoint de la API para procesar recordatorios de workflow.
--              Diseñado para ejecutarse desde SQL Server Agent cada X minutos.
--              Requiere que sp_OA esté habilitado:
--                  EXEC sp_configure 'Ole Automation Procedures', 1; RECONFIGURE;
--
-- USO MANUAL:
--   EXEC config.sp_procesar_recordatorios;
--
-- SQL SERVER AGENT (Job Step):
--   Crear un Job con un Step de tipo T-SQL:
--   EXEC config.sp_procesar_recordatorios;
--   Schedule: cada 15 minutos (o el intervalo deseado)
-- =============================================================================
GO

CREATE OR ALTER PROCEDURE config.sp_procesar_recordatorios
    @api_base_url VARCHAR(255) = 'http://192.168.4.2:5174'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Object       INT;
    DECLARE @ResponseText VARCHAR(8000);
    DECLARE @URL          VARCHAR(500);
    DECLARE @ErrMsg       VARCHAR(500);

    SET @URL = @api_base_url + '/api/workflow/recordatorios/ejecutar';

    BEGIN TRY
        EXEC sp_OACreate 'MSXML2.ServerXMLHTTP', @Object OUT;
        EXEC sp_OAMethod @Object, 'open', NULL, 'POST', @URL, 'false';
        EXEC sp_OAMethod @Object, 'setRequestHeader', NULL, 'Content-Type', 'application/json';
        EXEC sp_OAMethod @Object, 'send';
        EXEC sp_OAMethod @Object, 'responseText', @ResponseText OUTPUT;
        EXEC sp_OADestroy @Object;

        PRINT 'Recordatorios procesados. Respuesta: ' + ISNULL(@ResponseText, '(sin respuesta)');
    END TRY
    BEGIN CATCH
        IF @Object IS NOT NULL
            EXEC sp_OADestroy @Object;

        SET @ErrMsg = 'Error en sp_procesar_recordatorios: ' + ERROR_MESSAGE();
        RAISERROR(@ErrMsg, 16, 1);
    END CATCH
END
GO

-- =============================================================================
-- MIGRACIONES INCREMENTALES
-- =============================================================================

-- v1.1: Añadir permite_adjunto a workflow_pasos (DEFAULT 1 → todos los pasos existentes lo heredan)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('config.workflow_pasos') AND name = 'permite_adjunto'
)
BEGIN
    ALTER TABLE config.workflow_pasos
    ADD permite_adjunto BIT NOT NULL DEFAULT 1;
END
GO

-- v1.2: Añadir requerido a workflow_accion_handlers + renombrar handler_key values
--       RequiredFields → Field (non-Archivo) / Document (Archivo)
--       FieldUpdater   → Field (con requerido=1, ahora valida Y guarda en una sola fila)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('config.workflow_accion_handlers') AND name = 'requerido'
)
BEGIN
    ALTER TABLE config.workflow_accion_handlers
    ADD requerido BIT NOT NULL DEFAULT 1;
END
GO
