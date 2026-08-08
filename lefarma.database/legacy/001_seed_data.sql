-- =============================================================================
-- LEFARMA - SCRIPT CONSOLIDADO DE DATOS INICIALES (SEED DATA)
-- =============================================================================
-- Fecha: 2026-03-27
-- Descripcion: Todos los INSERTs consolidados por tabla
-- Orden de ejecucion: Ejecutar DESPUES de 000_create_tables.sql
-- =============================================================================

USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'INICIANDO SEED DATA';
PRINT '============================================================';
PRINT '';
GO

-- =============================================================================
-- SCHEMA: catalogos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- catalogos.centros_costo
-- -----------------------------------------------------------------------------
PRINT 'Insertando catalogos.centros_costo...';

SET IDENTITY_INSERT catalogos.centros_costo ON;

IF NOT EXISTS (SELECT * FROM catalogos.centros_costo WHERE id_centro_costo = 101)
    INSERT INTO catalogos.centros_costo (id_centro_costo, nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES (101, 'Operaciones', 'operaciones', 'Produccion, Logistica, Almacen', 'produccion logistica almacen', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.centros_costo WHERE id_centro_costo = 102)
    INSERT INTO catalogos.centros_costo (id_centro_costo, nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES (102, 'Administrativo', 'administrativo', 'Recursos Humanos, Contabilidad, Tesoreria', 'recursos humanos contabilidad tesoreria', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.centros_costo WHERE id_centro_costo = 103)
    INSERT INTO catalogos.centros_costo (id_centro_costo, nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES (103, 'Comercial', 'comercial', 'Ventas, Marketing, TLMK', 'ventas marketing tlmk', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.centros_costo WHERE id_centro_costo = 104)
    INSERT INTO catalogos.centros_costo (id_centro_costo, nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES (104, 'Gerencia', 'gerencia', 'Direccion, Calidad, Administracion', 'direccion calidad administracion', 1, GETDATE());

SET IDENTITY_INSERT catalogos.centros_costo OFF;
GO

PRINT 'catalogos.centros_costo: 4 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- catalogos.bancos
-- -----------------------------------------------------------------------------
PRINT 'Insertando catalogos.bancos...';

IF NOT EXISTS (SELECT * FROM catalogos.bancos WHERE nombre = 'BBVA Mexico')
    INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('BBVA Mexico', 'bbva mexico', 'BBVA', 'BANMXMM', 'Banco BBVA Mexico', 'banco bbva mexico', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.bancos WHERE nombre = 'Bancomer')
    INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Bancomer', 'bancomer', 'BANCOMER', 'BMRMXMM', 'Banco Bancomer', 'banco bancomer', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.bancos WHERE nombre = 'Santander')
    INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Santander', 'santander', 'SAN', 'TSMXMXMT', 'Banco Santander Mexico', 'banco santander mexico', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.bancos WHERE nombre = 'Banorte')
    INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Banorte', 'banorte', 'BANORTE', 'BMRMXMT', 'Banco Banorte', 'banco banorte', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.bancos WHERE nombre = 'HSBC')
    INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('HSBC', 'hsbc', 'HSBC', 'HSBCMXMM', 'HSBC Mexico', 'hsbc mexico', 1, GETDATE());
GO

PRINT 'catalogos.bancos: 5 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- catalogos.formas_pago
-- -----------------------------------------------------------------------------
PRINT 'Insertando catalogos.formas_pago...';

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE clave = 'TRANSFERENCIA')
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo, fecha_creacion)
    VALUES ('Transferencia Electronica', 'transferencia electronica', 'Transferencia entre cuentas bancarias', 'transferencia entre cuentas bancarias', 'TRANSFERENCIA', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE clave = 'EFECTIVO')
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo, fecha_creacion)
    VALUES ('Efectivo', 'efectivo', 'Pago en efectivo', 'pago en efectivo', 'EFECTIVO', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE clave = 'CHEQUE')
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo, fecha_creacion)
    VALUES ('Cheque', 'cheque', 'Pago con cheque', 'pago con cheque', 'CHEQUE', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE clave = 'TARJETA')
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo, fecha_creacion)
    VALUES ('Tarjeta de Credito/Debito', 'tarjeta de credito debito', 'Pago con tarjeta', 'pago con tarjeta', 'TARJETA', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE clave = 'DEPOSITO')
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo, fecha_creacion)
    VALUES ('Deposito Bancario', 'deposito bancario', 'Deposito en cuenta bancaria', 'deposito en cuenta bancaria', 'DEPOSITO', 1, GETDATE());
