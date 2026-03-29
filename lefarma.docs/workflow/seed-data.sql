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
(id_paso, id_workflow, orden, nombre_paso, codigo_estado, descripcion_ayuda, handler_key, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, activo)
VALUES 
    -- Paso inicial (captura)
    (1, 1, 0, 'Creada', 'CREADA', 'Orden de compra capturada por el usuario', NULL, 1, 0, 0, 0, 0, 1),
    
    -- Firma 2: Gerente General por Sucursal
    (2, 1, 10, 'Firma 2 - Gerente General', 'EN_REVISION_F2', 'Autorización del Gerente General de la Empresa/Sucursal', NULL, 0, 0, 1, 0, 0, 1),
    
    -- Firma 3: CxP (Polo) - Asigna Centro de Costo y Cuenta Contable
    (3, 1, 20, 'Firma 3 - CxP', 'EN_REVISION_F3', 'Revisión de CxP, asignación de centro de costo y cuenta contable', 'Firma3Handler', 0, 0, 1, 0, 0, 1),
    
    -- Firma 4: GAF (Diego) - Configura checks de comprobación
    (4, 1, 30, 'Firma 4 - GAF', 'EN_REVISION_F4', 'Autorización del Gerente de Administración y Finanzas', 'Firma4Handler', 0, 0, 1, 0, 0, 1),
    
    -- Firma 5: Dirección Corporativa (Hector) - Solo para montos > $100k
    (5, 1, 40, 'Firma 5 - Dirección Corporativa', 'EN_REVISION_F5', 'Autorización de Dirección Corporativa para montos mayores a $100,000', NULL, 0, 0, 1, 0, 0, 1),
    
    -- Estados post-autorización
    (6, 1, 50, 'Autorizada', 'AUTORIZADA', 'Orden autorizada, lista para pago', NULL, 0, 0, 0, 0, 0, 1),
    (7, 1, 60, 'En Tesorería', 'EN_TESORERIA', 'Orden en proceso de pago por Tesorería', NULL, 0, 0, 0, 0, 0, 1),
    (8, 1, 70, 'Pagada', 'PAGADA', 'Pago realizado, pendiente de comprobación', NULL, 0, 0, 0, 0, 0, 1),
    (9, 1, 80, 'En Comprobación', 'EN_COMPROBACION', 'Usuario subiendo comprobantes de gasto', NULL, 0, 0, 0, 0, 1, 1),
    (10, 1, 90, 'Cerrada', 'CERRADA', 'Ciclo completo, orden cerrada', NULL, 0, 1, 0, 0, 0, 1),
    
    -- Estados de rechazo
    (11, 1, 100, 'Rechazada', 'RECHAZADA', 'Orden rechazada en alguna firma', NULL, 0, 1, 0, 1, 0, 1),
    (12, 1, 110, 'Cancelada', 'CANCELADA', 'Orden cancelada por el usuario', NULL, 0, 1, 0, 1, 0, 1);

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
-- 5. CONDICIONES (Reglas Dinámicas)
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
-- 6. NOTIFICACIONES (Templates por Acción)
-- =============================================================================
SET IDENTITY_INSERT config.workflow_notificaciones ON;

INSERT INTO config.workflow_notificaciones 
(id_notificacion, id_accion, id_paso_destino, enviar_email, enviar_whatsapp, enviar_telegram, 
 avisar_al_creador, avisar_al_siguiente, avisar_al_anterior, 
 asunto_template, cuerpo_template)
