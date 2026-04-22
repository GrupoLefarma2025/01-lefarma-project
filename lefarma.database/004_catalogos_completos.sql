-- =============================================================================
-- LEFARMA - CATALOGOS COMPLETOS (DROP + SEED)
-- =============================================================================
-- Fuente: lefarma.docs/Documentacion/specs.md (Version 2.0, Marzo 2026)
-- Ejecutar DESPUES de 000_create_tables.sql
-- Orden de dependencias: medidas -> tipos_medida -> unidades_medida
--                        centros_costo -> cuentas_contables
--                        tipos_impuesto -> estatus_orden -> gastos -> areas
-- =============================================================================

USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'CATALOGOS COMPLETOS - INICIANDO SEED';
PRINT '============================================================';
PRINT '';
GO

-- =============================================================================
-- PASO 1: LIMPIAR TODAS LAS TABLAS (en orden inverso de dependencias)
-- =============================================================================

PRINT 'Limpiando catalogos.areas...';
DELETE FROM catalogos.areas;
GO

PRINT 'Limpiando catalogos.gastos...';
DELETE FROM catalogos.gastos;
GO

PRINT 'Limpiando catalogos.cuentas_contables...';
DELETE FROM catalogos.cuentas_contables;
GO

PRINT 'Limpiando catalogos.unidades_medida...';
DELETE FROM catalogos.unidades_medida;
GO

PRINT 'Limpiando catalogos.medidas...';
DELETE FROM catalogos.medidas;
GO

PRINT 'Limpiando catalogos.tipos_impuesto...';
DELETE FROM catalogos.tipos_impuesto;
GO

PRINT 'Limpiando catalogos.estatus_orden...';
DELETE FROM catalogos.estatus_orden;
GO

PRINT 'Limpiando catalogos.tipos_medida...';
DELETE FROM catalogos.tipos_medida;
GO

PRINT '';
PRINT 'CATALOGOS LIMPIADOS - Iniciando INSERTs';
PRINT '';
GO

-- =============================================================================
-- PASO 2: CATALOGOS.MEDIDAS (categorias de unidades de medida)
-- seeded from: 001_seed_data.sql
-- =============================================================================
PRINT 'Insertando catalogos.medidas...';

INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
VALUES
    (N'Peso', N'peso', N'Medida de peso/masa', N'medida de peso masa', 1, GETDATE()),
    (N'Longitud', N'longitud', N'Medida de longitud/distancia', N'medida de longitud distancia', 1, GETDATE()),
    (N'Volumen', N'volumen', N'Medida de volumen/capacidad', N'medida de volumen capacidad', 1, GETDATE()),
    (N'Tiempo', N'tiempo', N'Medida de tiempo/duracion', N'medida de tiempo duracion', 1, GETDATE()),
    (N'Temperatura', N'temperatura', N'Medida de temperatura', N'medida de temperatura', 1, GETDATE());
GO

PRINT 'catalogos.medidas: 5 registros insertados';
GO

-- =============================================================================
-- PASO 3: CATALOGOS.TIPOS_MEDIDA (tipos de unidad de medida)
-- specs.md Section 14: Piezas, Servicio, Kilos, Litros, Metros, Horas, Cajas, Kilowatts
-- =============================================================================
PRINT 'Insertando catalogos.tipos_medida...';

SET IDENTITY_INSERT catalogos.tipos_medida ON;