GO

PRINT 'catalogos.formas_pago: 5 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- catalogos.gastos
-- -----------------------------------------------------------------------------
PRINT 'Insertando catalogos.gastos...';

IF NOT EXISTS (SELECT * FROM catalogos.gastos WHERE clave = 'GASTOS_OP')
    INSERT INTO catalogos.gastos (nombre, nombre_normalizado, clave, concepto, cuenta, sub_cuenta, requiere_comprobacion_pago, requiere_comprobacion_gasto, permite_sin_datos_fiscales, dias_limite_comprobacion, activo, fecha_creacion)
    VALUES ('Gastos Operativos', 'gastos operativos', 'GASTOS_OP', 'Gastos de operacion diaria', '601', '001', 1, 1, 0, 5, 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.gastos WHERE clave = 'GASTOS_VIAJE')
    INSERT INTO catalogos.gastos (nombre, nombre_normalizado, clave, concepto, cuenta, sub_cuenta, requiere_comprobacion_pago, requiere_comprobacion_gasto, permite_sin_datos_fiscales, dias_limite_comprobacion, activo, fecha_creacion)
    VALUES ('Gastos de Viaje', 'gastos de viaje', 'GASTOS_VIAJE', 'Viaticos y gastos de viaje', '601', '012', 1, 1, 0, 7, 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.gastos WHERE clave = 'GASTOS_REP')
    INSERT INTO catalogos.gastos (nombre, nombre_normalizado, clave, concepto, cuenta, sub_cuenta, requiere_comprobacion_pago, requiere_comprobacion_gasto, permite_sin_datos_fiscales, dias_limite_comprobacion, activo, fecha_creacion)
    VALUES ('Gastos de Representacion', 'gastos de representacion', 'GASTOS_REP', 'Gastos de representacion y relaciones publicas', '601', '019', 1, 1, 0, 3, 1, GETDATE());
GO

PRINT 'catalogos.gastos: 3 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- catalogos.medidas
-- -----------------------------------------------------------------------------
PRINT 'Insertando catalogos.medidas...';

IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Peso')
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Peso', 'peso', 'Medida de peso/masa', 'medida de peso masa', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Longitud')
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Longitud', 'longitud', 'Medida de longitud/distancia', 'medida de longitud distancia', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Volumen')
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Volumen', 'volumen', 'Medida de volumen/capacidad', 'medida de volumen capacidad', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Tiempo')
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Tiempo', 'tiempo', 'Medida de tiempo/duracion', 'medida de tiempo duracion', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Temperatura')
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Temperatura', 'temperatura', 'Medida de temperatura', 'medida de temperatura', 1, GETDATE());
GO

PRINT 'catalogos.medidas: 5 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- catalogos.medios_pago
-- -----------------------------------------------------------------------------
PRINT 'Insertando catalogos.medios_pago...';

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '01')
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES ('Efectivo', 'efectivo', 'EFEC', '01', 'Pago en efectivo', 'pago en efectivo', 0, 0, 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '02')
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES ('Cheque Nominativo', 'cheque nominativo', 'CHEQ', '02', 'Pago con cheque nominativo', 'pago con cheque nominativo', 1, 0, 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '03')
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, limite_monto, activo, fecha_creacion)
    VALUES ('Transferencia Electronica', 'transferencia electronica', 'TRANSF', '03', 'Transferencia bancaria SPEI', 'transferencia bancaria spei', 1, 0, 1000000, 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '04')
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES ('Tarjeta de Credito', 'tarjeta de credito', 'TDC', '04', 'Pago con tarjeta de credito', 'pago con tarjeta de credito', 1, 0, 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '28')
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES ('Tarjeta de Debito', 'tarjeta de debito', 'TDD', '28', 'Pago con tarjeta de debito', 'pago con tarjeta de debito', 1, 0, 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '99')
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES ('Otros', 'otros', 'OTROS', '99', 'Otros medios de pago', 'otros medios de pago', 1, 1, 1, GETDATE());
GO

PRINT 'catalogos.medios_pago: 6 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- catalogos.estatus_orden
-- -----------------------------------------------------------------------------
PRINT 'Insertando catalogos.estatus_orden...';