VALUES 
    -- Notificación al autorizar en Firma 2
    (1, 3, NULL, 1, 0, 0, 0, 1, 0,
     'OC {{Folio}} - Pendiente tu autorización (Firma 3)',
     'Hola {{NombreSiguiente}},\n\nLa orden de compra {{Folio}} por un total de ${{Total}} ha sido autorizada por el Gerente General y requiere tu revisión.\n\nProveedor: {{Proveedor}}\nEmpresa: {{Empresa}}\nSolicitante: {{Solicitante}}\n\nIngresa al sistema para autorizar: {{UrlOrden}}'),
    
    -- Notificación al rechazar en Firma 2
    (2, 4, NULL, 1, 0, 0, 1, 0, 0,
     'OC {{Folio}} - Rechazada por Gerente General',
     'Hola {{NombreCreador}},\n\nTu orden de compra {{Folio}} ha sido rechazada por el Gerente General.\n\nMotivo: {{Comentario}}\n\nPor favor, revisa y corrige la orden.'),
    
    -- Notificación al autorizar en Firma 3
    (3, 5, NULL, 1, 0, 0, 0, 1, 0,
     'OC {{Folio}} - Pendiente tu autorización (Firma 4)',
     'Hola {{NombreSiguiente}},\n\nLa orden de compra {{Folio}} por un total de ${{Total}} ha sido autorizada por CxP y requiere tu revisión.\n\nProveedor: {{Proveedor}}\nCentro de Costo: {{CentroCosto}}\nCuenta Contable: {{CuentaContable}}\n\nIngresa al sistema para autorizar: {{UrlOrden}}'),
    
    -- Notificación al rechazar en Firma 3
    (4, 6, NULL, 1, 0, 0, 1, 0, 1,
     'OC {{Folio}} - Rechazada por CxP',
     'Hola {{NombreCreador}},\n\nTu orden de compra {{Folio}} ha sido rechazada por el área de Cuentas por Pagar.\n\nMotivo: {{Comentario}}\n\nPor favor, revisa y corrige la orden.'),
    
    -- Notificación al autorizar en Firma 4 (destino Firma 5, monto > $100k)
    (5, 8, 5, 1, 0, 0, 0, 1, 0,
     'OC {{Folio}} - Pendiente autorización de Dirección Corporativa',
     'Hola {{NombreSiguiente}},\n\nLa orden de compra {{Folio}} por un total de ${{Total}} requiere autorización de Dirección Corporativa por exceder los $100,000.\n\nProveedor: {{Proveedor}}\nEmpresa: {{Empresa}}\n\nIngresa al sistema para autorizar: {{UrlOrden}}'),
    
    -- Notificación al autorizar en Firma 4 (destino Autorizada, monto <= $100k)
    (6, 8, 6, 1, 0, 0, 1, 0, 0,
     'OC {{Folio}} - AUTORIZADA',
     'Hola {{NombreCreador}},\n\n¡Tu orden de compra {{Folio}} ha sido AUTORIZADA!\n\nTotal: ${{Total}}\nProveedor: {{Proveedor}}\n\nLa orden ha sido enviada a Tesorería para el proceso de pago.'),
    
    -- Notificación al rechazar en Firma 4
    (7, 10, NULL, 1, 0, 0, 1, 0, 1,
     'OC {{Folio}} - Rechazada por GAF',
     'Hola {{NombreCreador}},\n\nTu orden de compra {{Folio}} ha sido rechazada por el Gerente de Administración y Finanzas.\n\nMotivo: {{Comentario}}\n\nPor favor, revisa y corrige la orden.'),
    
    -- Notificación al autorizar en Firma 5
    (8, 12, NULL, 1, 0, 0, 1, 1, 0,
     'OC {{Folio}} - AUTORIZADA por Dirección Corporativa',
     'Hola {{NombreCreador}},\n\n¡Tu orden de compra {{Folio}} ha sido AUTORIZADA por Dirección Corporativa!\n\nTotal: ${{Total}}\nProveedor: {{Proveedor}}\n\nLa orden ha sido enviada a Tesorería para el proceso de pago.'),
    
    -- Notificación al rechazar en Firma 5
    (9, 13, NULL, 1, 0, 0, 1, 0, 1,
     'OC {{Folio}} - Rechazada por Dirección Corporativa',
     'Hola {{NombreCreador}},\n\nTu orden de compra {{Folio}} ha sido rechazada por Dirección Corporativa.\n\nMotivo: {{Comentario}}\n\nPor favor, revisa los detalles de la orden.'),
    
    -- Notificación al pagar orden
    (10, 16, NULL, 1, 0, 0, 1, 0, 0,
     'OC {{Folio}} - Pago Realizado',
     'Hola {{NombreCreador}},\n\nSe ha realizado el pago de tu orden de compra {{Folio}}.\n\nImporte Pagado: ${{ImportePagado}}\nProveedor: {{Proveedor}}\n\nPor favor, procede a comprobar el gasto en el sistema.'),
    
    -- Notificación al validar comprobación
    (11, 18, NULL, 1, 0, 0, 1, 0, 0,
     'OC {{Folio}} - Comprobación VALIDADA',
     'Hola {{NombreCreador}},\n\n¡Tu comprobación de la orden {{Folio}} ha sido VALIDADA por CxP!\n\nLa orden ha sido cerrada exitosamente.');

SET IDENTITY_INSERT config.workflow_notificaciones OFF;

-- =============================================================================
-- 7. DATOS DE PRUEBA: Usuario Detalle (Opcional)
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
-- FIN DEL SEED DATA
-- =============================================================================

PRINT 'Seed data cargado exitosamente.';
PRINT 'Workflow configurado: ORDEN_COMPRA con 5 firmas';
PRINT '- 12 pasos definidos';
PRINT '- 18 acciones de transición';
PRINT '- 2 condiciones dinámicas (Total > $100,000)';
PRINT '- 11 plantillas de notificación';
PRINT '- 10 participantes asignados';