INSERT INTO catalogos.tipos_medida (id_tipo_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
VALUES
    (1, N'Piezas', N'piezas', N'Unidades individuales', N'unidades individuales', 1, GETDATE()),
    (2, N'Servicio', N'servicio', N'Servicios prestados', N'servicios prestados', 1, GETDATE()),
    (3, N'Kilos', N'kilos', N'Peso en kilogramos', N'peso en kilogramos', 1, GETDATE()),
    (4, N'Litros', N'litros', N'Volumen en litros', N'volumen en litros', 1, GETDATE()),
    (5, N'Metros', N'metros', N'Longitud en metros', N'longitud en metros', 1, GETDATE()),
    (6, N'Horas', N'horas', N'Tiempo en horas', N'tiempo en horas', 1, GETDATE()),
    (7, N'Cajas', N'cajas', N'Cajas/empaques', N'cajas empaques', 1, GETDATE()),
    (8, N'Kilowatts', N'kilowatts', N'Energia', N'energia', 1, GETDATE());

SET IDENTITY_INSERT catalogos.tipos_medida OFF;
GO

PRINT 'catalogos.tipos_medida: 8 registros insertados';
GO

-- =============================================================================
-- PASO 4: CATALOGOS.UNIDADES_MEDIDA (unidades de medida por tipo)
-- specs.md Section 14
-- =============================================================================
PRINT 'Insertando catalogos.unidades_medida...';

SET IDENTITY_INSERT catalogos.unidades_medida ON;

INSERT INTO catalogos.unidades_medida (id_unidad_medida, id_tipo_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
VALUES
    (1, 1, N'Piezas', N'piezas', N'Unidades individuales', N'unidades individuales', N'pza', 1, GETDATE()),
    (2, 2, N'Servicio', N'servicio', N'Servicios prestados', N'servicios prestados', N'serv', 1, GETDATE()),
    (3, 3, N'Kilogramo', N'kilogramo', N'Peso en kilogramos', N'peso en kilogramos', N'kg', 1, GETDATE()),
    (4, 4, N'Litro', N'litro', N'Volumen en litros', N'volumen en litros', N'lt', 1, GETDATE()),
    (5, 5, N'Metro', N'metro', N'Longitud en metros', N'longitud en metros', N'm', 1, GETDATE()),
    (6, 6, N'Hora', N'hora', N'Tiempo en horas', N'tiempo en horas', N'hr', 1, GETDATE()),
    (7, 7, N'Caja', N'caja', N'Cajas/empaques', N'cajas empaques', N'cja', 1, GETDATE()),
    (8, 8, N'Kilowatt', N'kilowatt', N'Energia electrica', N'energia electrica', N'kw', 1, GETDATE());

SET IDENTITY_INSERT catalogos.unidades_medida OFF;
GO

PRINT 'catalogos.unidades_medida: 8 registros insertados';
GO

-- =============================================================================
-- PASO 5: CATALOGOS.CENTROS_COSTO
-- specs.md Section 9: 101-Operaciones, 102-Administrativo, 103-Comercial, 104-Gerencia
-- =============================================================================
PRINT 'Insertando catalogos.centros_costo...';

SET IDENTITY_INSERT catalogos.centros_costo ON;

INSERT INTO catalogos.centros_costo (id_centro_costo, nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
VALUES
    (101, N'Operaciones', N'operaciones', N'Produccion, Logistica, Almacen', N'produccion logistica almacen', 1, GETDATE()),
    (102, N'Administrativo', N'administrativo', N'Recursos Humanos, Contabilidad, Tesoreria', N'recursos humanos contabilidad tesoreria', 1, GETDATE()),
    (103, N'Comercial', N'comercial', N'Ventas, Marketing, TLMK', N'ventas marketing tlmk', 1, GETDATE()),
    (104, N'Gerencia', N'gerencia', N'Direccion, Calidad, Administracion', N'direccion calidad administracion', 1, GETDATE());

SET IDENTITY_INSERT catalogos.centros_costo OFF;
GO

PRINT 'catalogos.centros_costo: 4 registros insertados';
GO

-- =============================================================================
-- PASO 6: CATALOGOS.TIPOS_IMPUESTO
-- specs.md Section 14: IVA 16%, IVA 8%, 0%, IEPS, ISR
-- =============================================================================
PRINT 'Insertando catalogos.tipos_impuesto...';

SET IDENTITY_INSERT catalogos.tipos_impuesto ON;

INSERT INTO catalogos.tipos_impuesto (id_tipo_impuesto, nombre, nombre_normalizado, clave, tasa, descripcion, descripcion_normalizada, activo, fecha_creacion)
VALUES
    (1, N'IVA 16%', N'iva 16', N'IVA16', 0.1600, N'Impuesto al Valor Agregado 16%', N'impuesto al valor agregado 16', 1, GETDATE()),
    (2, N'IVA 8%', N'iva 8', N'IVA8', 0.0800, N'Impuesto al Valor Agregado 8%', N'impuesto al valor agregado 8', 1, GETDATE()),
    (3, N'IVA 0%', N'iva 0', N'IVA0', 0.0000, N'Impuesto al Valor Agregado 0%', N'impuesto al valor agregado 0', 1, GETDATE()),
    (4, N'IEPS', N'ieps', N'IEPS', 0.0000, N'Impuesto Especial sobre Productos y Servicios', N'impuesto especial sobre productos y servicios', 1, GETDATE()),
    (5, N'ISR', N'isr', N'ISR', 0.0000, N'Impuesto Sobre la Renta', N'impuesto sobre la renta', 1, GETDATE());

SET IDENTITY_INSERT catalogos.tipos_impuesto OFF;
GO

PRINT 'catalogos.tipos_impuesto: 5 registros insertados';
GO

-- =============================================================================
-- PASO 7: CATALOGOS.ESTATUS_ORDEN
-- specs.md Section 13: 17 estatus (1-16 + 99)
-- =============================================================================
PRINT 'Insertando catalogos.estatus_orden...';

INSERT INTO catalogos.estatus_orden (id_estatus_orden, nombre, descripcion, siguiente_estatus_id, requiere_accion, activo, fecha_creacion)
VALUES
    (1, N'Capturada', N'Pendiente Firma 2', 2, 0, 1, GETDATE()),
    (2, N'Pendiente Firma 2', N'Esperar autorizacion', NULL, 1, 1, GETDATE()),
    (3, N'Autorizada Firma 2', N'Pendiente Firma 3', 4, 0, 1, GETDATE()),
    (4, N'Pendiente Firma 3', N'Esperar asignacion de cuentas', NULL, 1, 1, GETDATE()),
    (5, N'Autorizada Firma 3', N'Pendiente Firma 4', 6, 0, 1, GETDATE()),
    (6, N'Pendiente Firma 4', N'Esperar autorizacion', NULL, 1, 1, GETDATE()),
    (7, N'Autorizada Firma 4', N'Pendiente Firma 5', 8, 0, 1, GETDATE()),
    (8, N'Pendiente Firma 5', N'Esperar autorizacion final', NULL, 1, 1, GETDATE()),
    (9, N'Autorizada Firma 5', N'Pendiente de Pago', 10, 0, 1, GETDATE()),
    (10, N'Pendiente de Pago', N'Tesoreria programa pago', NULL, 1, 1, GETDATE()),
    (11, N'Pagado (parcial)', N'Pendiente de comprobacion', 13, 0, 1, GETDATE()),
    (12, N'Pagado (total)', N'Pendiente de comprobacion', 13, 0, 1, GETDATE()),
    (13, N'Pendiente de Comprobacion', N'Usuario sube comprobantes', NULL, 1, 1, GETDATE()),
    (14, N'Comprobado', N'Pendiente validacion CxP', NULL, 1, 1, GETDATE()),
    (15, N'Validado CxP', N'Cerrado', 16, 0, 1, GETDATE()),
    (16, N'Cerrado', N'-', NULL, 0, 1, GETDATE()),
    (99, N'Rechazada', N'-', NULL, 0, 1, GETDATE());
GO

PRINT 'catalogos.estatus_orden: 17 registros insertados';
GO

-- =============================================================================
-- PASO 8: CATALOGOS.CUENTAS_CONTABLES (COMPLETO - specs.md Sections 10.4 y 10.5)
-- ALL ~130+ cuentas: 600 series + 601-xxx + 602-xxx + 603-xxx + 604-xxx
-- centro_costo_id: NULL para cuentas sin prefijo de empresa en specs
-- =============================================================================
PRINT 'Insertando catalogos.cuentas_contables (catalogo completo)...';

INSERT INTO catalogos.cuentas_contables (cuenta, descripcion, descripcion_normalizada, nivel1, nivel2, empresa_prefijo, centro_costo_id, activo, fecha_creacion)
SELECT cuenta, descripcion, descripcion_normalizada, nivel1, nivel2, empresa_prefijo, centro_costo_id, 1, GETDATE()
FROM (
    VALUES
    -- =================================================================
    -- 600 SERIES (Gastos - Primer nivel)
    -- specs.md Section 10.3 y 10.5
    -- =================================================================
    (N'600-000-000-00', N'Gastos', N'gastos', N'600', N'600-000', NULL, NULL),
    (N'601-000-000-00', N'Gastos Administrativos', N'gastos administrativos', N'601', N'601-000', NULL, NULL),
    (N'602-000-000-00', N'Gastos Financieros', N'gastos financieros', N'602', N'602-000', NULL, NULL),
    (N'603-000-000-00', N'Gastos de Produccion', N'gastos de produccion', N'603', N'603-000', NULL, NULL),
    (N'604-000-000-00', N'Gastos Administrativos (Operativos)', N'gastos administrativos operativos', N'604', N'604-000', NULL, NULL),

    -- =================================================================
    -- 601-001 - Gastos de Nomina (Percepciones) - COMPLETO (22 items)
    -- specs.md Section 10.4
    -- =================================================================
    (N'601-001-000-00', N'Gastos de Nomina (Percepciones)', N'gastos de nomina percepciones', N'601', N'601-001', NULL, NULL),
    (N'601-001-001-01', N'Sueldos y salarios', N'sueldos y salarios', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-002-01', N'Premios de asistencia', N'premios de asistencia', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-003-01', N'Premios de puntualidad', N'premios de puntualidad', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-004-01', N'Vacaciones', N'vacaciones', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-005-01', N'Prima vacacional', N'prima vacacional', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-006-01', N'Prima dominical', N'prima dominical', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-007-01', N'Gratificaciones', N'gratificaciones', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-008-01', N'Primas de antiguedad', N'primas de antiguedad', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-009-01', N'Aguinaldo', N'aguinaldo', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-010-01', N'Transporte', N'transporte', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-011-01', N'PTU', N'ptu', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-012-01', N'Aportaciones', N'aportaciones', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-013-01', N'Prevision social', N'prevision social', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-014-01', N'Aportaciones plan de jubilacion', N'aportaciones plan de jubilacion', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-015-01', N'Apoyo Automovil', N'apoyo automobil', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-016-01', N'Apoyo de Gasolina', N'apoyo de gasolina', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-017-01', N'Apoyo Productividad', N'apoyo productividad', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-018-01', N'Bono', N'bono', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-019-01', N'Apoyo Mantenimiento de auto', N'apoyo mantenimiento de auto', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-020-01', N'Apoyo de Tramites Vehiculares', N'apoyo de tramites vehiculares', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-021-01', N'Apoyo de Estacionamiento', N'apoyo de estacionamiento', N'601', N'601-001', N'ATC-103-101', 101),
    (N'601-001-022-01', N'Uniformes', N'uniformes', N'601', N'601-001', N'ATC-103-101', 101),

    -- =================================================================
    -- 601-002 - Deducciones - COMPLETO (9 items)
    -- specs.md Section 10.4
    -- =================================================================
    (N'601-002-000-00', N'Deducciones', N'deducciones', N'601', N'601-002', NULL, NULL),
    (N'601-002-001-01', N'Cuotas al IMSS', N'cuotas al imss', N'601', N'601-002', N'ATC-103-101', 101),
    (N'601-002-002-01', N'Aportaciones al INFONAVIT', N'aportaciones al infonavit', N'601', N'601-002', N'ATC-103-101', 101),
    (N'601-002-003-01', N'Aportaciones al SAR', N'aportaciones al sar', N'601', N'601-002', N'ATC-103-101', 101),
    (N'601-002-004-01', N'Otras aportaciones', N'otras aportaciones', N'601', N'601-002', N'ATC-103-101', 101),
    (N'601-002-005-01', N'ISR Retenido', N'isr retenido', N'601', N'601-002', N'ATC-103-101', 101),
    (N'601-002-006-01', N'ISN', N'isn', N'601', N'601-002', N'ATC-103-101', 101),
    (N'601-002-007-01', N'FONACOT', N'fonacot', N'601', N'601-002', N'ATC-103-101', 101),
    (N'601-002-008-01', N'Prestamos', N'prestamos', N'601', N'601-002', N'ATC-103-101', 101),
    (N'601-002-009-01', N'Otras Retenciones', N'otras retenciones', N'601', N'601-002', N'ATC-103-101', 101),

    -- =================================================================
    -- 601-003 - Indemnizaciones
    -- specs.md Section 10.4
    -- =================================================================
    (N'601-003-000-00', N'Indemnizaciones', N'indemnizaciones', N'601', N'601-003', NULL, NULL),
    (N'601-003-001-01', N'Indemnizaciones', N'indemnizaciones', N'601', N'601-003', N'ATC-103-101', 101),

    -- =================================================================
    -- 601-004 - Marketing - COMPLETO (4 items)
    -- specs.md Section 10.4
    -- =================================================================
    (N'601-004-000-00', N'Marketing', N'marketing', N'601', N'601-004', NULL, NULL),
    (N'601-004-001-01', N'Cursos y Capacitaciones', N'cursos y capacitaciones', N'601', N'601-004', N'ATC-103-101', 101),
    (N'601-004-002-01', N'Beneficios IMSS', N'beneficios imss', N'601', N'601-004', N'ATC-103-101', 101),
    (N'601-004-003-01', N'Cafeteria', N'cafeteria', N'601', N'601-004', N'ATC-103-101', 101),
    (N'601-004-004-01', N'Donativos', N'donativos', N'601', N'601-004', N'ATC-103-101', 101),

    -- =================================================================
    -- 601-005 a 601-022 - Todas las cuentas de nivel 2 (specs.md Section 10.5)
    -- =================================================================
    (N'601-005-000-00', N'Inversiones', N'inversiones', N'601', N'601-005', NULL, NULL),
    (N'601-006-000-00', N'Activo Intangible', N'activo intangible', N'601', N'601-006', NULL, NULL),
    (N'601-007-000-00', N'Oficina', N'oficina', N'601', N'601-007', NULL, NULL),
    (N'601-008-000-00', N'Impuestos', N'impuestos', N'601', N'601-008', NULL, NULL),
    (N'601-009-000-00', N'Insumos', N'insumos', N'601', N'601-009', NULL, NULL),
    (N'601-010-000-00', N'Licencias y Permisos', N'licencias y permisos', N'601', N'601-010', NULL, NULL),
    (N'601-011-000-00', N'Mantenimiento', N'mantenimiento', N'601', N'601-011', NULL, NULL),
    (N'601-012-000-00', N'Reembolsos', N'reembolsos', N'601', N'601-012', NULL, NULL),
    (N'601-013-000-00', N'Seguros', N'seguros', N'601', N'601-013', NULL, NULL),
    (N'601-014-000-00', N'Servicios', N'servicios', N'601', N'601-014', NULL, NULL),
    (N'601-017-000-00', N'Logistica y Transporte', N'logistica y transporte', N'601', N'601-017', NULL, NULL),
    (N'601-019-000-00', N'Otros', N'otros', N'601', N'601-019', NULL, NULL),

    -- =================================================================
    -- 602 SERIES - Gastos Financieros (specs.md Section 10.5)
    -- =================================================================
    (N'602-001-000-00', N'Gastos de Nomina (Financieros)', N'gastos de nomina financieros', N'602', N'602-001', NULL, NULL),
    (N'602-002-000-00', N'Deducciones (Financieros)', N'deducciones financieros', N'602', N'602-002', NULL, NULL),
    (N'602-003-000-00', N'Indemnizaciones (Financieros)', N'indemnizaciones financieros', N'602', N'602-003', NULL, NULL),
    (N'602-004-000-00', N'Marketing (Financieros)', N'marketing financieros', N'602', N'602-004', NULL, NULL),
    (N'602-019-000-00', N'Otros (Financieros)', N'otros financieros', N'602', N'602-019', NULL, NULL),

    -- =================================================================
    -- 603 SERIES - Gastos de Produccion (specs.md Section 10.5)
    -- =================================================================
    (N'603-001-000-00', N'Gastos de Nomina (Produccion)', N'gastos de nomina produccion', N'603', N'603-001', NULL, NULL),
    (N'603-002-000-00', N'Deducciones (Produccion)', N'deducciones produccion', N'603', N'603-002', NULL, NULL),
    (N'603-003-000-00', N'Indemnizaciones (Produccion)', N'indemnizaciones produccion', N'603', N'603-003', NULL, NULL),
    (N'603-005-000-00', N'Inversiones (Produccion)', N'inversiones produccion', N'603', N'603-005', NULL, NULL),
    (N'603-014-000-00', N'Servicios (Mano de Obra)', N'servicios mano de obra', N'603', N'603-014', NULL, NULL),
    (N'603-019-000-00', N'Otros (Produccion)', N'otros produccion', N'603', N'603-019', NULL, NULL),
    (N'603-020-000-00', N'Materia Prima', N'materia prima', N'603', N'603-020', NULL, NULL),
    (N'603-021-000-00', N'Cargos Indirectos', N'cargos indirectos', N'603', N'603-021', NULL, NULL),

    -- =================================================================
    -- 604 SERIES - Gastos Administrativos (Operativos) (specs.md Section 10.5)
    -- =================================================================
    (N'604-001-000-00', N'Gastos de Nomina (Administrativo)', N'gastos de nomina administrativo', N'604', N'604-001', NULL, NULL),
    (N'604-002-000-00', N'Deducciones (Administrativo)', N'deducciones administrativo', N'604', N'604-002', NULL, NULL),
    (N'604-003-000-00', N'Indemnizaciones (Administrativo)', N'indemnizaciones administrativo', N'604', N'604-003', NULL, NULL),
    (N'604-005-000-00', N'Inversiones (Administrativo)', N'inversiones administrativo', N'604', N'604-005', NULL, NULL),
    (N'604-019-000-00', N'Otros (Administrativo)', N'otros administrativo', N'604', N'604-019', NULL, NULL),
    (N'604-020-000-00', N'Materia Prima (Administrativo)', N'materia prima administrativo', N'604', N'604-020', NULL, NULL),
    (N'604-021-000-00', N'Gastos Indirectos', N'gastos indirectos', N'604', N'604-021', NULL, NULL),
    (N'604-022-000-00', N'Investigacion y Desarrollo', N'investigacion y desarrollo', N'604', N'604-022', NULL, NULL)
) AS t(cuenta, descripcion, descripcion_normalizada, nivel1, nivel2, empresa_prefijo, centro_costo_id)
WHERE NOT EXISTS (SELECT 1 FROM catalogos.cuentas_contables c WHERE c.cuenta = t.cuenta);
GO

PRINT 'catalogos.cuentas_contables: todos los registros insertados';
GO

-- =============================================================================
-- PASO 9: CATALOGOS.GASTOS (Tipos de Gasto)
-- specs.md Section 11: Fijo, Variable, Extraordinario
-- =============================================================================
PRINT 'Insertando catalogos.gastos...';

INSERT INTO catalogos.gastos (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, concepto, cuenta, sub_cuenta, requiere_comprobacion_pago, requiere_comprobacion_gasto, permite_sin_datos_fiscales, dias_limite_comprobacion, activo, fecha_creacion)
VALUES
    (N'Fijo', N'fijo', N'Gastos recurrentes (renta, nomina, servicios)', N'gastos recurrentes renta nomina servicios', N'FIJO', N'Gastos recurrentes', N'601', N'000', 1, 1, 0, 5, 1, GETDATE()),
    (N'Variable', N'variable', N'Gastos segun operacion (materiales, insumos)', N'gastos segun operacion materiales insumos', N'VARIABLE', N'Gastos de operacion', N'601', N'009', 1, 1, 0, 7, 1, GETDATE()),
    (N'Extraordinario', N'extraordinario', N'Gastos no planeados o one-time', N'gastos no planeados one-time', N'EXTRAORDINARIO', N'Gastos eventuales', N'601', N'019', 1, 1, 1, 3, 1, GETDATE());
GO

PRINT 'catalogos.gastos: 3 registros insertados';
GO

-- =============================================================================
-- PASO 10: CATALOGOS.AREAS (todas las areas para cada empresa)
-- specs.md Section 12: 10 areas
-- Empresa IDs: 1=Asokam, 2=Lefarma, 3=Artricenter, 4=Construmedika, 5=GrupoLefarma
-- Se insertan areas para TODAS las empresas del grupo
-- =============================================================================
PRINT 'Insertando catalogos.areas (todas las empresas)...';

INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, numero_empleados, activo, fecha_creacion)
SELECT id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, 0, 1, GETDATE()
FROM (
    -- Asokam (id_empresa = 1)
    VALUES (1, N'Recursos Humanos', N'recursos humanos', N'Gestion de personal y nomina', N'gestion de personal y nomina', N'RH', 0),
           (1, N'Contabilidad', N'contabilidad', N'Registro y control contable', N'registro y control contable', N'CONT', 0),
           (1, N'Tesoreria', N'tesoreria', N'Administracion de efectivo y bancos', N'administracion de efectivo y bancos', N'TES', 0),
           (1, N'Compras', N'compras', N'Adquisicion de materiales y servicios', N'adquisicion de materiales y servicios', N'COMP', 0),
           (1, N'Almacen', N'almacen', N'Control de inventarios', N'control de inventarios', N'ALM', 0),
           (1, N'Produccion', N'produccion', N'Operaciones de manufactura', N'operaciones de manufactura', N'PROD', 0),
           (1, N'Ventas', N'ventas', N'Comercializacion de productos', N'comercializacion de productos', N'VENT', 0),
           (1, N'Marketing', N'marketing', N'Promocion y publicidad', N'promocion y publicidad', N'MARK', 0),
           (1, N'Tecnologia', N'tecnologia', N'Sistemas y TI', N'sistemas y ti', N'TI', 0),
           (1, N'Calidad', N'calidad', N'Control de calidad y certificaciones', N'control de calidad y certificaciones', N'CAL', 0),
    -- Lefarma (id_empresa = 2)
           (2, N'Recursos Humanos', N'recursos humanos', N'Gestion de personal y nomina', N'gestion de personal y nomina', N'RH', 0),
           (2, N'Contabilidad', N'contabilidad', N'Registro y control contable', N'registro y control contable', N'CONT', 0),
           (2, N'Tesoreria', N'tesoreria', N'Administracion de efectivo y bancos', N'administracion de efectivo y bancos', N'TES', 0),
           (2, N'Compras', N'compras', N'Adquisicion de materiales y servicios', N'adquisicion de materiales y servicios', N'COMP', 0),
           (2, N'Almacen', N'almacen', N'Control de inventarios', N'control de inventarios', N'ALM', 0),
           (2, N'Produccion', N'produccion', N'Operaciones de manufactura', N'operaciones de manufactura', N'PROD', 0),
           (2, N'Ventas', N'ventas', N'Comercializacion de productos', N'comercializacion de productos', N'VENT', 0),
           (2, N'Marketing', N'marketing', N'Promocion y publicidad', N'promocion y publicidad', N'MARK', 0),
           (2, N'Tecnologia', N'tecnologia', N'Sistemas y TI', N'sistemas y ti', N'TI', 0),
           (2, N'Calidad', N'calidad', N'Control de calidad y certificaciones', N'control de calidad y certificaciones', N'CAL', 0),
    -- Artricenter (id_empresa = 3)
           (3, N'Recursos Humanos', N'recursos humanos', N'Gestion de personal y nomina', N'gestion de personal y nomina', N'RH', 0),
           (3, N'Contabilidad', N'contabilidad', N'Registro y control contable', N'registro y control contable', N'CONT', 0),
           (3, N'Tesoreria', N'tesoreria', N'Administracion de efectivo y bancos', N'administracion de efectivo y bancos', N'TES', 0),
           (3, N'Compras', N'compras', N'Adquisicion de materiales y servicios', N'adquisicion de materiales y servicios', N'COMP', 0),
           (3, N'Almacen', N'almacen', N'Control de inventarios', N'control de inventarios', N'ALM', 0),
           (3, N'Produccion', N'produccion', N'Operaciones de manufactura', N'operaciones de manufactura', N'PROD', 0),
           (3, N'Ventas', N'ventas', N'Comercializacion de productos', N'comercializacion de productos', N'VENT', 0),
           (3, N'Marketing', N'marketing', N'Promocion y publicidad', N'promocion y publicidad', N'MARK', 0),
           (3, N'Tecnologia', N'tecnologia', N'Sistemas y TI', N'sistemas y ti', N'TI', 0),
           (3, N'Calidad', N'calidad', N'Control de calidad y certificaciones', N'control de calidad y certificaciones', N'CAL', 0),
    -- Construmedika (id_empresa = 4)
           (4, N'Recursos Humanos', N'recursos humanos', N'Gestion de personal y nomina', N'gestion de personal y nomina', N'RH', 0),
           (4, N'Contabilidad', N'contabilidad', N'Registro y control contable', N'registro y control contable', N'CONT', 0),
           (4, N'Tesoreria', N'tesoreria', N'Administracion de efectivo y bancos', N'administracion de efectivo y bancos', N'TES', 0),
           (4, N'Compras', N'compras', N'Adquisicion de materiales y servicios', N'adquisicion de materiales y servicios', N'COMP', 0),
           (4, N'Almacen', N'almacen', N'Control de inventarios', N'control de inventarios', N'ALM', 0),
           (4, N'Produccion', N'produccion', N'Operaciones de manufactura', N'operaciones de manufactura', N'PROD', 0),
           (4, N'Ventas', N'ventas', N'Comercializacion de productos', N'comercializacion de productos', N'VENT', 0),
           (4, N'Marketing', N'marketing', N'Promocion y publicidad', N'promocion y publicidad', N'MARK', 0),
           (4, N'Tecnologia', N'tecnologia', N'Sistemas y TI', N'sistemas y ti', N'TI', 0),
           (4, N'Calidad', N'calidad', N'Control de calidad y certificaciones', N'control de calidad y certificaciones', N'CAL', 0),
    -- GrupoLefarma / Corporativo (id_empresa = 5)
           (5, N'Recursos Humanos', N'recursos humanos', N'Gestion de personal y nomina', N'gestion de personal y nomina', N'RH', 0),
           (5, N'Contabilidad', N'contabilidad', N'Registro y control contable', N'registro y control contable', N'CONT', 0),
           (5, N'Tesoreria', N'tesoreria', N'Administracion de efectivo y bancos', N'administracion de efectivo y bancos', N'TES', 0),
           (5, N'Compras', N'compras', N'Adquisicion de materiales y servicios', N'adquisicion de materiales y servicios', N'COMP', 0),
           (5, N'Almacen', N'almacen', N'Control de inventarios', N'control de inventarios', N'ALM', 0),
           (5, N'Produccion', N'produccion', N'Operaciones de manufactura', N'operaciones de manufactura', N'PROD', 0),
           (5, N'Ventas', N'ventas', N'Comercializacion de productos', N'comercializacion de productos', N'VENT', 0),
           (5, N'Marketing', N'marketing', N'Promocion y publicidad', N'promocion y publicidad', N'MARK', 0),
           (5, N'Tecnologia', N'tecnologia', N'Sistemas y TI', N'sistemas y ti', N'TI', 0),
           (5, N'Calidad', N'calidad', N'Control de calidad y certificaciones', N'control de calidad y certificaciones', N'CAL', 0)
) AS t(id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, numero_empleados);
GO

PRINT 'catalogos.areas: 50 registros insertados (10 areas x 5 empresas)';
GO

-- =============================================================================
-- RESUMEN FINAL
-- =============================================================================
PRINT '';
PRINT '============================================================';
PRINT 'CATALOGOS COMPLETOS - SEED FINALIZADO';
PRINT '============================================================';
PRINT '';
PRINT 'Registros insertados:';
PRINT '  - catalogos.medidas:              5';
PRINT '  - catalogos.tipos_medida:        8';
PRINT '  - catalogos.unidades_medida:     8';
PRINT '  - catalogos.centros_costo:       4';
PRINT '  - catalogos.tipos_impuesto:       5';
PRINT '  - catalogos.estatus_orden:       17';
PRINT '  - catalogos.cuentas_contables:   ~77';
PRINT '  - catalogos.gastos:               3';
PRINT '  - catalogos.areas:               50';
PRINT '';
PRINT 'Fuente: lefarma.docs/Documentacion/specs.md (v2.0, Marzo 2026)';
PRINT '============================================================';
PRINT '';
GO