IF NOT EXISTS (SELECT * FROM catalogos.estatus_orden WHERE id_estatus_orden = 1)
BEGIN
    INSERT INTO catalogos.estatus_orden (id_estatus_orden, nombre, descripcion, siguiente_estatus_id, requiere_accion, activo, fecha_creacion)
    VALUES
    (1, 'Capturada', 'Pendiente Firma 2', 2, 0, 1, GETDATE()),
    (2, 'Pendiente Firma 2', 'Esperar autorizacion', NULL, 1, 1, GETDATE()),
    (3, 'Autorizada Firma 2', 'Pendiente Firma 3', 4, 0, 1, GETDATE()),
    (4, 'Pendiente Firma 3', 'Esperar asignacion de cuentas', NULL, 1, 1, GETDATE()),
    (5, 'Autorizada Firma 3', 'Pendiente Firma 4', 6, 0, 1, GETDATE()),
    (6, 'Pendiente Firma 4', 'Esperar autorizacion', NULL, 1, 1, GETDATE()),
    (7, 'Autorizada Firma 4', 'Pendiente Firma 5', 8, 0, 1, GETDATE()),
    (8, 'Pendiente Firma 5', 'Esperar autorizacion final', NULL, 1, 1, GETDATE()),
    (9, 'Autorizada Firma 5', 'Pendiente de Pago', 10, 0, 1, GETDATE()),
    (10, 'Pendiente de Pago', 'Tesoreria programa pago', NULL, 1, 1, GETDATE()),
    (11, 'Pagado (parcial)', 'Pendiente de comprobacion', 13, 0, 1, GETDATE()),
    (12, 'Pagado (total)', 'Pendiente de comprobacion', 13, 0, 1, GETDATE()),
    (13, 'Pendiente de Comprobacion', 'Usuario sube comprobantes', NULL, 1, 1, GETDATE()),
    (14, 'Comprobado', 'Pendiente validacion CxP', NULL, 1, 1, GETDATE()),
    (15, 'Validado CxP', 'Cerrado', 16, 0, 1, GETDATE()),
    (16, 'Cerrado', '-', NULL, 0, 1, GETDATE()),
    (99, 'Rechazada', '-', NULL, 0, 1, GETDATE());
END
GO

