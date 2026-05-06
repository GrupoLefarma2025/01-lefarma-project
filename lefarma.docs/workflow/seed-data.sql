-- =============================================================================
-- SEED DATA: Motor de Workflows - Grupo Lefarma
-- DESCRIPCIÓN: Datos iniciales para probar el flujo de 5 firmas de Órdenes de Compra
-- =============================================================================

-- =============================================================================
-- 1. WORKFLOW: ORDEN_COMPRA
-- =============================================================================
SET IDENTITY_INSERT config.workflows ON;

INSERT INTO config.workflows (id_workflow, nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
VALUES (1, 'Orden de Compra', 'Flujo de autorización de 5 firmas para órdenes de compra', 'ORDEN_COMPRA', 1, 1, GETDATE());

SET IDENTITY_INSERT config.workflows OFF;

-- =============================================================================
-- 2. PASOS DEL WORKFLOW
-- =============================================================================
SET IDENTITY_INSERT config.workflow_pasos ON;

INSERT INTO config.workflow_pasos 
(id_paso, id_workflow, orden, nombre_paso, codigo_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
VALUES 
    -- Paso inicial (captura): solo envío, sin uploader genérico (el uploader está en la creación de OC)
    (1, 1, 0, 'Creada', 'CREADA', 'Orden de compra capturada por el usuario', 1, 0, 0, 0, 0, 1, 1),
    
    -- Firma 2: Gerente General — puede adjuntar soporte opcional
    (2, 1, 10, 'Firma 2 - Gerente General', 'EN_REVISION_F2', 'Autorización del Gerente General de la Empresa/Sucursal', 0, 0, 1, 0, 0, 1, 1),
    
    -- Firma 3: CxP — puede adjuntar soporte opcional (Centro de Costo/Cuenta Contable vía handlers)
    (3, 1, 20, 'Firma 3 - CxP', 'EN_REVISION_F3', 'Revisión de CxP, asignación de centro de costo y cuenta contable', 0, 0, 1, 0, 0, 1, 1),
    
    -- Firma 4: GAF — puede adjuntar soporte opcional (checkboxes comprobación vía handlers)
    (4, 1, 30, 'Firma 4 - GAF', 'EN_REVISION_F4', 'Autorización del Gerente de Administración y Finanzas', 0, 0, 1, 0, 0, 1, 1),
    
    -- Firma 5: Dirección Corporativa — puede adjuntar soporte opcional
    (5, 1, 40, 'Firma 5 - Dirección Corporativa', 'EN_REVISION_F5', 'Autorización de Dirección Corporativa para montos mayores a $100,000', 0, 0, 1, 0, 0, 1, 1),
    
    -- Estados post-autorización
    -- Autorizada: paso transitorio, puede adjuntar (ej: orden de compra firmada)
    (6, 1, 50, 'Autorizada', 'AUTORIZADA', 'Orden autorizada, lista para pago', 0, 0, 0, 0, 0, 1, 1),
    -- En Tesorería: permite_adjunto=0 porque acción 16 (Marcar como Pagada) tiene handler Document comprobante_pago
    (7, 1, 60, 'En Tesorería', 'EN_TESORERIA', 'Orden en proceso de pago por Tesorería', 0, 0, 0, 0, 0, 0, 1),
    -- Pagada: permite_adjunto=0 porque acción 17 (Iniciar Comprobación) tiene handler Document comprobante_gasto
    (8, 1, 70, 'Pagada', 'PAGADA', 'Pago realizado, pendiente de comprobación', 0, 0, 0, 0, 0, 0, 1),
    -- En Comprobación: permite_adjunto=1 — acciones 18/19 no tienen Document handler, usuario puede adjuntar soporte libre
    (9, 1, 80, 'En Comprobación', 'EN_COMPROBACION', 'Usuario subiendo comprobantes de gasto (factura CFDI)', 0, 0, 0, 0, 0, 1, 1),
    -- Cerrada: ciclo completo, no tiene acciones de usuario, ocultar uploader
    (10, 1, 90, 'Cerrada', 'CERRADA', 'Ciclo completo, orden cerrada', 0, 1, 0, 0, 0, 0, 1),
    
    -- Estados de rechazo/cancelación: permiten adjuntar evidencia del motivo
    (11, 1, 100, 'Rechazada', 'RECHAZADA', 'Orden rechazada en alguna firma', 0, 1, 0, 1, 0, 1, 1),
    (12, 1, 110, 'Cancelada', 'CANCELADA', 'Orden cancelada por el usuario', 0, 1, 0, 1, 0, 1, 1);

SET IDENTITY_INSERT config.workflow_pasos OFF;

-- =============================================================================
-- 3. PARTICIPANTES (Roles y Usuarios por Paso)
-- Nota: id_rol e id_usuario son referencias lógicas a la BD de Seguridad
-- =============================================================================
SET IDENTITY_INSERT config.workflow_participantes ON;

INSERT INTO config.workflow_participantes (id_participante, id_paso, id_rol, id_usuario, activo)
VALUES 
    -- Paso 1 (Creada): Todos los capturistas
    (1, 1, 5, NULL, 1),  -- Rol: Capturista
    
    -- Paso 2 (Firma 2): Gerentes Generales por Sucursal
    (2, 2, 10, NULL, 1), -- Rol: Gerente General
    -- O usuarios específicos:
    -- (3, 2, NULL, 101, 1), -- Martha Anaya (Guadalajara)
    -- (4, 2, NULL, 102, 1), -- Alfredo Corona (CDMX)
    
    -- Paso 3 (Firma 3): CxP - Marco Polo
    (5, 3, NULL, 200, 1), -- Usuario específico: Marco Polo Narvaez
    
    -- Paso 4 (Firma 4): GAF - Diego
    (6, 4, NULL, 201, 1), -- Usuario específico: Diego Villaseñor
    
    -- Paso 5 (Firma 5): Dirección Corporativa - Hector
    (7, 5, NULL, 202, 1), -- Usuario específico: Hector Velez
    
    -- Tesorería
    (8, 7, 15, NULL, 1),  -- Rol: Tesorería
    
    -- Comprobación: Usuario original + CxP
    (9, 9, 5, NULL, 1),   -- Rol: Capturista (usuario que creó la orden)
    (10, 9, NULL, 200, 1); -- Usuario: Marco Polo (valida comprobación)

SET IDENTITY_INSERT config.workflow_participantes OFF;

-- =============================================================================
-- 4. ACCIONES (Transiciones entre Pasos)
-- =============================================================================
SET IDENTITY_INSERT config.workflow_acciones ON;

INSERT INTO config.workflow_acciones 
(id_accion, id_paso_origen, id_paso_destino, nombre_accion, tipo_accion, clase_estetica, activo)
VALUES 
    -- Desde Creada (1) → Firma 2
    (1, 1, 2, 'Enviar a autorización', 'APROBACION', 'primary', 1),
    (2, 1, 12, 'Cancelar', 'CANCELACION', 'danger', 1),
    
    -- Desde Firma 2 (2) → Firma 3 o Rechazo
    (3, 2, 3, 'Autorizar', 'APROBACION', 'success', 1),
    (4, 2, 11, 'Rechazar', 'RECHAZO', 'danger', 1),
    
    -- Desde Firma 3 (3) → Firma 4 o Rechazo
    (5, 3, 4, 'Autorizar', 'APROBACION', 'success', 1),
    (6, 3, 11, 'Rechazar', 'RECHAZO', 'danger', 1),
    (7, 3, 1, 'Devolver a corrección', 'RETORNO', 'warning', 1),
    
    -- Desde Firma 4 (4) → Autorizar (ruta dinámica por condición) o Rechazo
    -- id_paso_destino queda NULL para que lo determine workflow_condiciones
    (8, 4, NULL, 'Autorizar', 'APROBACION', 'success', 1),
    (10, 4, 11, 'Rechazar', 'RECHAZO', 'danger', 1),
    (11, 4, 1, 'Devolver a corrección', 'RETORNO', 'warning', 1),
    
    -- Desde Firma 5 (5) → Autorizada o Rechazo
    (12, 5, 6, 'Autorizar', 'APROBACION', 'success', 1),
    (13, 5, 11, 'Rechazar', 'RECHAZO', 'danger', 1),
    (14, 5, 1, 'Devolver a corrección', 'RETORNO', 'warning', 1),
    
    -- Desde Autorizada (6) → En Tesorería
    (15, 6, 7, 'Enviar a Tesorería', 'APROBACION', 'primary', 1),
    
    -- Desde En Tesorería (7) → Pagada
    (16, 7, 8, 'Marcar como Pagada', 'APROBACION', 'success', 1),
    
    -- Desde Pagada (8) → En Comprobación
    (17, 8, 9, 'Iniciar Comprobación', 'APROBACION', 'primary', 1),
    
    -- Desde En Comprobación (9) → Cerrada o Devolver
    (18, 9, 10, 'Validar Comprobación', 'APROBACION', 'success', 1),
    (19, 9, 8, 'Rechazar Comprobación', 'RETORNO', 'warning', 1);

SET IDENTITY_INSERT config.workflow_acciones OFF;

-- =============================================================================
-- 5. CAMPOS CONFIGURABLES (workflow_campos)
-- Diccionario de todos los campos que puede manejar el workflow dinámicamente.
-- propiedad_entidad → nombre de la propiedad C# en OrdenCompra (para FieldUpdater con reflexión).
-- validar_fiscal    → solo para Archivo: si 1, se verificará con webservice fiscal (omite imágenes).
-- =============================================================================
SET IDENTITY_INSERT config.workflow_campos ON;

INSERT INTO config.workflow_campos
(id_workflow_campo, id_workflow, nombre_tecnico, etiqueta_usuario, tipo_control, source_catalog, propiedad_entidad, validar_fiscal, activo)
VALUES
    (1, 1, 'id_centro_costo',             'Centro de costo',               'Selector', 'catalogos/CentrosCosto',     'IdCentroCosto',               0, 1),
    (2, 1, 'id_cuenta_contable',          'Cuenta contable',               'Selector', 'catalogos/CuentasContables', 'IdCuentaContable',             0, 1),
    (3, 1, 'requiere_comprobacion_pago',  'Requiere comprobación de pago', 'Checkbox', NULL,                         'RequiereComprobacionPago',     0, 1),
    (4, 1, 'requiere_comprobacion_gasto', 'Requiere comprobación de gasto','Checkbox', NULL,                         'RequiereComprobacionGasto',    0, 1),
    (5, 1, 'comprobante_pago',            'Comprobante de Pago',           'Archivo',  NULL,                         NULL,                           0, 1),
    (6, 1, 'comprobante_gasto',           'Comprobante de Gasto',          'Archivo',  NULL,                         NULL,                           1, 1);  -- validar_fiscal=1: webservice CFDI

SET IDENTITY_INSERT config.workflow_campos OFF;

-- =============================================================================
-- 6. HANDLERS DINÁMICOS POR ACCIÓN (workflow_accion_handlers)
-- Solo 2 tipos: RequiredFields (valida) y FieldUpdater (guarda en orden).
-- RequiredFields con tipo_control=Archivo valida que el documento esté en BD.
-- FieldUpdater usa reflexión sobre propiedad_entidad del campo.
-- =============================================================================
SET IDENTITY_INSERT config.workflow_accion_handlers ON;INSERT INTO config.workflow_accion_handlers
(id_handler, id_accion, handler_key, requerido, configuracion_json, orden_ejecucion, activo, id_workflow_campo)
VALUES
    -- Firma 3 - Autorizar: validar Y guardar centro de costo y cuenta contable (1 fila por campo)
    (1, 5, 'Field', 1, NULL, 1, 1, 1),
    (9, 5, 'Field', 1, NULL, 2, 1, 2),

    -- Firma 4 - Autorizar: guardar checkboxes de comprobación
    (2, 8, 'Field', 1, NULL, 1, 1, 3),
    (3, 8, 'Field', 1, NULL, 2, 1, 4),

    -- Tesorería - Marcar como Pagada: requiere comprobante de pago (Archivo, validar_fiscal=0)
    (4, 16, 'Document', 1, NULL, 1, 1, 5),

    -- Iniciar Comprobación: requiere comprobante de gasto/factura (Archivo, validar_fiscal=1 → webservice fiscal)
    (5, 17, 'Document', 1, NULL, 1, 1, 6);
    SET IDENTITY_INSERT config.workflow_accion_handlers OFF;

-- =============================================================================
-- 7. CONDICIONES (Reglas Dinámicas)
-- =============================================================================
SET IDENTITY_INSERT config.workflow_condiciones ON;

INSERT INTO config.workflow_condiciones 
(id_condicion, id_paso, campo_evaluacion, operador, valor_comparacion, id_paso_si_cumple, activo)
VALUES 
    -- Si Total > $100,000 después de Firma 4 → Ir a Firma 5 (paso 5)
    (1, 4, 'Total', '>', '100000', 5, 1),
    
    -- Si Total <= $100,000 después de Firma 4 → Ir directo a Autorizada (paso 6)
    (2, 4, 'Total', '<=', '100000', 6, 1);

SET IDENTITY_INSERT config.workflow_condiciones OFF;

-- =============================================================================
-- 8. TIPOS DE NOTIFICACIÓN (catálogo de colores por tipo)
-- =============================================================================
SET IDENTITY_INSERT config.workflow_tipo_notificacion ON;

INSERT INTO config.workflow_tipo_notificacion (id_tipo, codigo, nombre, color_tema, color_claro, icono, activo)
VALUES
    (1, 'pendiente',  'Pendiente de firma',   '#2563eb', '#dbeafe', '⏳', 1),
    (2, 'aprobacion', 'Aprobada / Validada',  '#16a34a', '#dcfce7', '✅', 1),
    (3, 'rechazo',    'Rechazada',            '#dc2626', '#fee2e2', '❌', 1),
    (4, 'devolucion', 'Devuelta a corrección','#d97706', '#fef3c7', '↩️', 1),
    (5, 'pago',       'Pago realizado',       '#0891b2', '#cffafe', '💳', 1),
    (6, 'info',       'Información general',  '#6366f1', '#ede9fe', 'ℹ️', 1),
    (7, 'recordatorio','Recordatorio',        '#d97706', '#fef3c7', '⏰', 1);

SET IDENTITY_INSERT config.workflow_tipo_notificacion OFF;

-- =============================================================================
-- 9. NOTIFICACIONES (Templates por Acción)
-- =============================================================================
SET IDENTITY_INSERT config.workflow_notificaciones ON;

INSERT INTO config.workflow_notificaciones 
(id_notificacion, id_accion, id_paso_destino, id_tipo_notificacion, enviar_email, enviar_whatsapp, enviar_telegram, 
 avisar_al_creador, avisar_al_siguiente, avisar_al_anterior, avisar_a_autorizadores_previos, incluir_partidas)
VALUES 
    -- Notificación al autorizar en Firma 2 → pendiente Firma 3
    -- Sin autorizadores previos aún, solo avisa al siguiente
    (1, 3, NULL, 1, 1, 0, 0, 0, 1, 0, 0, 1),
    
    -- Notificación al rechazar en Firma 2 → rechazo
    -- Solo hay un paso previo (el creador), no hay autorizadores previos en cadena
    (2, 4, NULL, 3, 1, 0, 0, 1, 0, 0, 0, 1),
    
    -- Notificación al autorizar en Firma 3 → pendiente Firma 4
    (3, 5, NULL, 1, 1, 0, 0, 0, 1, 0, 0, 1),
    
    -- Notificación al rechazar en Firma 3 → rechazo
    -- Avisa al creador + anterior (Firma 2) + todos los autorizadores previos
    (4, 6, NULL, 3, 1, 0, 0, 1, 0, 1, 1, 1),
    
    -- Notificación al autorizar en Firma 4 (destino Firma 5, monto > $100k) → pendiente
    (5, 8, 5, 1, 1, 0, 0, 0, 1, 0, 0, 1),
    
    -- Notificación al autorizar en Firma 4 (destino Autorizada, monto <= $100k) → aprobacion final
    -- Avisa al creador + todos los autorizadores previos (para cerrar el ciclo)
    (6, 8, 6, 2, 1, 0, 0, 1, 0, 0, 1, 1),
    
    -- Notificación al rechazar en Firma 4 → rechazo
    -- Avisa al creador + anterior (Firma 3) + todos los autorizadores previos
    (7, 10, NULL, 3, 1, 0, 0, 1, 0, 1, 1, 1),
    
    -- Notificación al autorizar en Firma 5 → aprobacion final
    -- Avisa al creador + siguiente (Tesorería) + todos los autorizadores previos
    (8, 12, NULL, 2, 1, 0, 0, 1, 1, 0, 1, 1),
    
    -- Notificación al rechazar en Firma 5 → rechazo
    -- Avisa al creador + anterior (Firma 4) + todos los autorizadores previos
    (9, 13, NULL, 3, 1, 0, 0, 1, 0, 1, 1, 1),
    
    -- Notificación al pagar orden → pago (solo el creador/solicitante)
    (10, 16, NULL, 5, 1, 0, 0, 1, 0, 0, 0, 1),
    
    -- Notificación al validar comprobación → aprobacion (solo el creador)
    (11, 18, NULL, 2, 1, 0, 0, 1, 0, 0, 0, 1),
    
    -- Notificación al enviar a autorización desde Creada → pendiente primer firma
    (12, 1, NULL, 1, 1, 0, 0, 0, 1, 0, 0, 1);

SET IDENTITY_INSERT config.workflow_notificaciones OFF;

-- =============================================================================
-- 9B. CANALES DE NOTIFICACIÓN — workflow_notificacion_canal
-- =============================================================================
-- Migra asunto/cuerpo de workflow_notificaciones al canal email

SET IDENTITY_INSERT config.workflow_notificacion_canal ON;

INSERT INTO config.workflow_notificacion_canal
(id_notificacion_canal, id_notificacion, codigo_canal, asunto_template, cuerpo_template, listado_row_html, activo)
VALUES
    -- Notif 1: Autorizar Firma 2 → pendiente Firma 3 (NombreAnterior = Gerente General)
    (1,  1, 'email',
     'OC {{Folio}} - Pendiente tu autorización (Firma 3)',
     'Hola {{NombreSiguiente}},<br><br>La orden de compra <strong>{{Folio}}</strong> por <strong>{{Total}}</strong> fue autorizada por <strong>{{NombreAnterior}}</strong> (Gerente General) y requiere tu revisión.<br><br>Proveedor: {{Proveedor}}<br>Solicitante: {{Solicitante}}<br><br>{{Partidas}}<br>Por favor ingresa al sistema para revisarla y autorizarla.<br><br>{{Comentario}}',
     NULL, 1),

    (2,  1, 'in_app',
     NULL,
     'La OC {{Folio}} requiere tu autorización (Firma 3) — autorizada por {{NombreAnterior}}',
     NULL, 1),

    -- Notif 2: Rechazar Firma 2 → avisa creador (NombreAnterior = Gerente General)
    (3,  2, 'email',
     'OC {{Folio}} - Rechazada por Gerente General',
     'Hola {{NombreCreador}},<br><br>Tu orden de compra <strong>{{Folio}}</strong> fue <strong>rechazada</strong> por <strong>{{NombreAnterior}}</strong> (Gerente General).<br><br>{{Partidas}}<br>Motivo: {{Comentario}}<br><br>Por favor revisa y corrige la orden.',
     NULL, 1),

    (4,  2, 'in_app',
     NULL,
     'Tu OC {{Folio}} fue rechazada por {{NombreAnterior}} (Gte. General). Motivo: {{Comentario}}',
     NULL, 1),

    -- Notif 3: Autorizar Firma 3 → pendiente Firma 4 (NombreAnterior = CxP)
    (5,  3, 'email',
     'OC {{Folio}} - Pendiente tu autorización (Firma 4)',
     'Hola {{NombreSiguiente}},<br><br>La orden de compra <strong>{{Folio}}</strong> por <strong>{{Total}}</strong> fue autorizada por <strong>{{NombreAnterior}}</strong> (Cuentas por Pagar) y requiere tu revisión.<br><br>Proveedor: {{Proveedor}}<br>Centro de Costo: {{CentroCosto}}<br>Cuenta Contable: {{CuentaContable}}<br><br>{{Partidas}}<br>Por favor ingresa al sistema para revisarla y autorizarla.<br><br>{{Comentario}}',
     NULL, 1),

    (6,  3, 'in_app',
     NULL,
     'La OC {{Folio}} requiere tu autorización (Firma 4) — autorizada por {{NombreAnterior}}',
     NULL, 1),

    -- Notif 4: Rechazar Firma 3 → avisa creador (NombreAnterior = CxP)
    (7,  4, 'email',
     'OC {{Folio}} - Rechazada por CxP',
     'Hola {{NombreCreador}},<br><br>Tu orden de compra <strong>{{Folio}}</strong> fue <strong>rechazada</strong> por <strong>{{NombreAnterior}}</strong> (Cuentas por Pagar).<br><br>{{Partidas}}<br>Motivo: {{Comentario}}<br><br>Por favor revisa y corrige la orden.',
     NULL, 1),

    (8,  4, 'in_app',
     NULL,
     'Tu OC {{Folio}} fue rechazada por {{NombreAnterior}} (CxP). Motivo: {{Comentario}}',
     NULL, 1),

    -- Notif 5: Autorizar Firma 4 → Firma 5 por exceder $100k (NombreAnterior = GAF)
    (9,  5, 'email',
     'OC {{Folio}} - Pendiente autorización de Dirección Corporativa',
     'Hola {{NombreSiguiente}},<br><br>La orden de compra <strong>{{Folio}}</strong> por <strong>{{Total}}</strong> requiere tu autorización por exceder los $100,000.<br><br>Autorizada previamente por <strong>{{NombreAnterior}}</strong> (GAF).<br>Proveedor: {{Proveedor}}<br><br>{{Partidas}}<br>Por favor ingresa al sistema para revisarla y autorizarla.<br><br>{{Comentario}}',
     NULL, 1),

    (10, 5, 'in_app',
     NULL,
     'La OC {{Folio}} por {{Total}} requiere tu autorización (excede $100,000) — autorizada por {{NombreAnterior}}',
     NULL, 1),

    -- Notif 6: Autorizar Firma 4 → Autorizada (NombreAnterior = GAF)
    (11, 6, 'email',
     'OC {{Folio}} - AUTORIZADA',
     'Hola {{NombreCreador}},<br><br>¡Tu orden de compra <strong>{{Folio}}</strong> ha sido <strong>AUTORIZADA</strong> por <strong>{{NombreAnterior}}</strong> (GAF)!<br><br>Total: {{Total}}<br>Proveedor: {{Proveedor}}<br><br>{{Partidas}}<br>La orden fue enviada a Tesorería para el proceso de pago.<br><br>{{Comentario}}',
     NULL, 1),

    (12, 6, 'in_app',
     NULL,
     '¡Tu OC {{Folio}} fue AUTORIZADA por {{NombreAnterior}} (GAF)! Total: {{Total}}',
     NULL, 1),

    -- Notif 7: Rechazar Firma 4 → avisa creador (NombreAnterior = GAF)
    (13, 7, 'email',
     'OC {{Folio}} - Rechazada por GAF',
     'Hola {{NombreCreador}},<br><br>Tu orden de compra <strong>{{Folio}}</strong> fue <strong>rechazada</strong> por <strong>{{NombreAnterior}}</strong> (GAF).<br><br>{{Partidas}}<br>Motivo: {{Comentario}}<br><br>Por favor revisa y corrige la orden.',
     NULL, 1),

    (14, 7, 'in_app',
     NULL,
     'Tu OC {{Folio}} fue rechazada por {{NombreAnterior}} (GAF). Motivo: {{Comentario}}',
     NULL, 1),

    -- Notif 8: Autorizar Firma 5 → Autorizada (NombreAnterior = Dirección Corporativa)
    (15, 8, 'email',
     'OC {{Folio}} - AUTORIZADA por Dirección Corporativa',
     'Hola {{NombreCreador}},<br><br>¡Tu orden de compra <strong>{{Folio}}</strong> ha sido <strong>AUTORIZADA</strong> por <strong>{{NombreAnterior}}</strong> (Dirección Corporativa)!<br><br>Total: {{Total}}<br>Proveedor: {{Proveedor}}<br><br>{{Partidas}}<br>La orden fue enviada a Tesorería para el proceso de pago.<br><br>{{Comentario}}',
     NULL, 1),

    (16, 8, 'in_app',
     NULL,
     '¡Tu OC {{Folio}} fue AUTORIZADA por {{NombreAnterior}} (Dirección Corporativa)! Total: {{Total}}',
     NULL, 1),

    -- Notif 9: Rechazar Firma 5 → avisa creador (NombreAnterior = Dirección Corporativa)
    (17, 9, 'email',
     'OC {{Folio}} - Rechazada por Dirección Corporativa',
     'Hola {{NombreCreador}},<br><br>Tu orden de compra <strong>{{Folio}}</strong> fue <strong>rechazada</strong> por <strong>{{NombreAnterior}}</strong> (Dirección Corporativa).<br><br>{{Partidas}}<br>Motivo: {{Comentario}}<br><br>Por favor revisa los detalles de la orden.',
     NULL, 1),

    (18, 9, 'in_app',
     NULL,
     'Tu OC {{Folio}} fue rechazada por {{NombreAnterior}} (Dirección Corporativa). Motivo: {{Comentario}}',
     NULL, 1),

    -- Notif 10: Pago realizado (NombreAnterior = quien registró el pago, ej. Tesorería)
    (19, 10, 'email',
     'OC {{Folio}} - Pago Realizado',
     'Hola {{NombreCreador}},<br><br>Se ha registrado el pago de tu orden de compra <strong>{{Folio}}</strong> por <strong>{{NombreAnterior}}</strong> (Tesorería).<br><br>Importe Pagado: {{ImportePagado}}<br>Proveedor: {{Proveedor}}<br><br>{{Partidas}}<br>Por favor procede a comprobar el gasto en el sistema.<br><br>{{Comentario}}',
     NULL, 1),

    (20, 10, 'in_app',
     NULL,
     'Se registró el pago de tu OC {{Folio}} por {{NombreAnterior}}. Por favor comprueba el gasto.',
     NULL, 1),

    -- Notif 11: Validar comprobación (NombreAnterior = CxP)
    (21, 11, 'email',
     'OC {{Folio}} - Comprobación VALIDADA',
     'Hola {{NombreCreador}},<br><br>¡La comprobación de la orden <strong>{{Folio}}</strong> ha sido <strong>VALIDADA</strong> por <strong>{{NombreAnterior}}</strong> (Cuentas por Pagar)!<br><br>{{Partidas}}<br>La orden ha sido cerrada exitosamente.<br><br>{{Comentario}}',
     NULL, 1),

    (22, 11, 'in_app',
     NULL,
     '¡La comprobación de tu OC {{Folio}} fue VALIDADA por {{NombreAnterior}} (CxP)! La orden está cerrada.',
     NULL, 1),

    -- Notif 12: Enviar a autorización (Creada → Firma 2, NombreAnterior = solicitante)
    (23, 12, 'email',
     'OC {{Folio}} - Nueva orden pendiente de autorización',
     'Hola {{NombreSiguiente}},<br><br>Se ha enviado una nueva orden de compra para tu autorización.<br><br>Folio: <strong>{{Folio}}</strong><br>Proveedor: {{Proveedor}}<br>Total: <strong>{{Total}}</strong><br>Solicitante: {{Solicitante}}<br><br>{{Partidas}}<br>Por favor ingresa al sistema para revisarla y autorizarla.',
     NULL, 1),

    (24, 12, 'in_app',
     NULL,
     'Nueva OC {{Folio}} por {{Total}} de {{Solicitante}} esperando tu autorización.',
     NULL, 1);

SET IDENTITY_INSERT config.workflow_notificacion_canal OFF;
-- =============================================================================
-- Inserta perfiles extendidos de usuarios para pruebas
-- Nota: Los id_usuario deben corresponder con los de tu BD de Seguridad

INSERT INTO config.usuario_detalle 
(id_usuario, id_empresa, id_sucursal, id_area, id_centro_costo, puesto, numero_empleado, 
 celular, canal_preferido, notificar_email, notificar_app, notificar_resumen_diario, 
 tema_interfaz, dashboard_inicio, elementos_por_pagina)
VALUES 
    -- Marco Polo Narvaez (CxP - Firma 3)
    (200, 5, 1, 2, 102, 'Contador de Cuentas por Pagar', 'EMP-200', 
     '5512345678', 'email', 1, 1, 1, 'light', 'cxp', 20),
    
    -- Diego Villaseñor (GAF - Firma 4)
    (201, 5, 1, 2, 104, 'Gerente de Administración y Finanzas', 'EMP-201', 
     '5523456789', 'email', 1, 1, 1, 'light', 'autorizador', 20),
    
    -- Hector Velez (Dirección Corporativa - Firma 5)
    (202, 5, 1, 4, 104, 'Director Corporativo', 'EMP-202', 
     '5534567890', 'email', 1, 1, 1, 'light', 'autorizador', 10);

-- =============================================================================
-- 11. PLANTILLAS DE CANAL (workflow_canal_templates)
-- =============================================================================
-- Nota: {{Contenido}} = cuerpo_template ya interpolado
--       {{Asunto}}, {{ColorTema}}, {{Icono}}, {{UrlOrden}} = variables disponibles en el layout
-- =============================================================================

SET IDENTITY_INSERT config.workflow_canal_templates ON;

INSERT INTO config.workflow_canal_templates
    (id_template, codigo_canal, nombre, layout_html, activo, fecha_modificacion)
VALUES
(1, 'email', 'Email - Orden de Compra',
N'<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{Asunto}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f0f2f5;padding:40px 16px">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.10)">

          <!-- Header con color dinámico por tipo -->
          <tr>
            <td style="background-color:{{ColorTema}};padding:28px 36px">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">
                {{Icono}} Grupo Lefarma
              </p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;font-weight:400">
                Sistema de Autorizaciones de Órdenes de Compra
              </p>
            </td>
          </tr>

          <!-- Body con borde de acento -->
          <tr>
            <td style="background-color:#ffffff;padding:0 0 0 4px;border-left:4px solid {{ColorTema}}">
              <div style="padding:36px 36px 28px;color:#1f2937;font-size:15px;line-height:1.7">
                {{Contenido}}
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="background-color:#ffffff;padding:0 36px 36px">
              <a href="{{UrlOrden}}"
                 style="display:inline-block;background-color:{{ColorTema}};color:#ffffff;text-decoration:none;
                        padding:13px 28px;border-radius:7px;font-size:14px;font-weight:600;
                        letter-spacing:0.2px;border:none">
                Ver Orden en el Sistema →
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="background-color:#ffffff;padding:0 36px">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fa;padding:20px 36px;border-radius:0 0 10px 10px">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;text-align:center">
                Este mensaje fue generado automáticamente. Por favor no responda a este correo.<br>
                © Grupo Lefarma — Sistema de Autorizaciones
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
1, GETUTCDATE()),

(2, 'in_app', 'In-App - Orden de Compra',
N'{{Contenido}}',
1, GETUTCDATE());

SET IDENTITY_INSERT config.workflow_canal_templates OFF;

-- =============================================================================
-- 12. RECORDATORIOS DE EJEMPLO (workflow_recordatorio)
-- =============================================================================
-- Recordatorio diario a las 9am (lunes-viernes) para cualquier paso pendiente
-- Solo se activa si la orden lleva al menos 1 día en el paso actual

SET IDENTITY_INSERT config.workflow_recordatorio ON;

INSERT INTO config.workflow_recordatorio
(id_recordatorio, id_workflow, id_paso, nombre, activo,
 tipo_trigger, hora_envio, dias_semana, intervalo_horas, fecha_especifica,
 min_ordenes_pendientes, min_dias_en_paso, monto_minimo, monto_maximo,
 escalar_a_jerarquia, dias_para_escalar, enviar_al_responsable,
 enviar_email, enviar_whatsapp, enviar_telegram)
VALUES
(1, 1, NULL, 'Recordatorio Diario - Pendientes de Autorización', 1,
 'horario', '09:00', '1,2,3,4,5', NULL, NULL,
 1, 1, NULL, NULL,
 0, NULL, 1,
 1, 0, 0),

(2, 1, NULL, 'Escalación - Órdenes sin movimiento 3 días', 1,
 'horario', '10:00', '1,2,3,4,5', NULL, NULL,
 1, 3, NULL, NULL,
 1, 3, 1,
 1, 0, 0);

SET IDENTITY_INSERT config.workflow_recordatorio OFF;

-- =============================================================================
-- 13. RECORDATORIO_CANAL — Templates específicos por canal para cada recordatorio
-- =============================================================================
-- id_recordatorio 1: diario general — email con HTML rico, in_app con texto corto
-- id_recordatorio 2: escalación — email urgente, in_app con alerta

SET IDENTITY_INSERT config.workflow_recordatorio_canal ON;

INSERT INTO config.workflow_recordatorio_canal
(id_recordatorio_canal, id_recordatorio, codigo_canal, asunto_template, cuerpo_template, listado_row_html, activo)
VALUES
-- Recordatorio 1 → Email (HTML rico con tabla)
(1, 1, 'email',
 'Tienes {{CantidadPendientes}} orden(es) pendiente(s) de autorización',
 '<p>Hola <strong>{{NombreResponsable}}</strong>,</p>
<p>Tienes <strong>{{CantidadPendientes}}</strong> orden(es) de compra pendiente(s) de tu revisión/autorización. La más antigua lleva <strong>{{DiasEspera}}</strong> días esperando.</p>
{{ListadoPendientes}}
<p>Por favor accede al sistema para continuar con el proceso.</p>',
 NULL, 1),

-- Recordatorio 1 → In-App (texto corto para notificación interna)
(2, 1, 'in_app',
 NULL,
 '📋 Tienes {{CantidadPendientes}} OC pendiente(s): {{Folios}}',
 NULL, 1),

-- Recordatorio 2 → Email (urgente, escalación)
(3, 2, 'email',
 '⚠️ Alerta: {{CantidadPendientes}} orden(es) sin movimiento por {{DiasEspera}} días',
 '<p>Estimado <strong>{{NombreResponsable}}</strong>,</p>
<p>Las siguientes órdenes llevan <strong>{{DiasEspera}} días</strong> sin movimiento y requieren atención urgente:</p>
{{ListadoPendientes}}
<p><strong>Por favor actúa a la brevedad o delega la acción.</strong></p>',
 NULL, 1),

-- Recordatorio 2 → In-App (alerta urgente)
(4, 2, 'in_app',
 NULL,
 '⚠️ {{CantidadPendientes}} OC lleva(n) {{DiasEspera}} días sin acción: {{Folios}}',
 NULL, 1);

SET IDENTITY_INSERT config.workflow_recordatorio_canal OFF;

-- =============================================================================
-- 14. PLANTILLAS BASE — workflow_notificaciones_plantillas
-- =============================================================================
-- Catálogo de referencia para pre-llenar el editor al crear notificaciones o recordatorios.
-- Organizado por tipo_notificacion × canal.

SET IDENTITY_INSERT config.workflow_notificaciones_plantillas ON;

INSERT INTO config.workflow_notificaciones_plantillas
(id_plantilla, nombre, codigo_tipo_notificacion, codigo_canal, asunto_template, cuerpo_template, listado_row_html, activo)
VALUES

-- =========================================
-- APROBACIÓN
-- =========================================
(1, 'Aprobación - Email estándar', 'aprobacion', 'email',
 'OC {{Folio}} - AUTORIZADA',
 '<p>Hola <strong>{{NombreCreador}}</strong>,</p>
<p>¡Tu orden de compra <strong>{{Folio}}</strong> ha sido <strong>AUTORIZADA</strong>!</p>
<p><strong>Total:</strong> {{Total}}<br><strong>Proveedor:</strong> {{Proveedor}}</p>
{{Comentario}}',
 NULL, 1),

(2, 'Aprobación - In-App', 'aprobacion', 'in_app',
 NULL,
 '✅ OC {{Folio}} autorizada — {{Total}}',
 NULL, 1),

(3, 'Aprobación - WhatsApp', 'aprobacion', 'whatsapp',
 NULL,
 '✅ *OC {{Folio}} AUTORIZADA*\n\nHola {{NombreCreador}}, tu orden por {{Total}} con {{Proveedor}} ha sido autorizada.',
 NULL, 1),

-- =========================================
-- RECHAZO
-- =========================================
(4, 'Rechazo - Email estándar', 'rechazo', 'email',
 'OC {{Folio}} - Rechazada',
 '<p>Hola <strong>{{NombreCreador}}</strong>,</p>
<p>Tu orden de compra <strong>{{Folio}}</strong> fue <strong>rechazada</strong>.</p>
<p><strong>Motivo:</strong> {{Comentario}}</p>
<p>Por favor revisa y corrige la orden.</p>',
 NULL, 1),

(5, 'Rechazo - In-App', 'rechazo', 'in_app',
 NULL,
 '❌ OC {{Folio}} rechazada — {{Comentario}}',
 NULL, 1),

(6, 'Rechazo - WhatsApp', 'rechazo', 'whatsapp',
 NULL,
 '❌ *OC {{Folio}} rechazada*\n\nHola {{NombreCreador}}, tu orden fue rechazada.\nMotivo: {{Comentario}}',
 NULL, 1),

-- =========================================
-- PENDIENTE (aviso al siguiente firmante)
-- =========================================
(7, 'Pendiente - Email estándar', 'pendiente', 'email',
 'OC {{Folio}} - Pendiente tu autorización',
 '<p>Hola <strong>{{NombreSiguiente}}</strong>,</p>
<p>La orden de compra <strong>{{Folio}}</strong> por <strong>{{Total}}</strong> requiere tu revisión/autorización.</p>
<p><strong>Proveedor:</strong> {{Proveedor}}<br><strong>Solicitante:</strong> {{Solicitante}}</p>
{{Comentario}}',
 NULL, 1),

(8, 'Pendiente - In-App', 'pendiente', 'in_app',
 NULL,
 '⏳ OC {{Folio}} pendiente de tu autorización — {{Total}}',
 NULL, 1),

(9, 'Pendiente - WhatsApp', 'pendiente', 'whatsapp',
 NULL,
 '⏳ *OC {{Folio}} pendiente*\n\nHola {{NombreSiguiente}}, tienes una orden de {{Total}} con {{Proveedor}} esperando tu autorización.',
 NULL, 1),

-- =========================================
-- PAGO
-- =========================================
(10, 'Pago - Email estándar', 'pago', 'email',
 'OC {{Folio}} - Pago Realizado',
 '<p>Hola <strong>{{NombreCreador}}</strong>,</p>
<p>Se ha realizado el pago de tu orden de compra <strong>{{Folio}}</strong>.</p>
<p><strong>Importe pagado:</strong> {{ImportePagado}}<br><strong>Proveedor:</strong> {{Proveedor}}</p>
<p>Por favor procede a comprobar el gasto en el sistema.</p>
{{Comentario}}',
 NULL, 1),

(11, 'Pago - In-App', 'pago', 'in_app',
 NULL,
 '💳 Pago realizado — OC {{Folio}} por {{ImportePagado}}',
 NULL, 1),

-- =========================================
-- DEVOLUCIÓN
-- =========================================
(12, 'Devolución - Email estándar', 'devolucion', 'email',
 'OC {{Folio}} - Devuelta a corrección',
 '<p>Hola <strong>{{NombreCreador}}</strong>,</p>
<p>Tu orden de compra <strong>{{Folio}}</strong> fue devuelta para corrección.</p>
<p><strong>Comentarios:</strong> {{Comentario}}</p>',
 NULL, 1),

(13, 'Devolución - In-App', 'devolucion', 'in_app',
 NULL,
 '↩️ OC {{Folio}} devuelta a corrección — {{Comentario}}',
 NULL, 1),

-- =========================================
-- RECORDATORIO
-- =========================================
(14, 'Recordatorio diario - Email', 'recordatorio', 'email',
 'Tienes {{CantidadPendientes}} orden(es) pendiente(s) de autorización',
 '<p>Hola <strong>{{NombreResponsable}}</strong>,</p>
<p>Tienes <strong>{{CantidadPendientes}}</strong> orden(es) de compra pendiente(s) de tu revisión. La más antigua lleva <strong>{{DiasEspera}}</strong> días esperando.</p>
{{ListadoPendientes}}
<p>Por favor accede al sistema para continuar con el proceso.</p>',
 NULL, 1),

(15, 'Recordatorio diario - In-App', 'recordatorio', 'in_app',
 NULL,
 '📋 Tienes {{CantidadPendientes}} OC pendiente(s): {{Folios}}',
 NULL, 1),

(16, 'Recordatorio diario - WhatsApp', 'recordatorio', 'whatsapp',
 NULL,
 '⏰ *Recordatorio de órdenes*\nHola {{NombreResponsable}}, tienes {{CantidadPendientes}} orden(es) pendiente(s).\nFolios: {{Folios}}',
 NULL, 1),

(17, 'Recordatorio urgente (escalación) - Email', 'recordatorio', 'email',
 '⚠️ Alerta: {{CantidadPendientes}} orden(es) sin movimiento por {{DiasEspera}} días',
 '<p>Estimado <strong>{{NombreResponsable}}</strong>,</p>
<p>Las siguientes órdenes llevan <strong>{{DiasEspera}} días</strong> sin movimiento y requieren atención urgente:</p>
{{ListadoPendientes}}
<p><strong>Por favor actúa a la brevedad o delega la acción.</strong></p>',
 NULL, 1),

(18, 'Recordatorio urgente - In-App', 'recordatorio', 'in_app',
 NULL,
 '⚠️ {{CantidadPendientes}} OC lleva(n) {{DiasEspera}} días sin acción: {{Folios}}',
 NULL, 1),

-- =========================================
-- INFO (genérico)
-- =========================================
(19, 'Info general - Email', 'info', 'email',
 'Información sobre OC {{Folio}}',
 '<p>Hola <strong>{{NombreCreador}}</strong>,</p>
<p>{{Comentario}}</p>',
 NULL, 1),

(20, 'Info general - In-App', 'info', 'in_app',
 NULL,
 'ℹ️ OC {{Folio}}: {{Comentario}}',
 NULL, 1);

SET IDENTITY_INSERT config.workflow_notificaciones_plantillas OFF;

-- =============================================================================
-- FIN DEL SEED DATA
-- =============================================================================

PRINT 'Seed data cargado exitosamente.';
PRINT 'Workflow configurado: ORDEN_COMPRA con 5 firmas';
PRINT '- 12 pasos definidos';
PRINT '- 18 acciones de transición';
PRINT '- 9 handlers dinámicos por acción';
PRINT '- 4 campos configurables para UI dinámica';
PRINT '- 2 condiciones dinámicas (Total > $100,000)';
PRINT '- 11 plantillas de notificación';
PRINT '- 10 participantes asignados';
PRINT '- 2 plantillas de canal (email, in_app)';
PRINT '- 2 recordatorios automáticos configurados';
PRINT '- 4 templates de canal para recordatorios (email + in_app x2)';
PRINT '- 20 plantillas base en workflow_notificaciones_plantillas (7 tipos x 2-3 canales)';