PRINT 'catalogos.estatus_orden: 17 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- catalogos.regimenes_fiscales
-- -----------------------------------------------------------------------------
PRINT 'Insertando catalogos.regimenes_fiscales...';

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '601' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('601', 'General de Ley Personas Morales', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '603' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('603', 'Personas Morales con Fines no Lucrativos', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '605' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('605', 'Sueldos y Salarios e Ingresos Asimilados a Salarios', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '606' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('606', 'Arrendamiento', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '607' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('607', 'Regimen de Enajenacion o Adquisicion de Bienes', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '608' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('608', 'Demas ingresos', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '609' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('609', 'Consolidacion', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '610' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('610', 'Residentes en el Extranjero sin Establecimiento Permanente en Mexico', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '611' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('611', 'Ingresos por Dividendos (socios y accionistas)', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '612' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('612', 'Personas Fisicas con Actividades Empresariales', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '614' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('614', 'Ingresos por intereses', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '615' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('615', 'Regimen de los ingresos por obtencion de premios', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '616' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('616', 'Sin obligaciones fiscales', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '620' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('620', 'Sociedades Cooperativas de Produccion que optan por diferir sus ingresos', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '621' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('621', 'Incorporacion Fiscal', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '622' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('622', 'Actividades Agricolas, Ganaderas, Silvicolas y Pesqueras', 'Fisica', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '623' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('623', 'Opcional para Grupos de Sociedades', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '624' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('624', 'Coordinados', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '625' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('625', 'Regimen de las Actividades Empresariales con ingresos a traves de Plataformas Tecnologicas', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '626' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('626', 'Regimen Simplificado de Confianza', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '626' AND tipo_persona = 'Fisica')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('626', 'Regimen Simplificado de Confianza', 'Fisica', 1, GETDATE());
GO

PRINT 'catalogos.regimenes_fiscales: ~21 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- catalogos.cuentas_contables
-- -----------------------------------------------------------------------------
PRINT 'Insertando catalogos.cuentas_contables...';

INSERT INTO catalogos.cuentas_contables (cuenta, descripcion, descripcion_normalizada, nivel1, nivel2, activo, fecha_creacion)
SELECT cuenta, descripcion, descripcion_normalizada, nivel1, nivel2, 1, GETDATE()
FROM (
    VALUES
    ('600-000-000-00', 'Gastos', 'gastos', '600', '600-000'),
    ('601-000-000-00', 'Gastos Administrativos', 'gastos administrativos', '601', '601-000'),
    ('601-001-000-00', 'Gastos de Nomina (Percepciones)', 'gastos de nomina percepciones', '601', '601-001'),
    ('601-001-001-01', 'Sueldos y salarios', 'sueldos y salarios', '601', '601-001'),
    ('601-001-002-01', 'Premios de asistencia', 'premios de asistencia', '601', '601-001'),
    ('601-001-003-01', 'Premios de puntualidad', 'premios de puntualidad', '601', '601-001'),
    ('601-001-004-01', 'Vacaciones', 'vacaciones', '601', '601-001'),
    ('601-001-005-01', 'Prima vacacional', 'prima vacacional', '601', '601-001'),
    ('601-002-000-00', 'Deducciones', 'deducciones', '601', '601-002'),
    ('601-002-001-01', 'Cuotas al IMSS', 'cuotas al imss', '601', '601-002'),
    ('601-002-002-01', 'Aportaciones al INFONAVIT', 'aportaciones al infonavit', '601', '601-002'),
    ('601-002-005-01', 'ISR Retenido', 'isr retenido', '601', '601-002'),
    ('601-004-000-00', 'Marketing', 'marketing', '601', '601-004'),
    ('601-007-000-00', 'Oficina', 'oficina', '601', '601-007'),
    ('601-011-000-00', 'Mantenimiento', 'mantenimiento', '601', '601-011'),
    ('601-014-000-00', 'Servicios', 'servicios', '601', '601-014'),
    ('601-017-000-00', 'Logistica y Transporte', 'logistica y transporte', '601', '601-017'),
    ('601-019-000-00', 'Otros', 'otros', '601', '601-019'),
    ('602-000-000-00', 'Gastos Financieros', 'gastos financieros', '602', '602-000'),
    ('603-000-000-00', 'Gastos de Produccion', 'gastos de produccion', '603', '603-000'),
    ('604-000-000-00', 'Gastos Administrativos (Operativos)', 'gastos administrativos operativos', '604', '604-000')
) AS t(cuenta, descripcion, descripcion_normalizada, nivel1, nivel2)
WHERE NOT EXISTS (
    SELECT 1 FROM catalogos.cuentas_contables c WHERE c.cuenta = t.cuenta
);
GO

PRINT 'catalogos.cuentas_contables: ~21 registros insertados (catalogo base)';
GO

-- =============================================================================
-- SCHEMA: config
-- =============================================================================

-- -----------------------------------------------------------------------------
-- config.workflows
-- -----------------------------------------------------------------------------
PRINT 'Insertando config.workflows...';

SET IDENTITY_INSERT config.workflows ON;

IF NOT EXISTS (SELECT * FROM config.workflows WHERE id_workflow = 1)
    INSERT INTO config.workflows (id_workflow, nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES (1, 'Orden de Compra', 'Flujo de autorizacion de 5 firmas para ordenes de compra', 'ORDEN_COMPRA', 1, 1, GETDATE());

SET IDENTITY_INSERT config.workflows OFF;
GO

-- -----------------------------------------------------------------------------
-- config.workflow_pasos
-- -----------------------------------------------------------------------------
PRINT 'Insertando config.workflow_pasos...';

SET IDENTITY_INSERT config.workflow_pasos ON;

IF NOT EXISTS (SELECT * FROM config.workflow_pasos WHERE id_paso = 1)
BEGIN
    INSERT INTO config.workflow_pasos 
    (id_paso, id_workflow, orden, nombre_paso, codigo_estado, descripcion_ayuda, handler_key, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto)
    VALUES 
    (1, 1, 0, 'Creada', 'CREADA', 'Orden de compra capturada por el usuario', NULL, 1, 0, 0, 0, 0),
    (2, 1, 10, 'Firma 2 - Gerente General', 'EN_REVISION_F2', 'Autorizacion del Gerente General de la Empresa/Sucursal', NULL, 0, 0, 1, 0, 0),
    (3, 1, 20, 'Firma 3 - CxP', 'EN_REVISION_F3', 'Revision de CxP, asignacion de centro de costo y cuenta contable', 'Firma3Handler', 0, 0, 1, 0, 0),
    (4, 1, 30, 'Firma 4 - GAF', 'EN_REVISION_F4', 'Autorizacion del Gerente de Administracion y Finanzas', 'Firma4Handler', 0, 0, 1, 0, 0),
    (5, 1, 40, 'Firma 5 - Direccion Corporativa', 'EN_REVISION_F5', 'Autorizacion de Direccion Corporativa para montos mayores a $100,000', NULL, 0, 0, 1, 0, 0),
    (6, 1, 50, 'Autorizada', 'AUTORIZADA', 'Orden autorizada, lista para pago', NULL, 0, 0, 0, 0, 0),
    (7, 1, 60, 'En Tesoreria', 'EN_TESORERIA', 'Orden en proceso de pago por Tesoreria', NULL, 0, 0, 0, 0, 0),
    (8, 1, 70, 'Pagada', 'PAGADA', 'Pago realizado, pendiente de comprobacion', NULL, 0, 0, 0, 0, 0),
    (9, 1, 80, 'En Comprobacion', 'EN_COMPROBACION', 'Usuario subiendo comprobantes de gasto', NULL, 0, 0, 0, 0, 1),
    (10, 1, 90, 'Cerrada', 'CERRADA', 'Ciclo completo, orden cerrada', NULL, 0, 1, 0, 0, 0),
    (11, 1, 100, 'Rechazada', 'RECHAZADA', 'Orden rechazada en alguna firma', NULL, 0, 1, 0, 1, 0),
    (12, 1, 110, 'Cancelada', 'CANCELADA', 'Orden cancelada por el usuario', NULL, 0, 1, 0, 1, 0);
END

SET IDENTITY_INSERT config.workflow_pasos OFF;
GO

PRINT 'config.workflow_pasos: 12 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- config.workflow_participantes
-- -----------------------------------------------------------------------------
PRINT 'Insertando config.workflow_participantes...';

SET IDENTITY_INSERT config.workflow_participantes ON;

IF NOT EXISTS (SELECT * FROM config.workflow_participantes WHERE id_participante = 1)
BEGIN
    INSERT INTO config.workflow_participantes (id_participante, id_paso, id_rol, id_usuario)
    VALUES 
    (1, 1, 5, NULL),
    (2, 2, 10, NULL),
    (5, 3, NULL, 200),
    (6, 4, NULL, 201),
    (7, 5, NULL, 202),
    (8, 7, 15, NULL),
    (9, 9, 5, NULL),
    (10, 9, NULL, 200);
END

SET IDENTITY_INSERT config.workflow_participantes OFF;
GO

PRINT 'config.workflow_participantes: 8 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- config.workflow_acciones
-- -----------------------------------------------------------------------------
PRINT 'Insertando config.workflow_acciones...';

SET IDENTITY_INSERT config.workflow_acciones ON;

IF NOT EXISTS (SELECT * FROM config.workflow_acciones WHERE id_accion = 1)
BEGIN
    INSERT INTO config.workflow_acciones 
    (id_accion, id_paso_origen, id_paso_destino, nombre_accion, tipo_accion, clase_estetica)
    VALUES 
    (1, 1, 2, 'Enviar a autorizacion', 'APROBACION', 'primary'),
    (2, 1, 12, 'Cancelar', 'CANCELACION', 'danger'),
    (3, 2, 3, 'Autorizar', 'APROBACION', 'success'),
    (4, 2, 11, 'Rechazar', 'RECHAZO', 'danger'),
    (5, 3, 4, 'Autorizar', 'APROBACION', 'success'),
    (6, 3, 11, 'Rechazar', 'RECHAZO', 'danger'),
    (7, 3, 1, 'Devolver a correccion', 'RETORNO', 'warning'),
    (8, 4, NULL, 'Autorizar', 'APROBACION', 'success'),
    (10, 4, 11, 'Rechazar', 'RECHAZO', 'danger'),
    (11, 4, 1, 'Devolver a correccion', 'RETORNO', 'warning'),
    (12, 5, 6, 'Autorizar', 'APROBACION', 'success'),
    (13, 5, 11, 'Rechazar', 'RECHAZO', 'danger'),
    (14, 5, 1, 'Devolver a correccion', 'RETORNO', 'warning'),
    (15, 6, 7, 'Enviar a Tesoreria', 'APROBACION', 'primary'),
    (16, 7, 8, 'Marcar como Pagada', 'APROBACION', 'success'),
    (17, 8, 9, 'Iniciar Comprobacion', 'APROBACION', 'primary'),
    (18, 9, 10, 'Validar Comprobacion', 'APROBACION', 'success'),
    (19, 9, 8, 'Rechazar Comprobacion', 'RETORNO', 'warning');
END

SET IDENTITY_INSERT config.workflow_acciones OFF;
GO

PRINT 'config.workflow_acciones: 18 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- config.workflow_condiciones
-- -----------------------------------------------------------------------------
PRINT 'Insertando config.workflow_condiciones...';

SET IDENTITY_INSERT config.workflow_condiciones ON;

IF NOT EXISTS (SELECT * FROM config.workflow_condiciones WHERE id_condicion = 1)
BEGIN
    INSERT INTO config.workflow_condiciones 
    (id_condicion, id_paso, campo_evaluacion, operador, valor_comparacion, id_paso_si_cumple)
    VALUES 
    (1, 4, 'Total', '>', '100000', 5),
    (2, 4, 'Total', '<=', '100000', 6);
END

SET IDENTITY_INSERT config.workflow_condiciones OFF;
GO

PRINT 'config.workflow_condiciones: 2 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- config.workflow_notificaciones
-- -----------------------------------------------------------------------------
PRINT 'Insertando config.workflow_notificaciones...';

SET IDENTITY_INSERT config.workflow_notificaciones ON;

IF NOT EXISTS (SELECT * FROM config.workflow_notificaciones WHERE id_notificacion = 1)
BEGIN
    INSERT INTO config.workflow_notificaciones 
    (id_notificacion, id_accion, id_paso_destino, enviar_email, enviar_whatsapp, enviar_telegram, 
     avisar_al_creador, avisar_al_siguiente, avisar_al_anterior, 
     asunto_template, cuerpo_template)
    VALUES 
    (1, 3, NULL, 1, 0, 0, 0, 1, 0,
     'OC {{Folio}} - Pendiente tu autorizacion (Firma 3)',
     'Hola {{NombreSiguiente}}, la orden de compra {{Folio}} requiere tu revision.'),
    (2, 4, NULL, 1, 0, 0, 1, 0, 0,
     'OC {{Folio}} - Rechazada por Gerente General',
     'Hola {{NombreCreador}}, tu orden de compra {{Folio}} ha sido rechazada.'),
    (3, 5, NULL, 1, 0, 0, 0, 1, 0,
     'OC {{Folio}} - Pendiente tu autorizacion (Firma 4)',
     'Hola {{NombreSiguiente}}, la orden de compra {{Folio}} requiere tu revision.'),
    (6, 8, 6, 1, 0, 0, 1, 0, 0,
     'OC {{Folio}} - AUTORIZADA',
     'Hola {{NombreCreador}}, tu orden de compra {{Folio}} ha sido AUTORIZADA!'),
    (8, 12, NULL, 1, 0, 0, 1, 1, 0,
     'OC {{Folio}} - AUTORIZADA por Direccion Corporativa',
     'Hola {{NombreCreador}}, tu orden de compra {{Folio}} ha sido AUTORIZADA!'),
    (10, 16, NULL, 1, 0, 0, 1, 0, 0,
     'OC {{Folio}} - Pago Realizado',
     'Hola {{NombreCreador}}, se ha realizado el pago de tu orden de compra {{Folio}}.'),
    (11, 18, NULL, 1, 0, 0, 1, 0, 0,
     'OC {{Folio}} - Comprobacion VALIDADA',
     'Hola {{NombreCreador}}, tu comprobacion ha sido VALIDADA!');
END

SET IDENTITY_INSERT config.workflow_notificaciones OFF;
GO

PRINT 'config.workflow_notificaciones: 7 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- config.usuario_detalle
-- -----------------------------------------------------------------------------
PRINT 'Insertando config.usuario_detalle...';

IF NOT EXISTS (SELECT * FROM config.usuario_detalle WHERE id_usuario = 200)
BEGIN
    INSERT INTO config.usuario_detalle 
    (id_usuario, id_empresa, id_sucursal, id_area, id_centro_costo, puesto, numero_empleado, 
     celular, canal_preferido, notificar_email, notificar_app, notificar_resumen_diario, 
     tema_interfaz, dashboard_inicio, elementos_por_pagina)
    VALUES 
    (200, 5, 1, 2, 102, 'Contador de Cuentas por Pagar', 'EMP-200', 
     '5512345678', 'email', 1, 1, 1, 'light', 'cxp', 20),
    (201, 5, 1, 2, 104, 'Gerente de Administracion y Finanzas', 'EMP-201', 
     '5523456789', 'email', 1, 1, 1, 'light', 'autorizador', 20),
    (202, 5, 1, 4, 104, 'Director Corporativo', 'EMP-202', 
     '5534567890', 'email', 1, 1, 1, 'light', 'autorizador', 10);
END
GO

PRINT 'config.usuario_detalle: 3 registros insertados';
GO

-- =============================================================================
-- SCHEMA: help
-- =============================================================================

-- -----------------------------------------------------------------------------
-- help.HelpModules
-- -----------------------------------------------------------------------------
PRINT 'Insertando help.HelpModules...';

IF NOT EXISTS (SELECT * FROM [help].HelpModules WHERE nombre = 'General')
BEGIN
    INSERT INTO [help].HelpModules (nombre, label, orden) VALUES
    ('General', 'General', 1),
    ('Catalogos', 'Catalogos', 2),
    ('Auth', 'Autenticacion', 3),
    ('Notificaciones', 'Notificaciones', 4),
    ('Profile', 'Perfil', 5),
    ('Admin', 'Administracion', 6),
    ('SystemConfig', 'Configuracion', 7);
END
GO

PRINT 'help.HelpModules: 7 registros insertados';
GO

-- -----------------------------------------------------------------------------
-- help.HelpArticles
-- -----------------------------------------------------------------------------
PRINT 'Insertando help.HelpArticles...';

IF NOT EXISTS (SELECT * FROM [help].HelpArticles WHERE titulo = 'Bienvenido al Sistema de Ayuda')
BEGIN
    INSERT INTO [help].HelpArticles (titulo, contenido, resumen, modulo_id, modulo, tipo, categoria, orden, creado_por) VALUES
    ('Bienvenido al Sistema de Ayuda', '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Bienvenido al sistema de ayuda de Lefarma.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}', 'Guia de inicio', 1, 'General', 'usuario', 'Inicio', 1, 'sistema'),
    ('Gestion de Catalogos', '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"El modulo de Catalogos permite administrar los datos maestros.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}', 'Administra datos maestros', 2, 'Catalogos', 'usuario', 'Gestion', 1, 'sistema'),
    ('Como iniciar sesion', '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Ingresa tu usuario y contraseña en la pantalla de login.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}', 'Guia de autenticacion', 3, 'Auth', 'usuario', 'Acceso', 1, 'sistema');
END
GO

PRINT 'help.HelpArticles: 3 registros insertados';
GO

-- =============================================================================
-- RESUMEN FINAL
-- =============================================================================
PRINT '';
PRINT '================================================================';
PRINT 'SEED DATA COMPLETADO';
PRINT '================================================================';
PRINT '';
PRINT 'DATOS INSERTADOS POR SCHEMA:';
PRINT '';
PRINT 'catalogos:';
PRINT '  - centros_costo: 4 registros';
PRINT '  - bancos: 5 registros';
PRINT '  - formas_pago: 5 registros';
PRINT '  - gastos: 3 registros';
PRINT '  - medidas: 5 registros';
PRINT '  - medios_pago: 6 registros';
PRINT '  - estatus_orden: 17 registros';
PRINT '  - regimenes_fiscales: ~21 registros';
PRINT '  - cuentas_contables: ~21 registros (base)';
PRINT '';
PRINT 'config:';
PRINT '  - workflows: 1 registro';
PRINT '  - workflow_pasos: 12 registros';
PRINT '  - workflow_participantes: 8 registros';
PRINT '  - workflow_acciones: 18 registros';
PRINT '  - workflow_condiciones: 2 registros';
PRINT '  - workflow_notificaciones: 7 registros';
PRINT '  - usuario_detalle: 3 registros';
PRINT '';
PRINT 'help:';
PRINT '  - HelpModules: 7 registros';
PRINT '  - HelpArticles: 3 registros';
PRINT '';
PRINT 'NOTA: catalogos.areas, catalogos.empresas, catalogos.sucursales';
PRINT '      se llenan por operacion o migracion de datos existentes';
PRINT '================================================================';
GO
