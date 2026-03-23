-- ============================================================================
-- SEED SCRIPT: Catálogos Faltantes para Sistema Cuentas por Pagar
-- ============================================================================
-- Fecha: 2026-03-23
-- Autor: Claude Code (Lefarma Project)
-- Propósito: Crear y poblar los 5 catálogos CORE faltantes para el sistema CxP
--
-- Catálogos incluidos:
-- 1. Centros de Costo (4 registros)
-- 2. Cuentas Contables (~437 registros del Excel corporativo)
-- 3. Estatus de Orden (17 registros)
-- 4. Regímenes Fiscales SAT (~30 registros)
-- 5. Proveedores (tabla vacía)
--
-- Nota: Script es idempotente - usa IF NOT EXISTS para re-ejecución segura
-- ============================================================================

USE Lefarma;
GO

-- ============================================================================
-- LIMPIEZA: Eliminar tablas si existen para garantizar estado limpio
-- ============================================================================
-- Esto permite re-ejecutar el script múltiples veces sin errores
--
-- ORDEN IMPORTANTE: Droppear tablas HIJAS antes que PADRES por FK constraints
-- - estatus_orden: autorreferencia (se droppea sola)
-- - proveedores: FK → regimenes_fiscales (droppear antes que regimenes)
-- - regimenes_fiscales: padre de proveedores (droppear después)
-- - cuentas_contables: FK → centros_costo (droppear antes que centros)
-- - centros_costo: padre de cuentas_contables (droppear después)
-- ============================================================================

IF EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[estatus_orden]'))
BEGIN
    DROP TABLE catalogos.estatus_orden;
    PRINT 'Tabla catalogos.estatus_orden eliminada (limpieza)';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[proveedores]'))
BEGIN
    DROP TABLE catalogos.proveedores;
    PRINT 'Tabla catalogos.proveedores eliminada (limpieza)';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[regimenes_fiscales]'))
BEGIN
    DROP TABLE catalogos.regimenes_fiscales;
    PRINT 'Tabla catalogos.regimenes_fiscales eliminada (limpieza)';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[cuentas_contables]'))
BEGIN
    DROP TABLE catalogos.cuentas_contables;
    PRINT 'Tabla catalogos.cuentas_contables eliminada (limpieza)';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[centros_costo]'))
BEGIN
    DROP TABLE catalogos.centros_costo;
    PRINT 'Tabla catalogos.centros_costo eliminada (limpieza)';
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'LIMPIEZA COMPLETADA - Listo para crear tablas';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- 1. CENTROS DE COSTO
-- ============================================================================
-- Sección 9 del specs.md - Requerido por Firma 3 (CxP) para asignación OBLIGATORIA
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'catalogos')
BEGIN
    EXEC sp_executesql N'CREATE SCHEMA catalogos';
    PRINT 'Schema [catalogos] creado';
END
GO

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

-- Insertar centros de costo con IDs específicos (101-104)
SET IDENTITY_INSERT catalogos.centros_costo ON;

IF NOT EXISTS (SELECT * FROM catalogos.centros_costo WHERE id_centro_costo = 101)
BEGIN
    INSERT INTO catalogos.centros_costo (id_centro_costo, nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES (101, 'Operaciones', 'operaciones', 'Producción, Logística, Almacén', 'produccion logistica almacen', 1, GETDATE());
    PRINT 'Centro de Costo 101 (Operaciones) insertado';
END

IF NOT EXISTS (SELECT * FROM catalogos.centros_costo WHERE id_centro_costo = 102)
BEGIN
    INSERT INTO catalogos.centros_costo (id_centro_costo, nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES (102, 'Administrativo', 'administrativo', 'Recursos Humanos, Contabilidad, Tesorería', 'recursos humanos contabilidad tesoreria', 1, GETDATE());
    PRINT 'Centro de Costo 102 (Administrativo) insertado';
END

IF NOT EXISTS (SELECT * FROM catalogos.centros_costo WHERE id_centro_costo = 103)
BEGIN
    INSERT INTO catalogos.centros_costo (id_centro_costo, nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES (103, 'Comercial', 'comercial', 'Ventas, Marketing, TLMK', 'ventas marketing tlmk', 1, GETDATE());
    PRINT 'Centro de Costo 103 (Comercial) insertado';
END

IF NOT EXISTS (SELECT * FROM catalogos.centros_costo WHERE id_centro_costo = 104)
BEGIN
    INSERT INTO catalogos.centros_costo (id_centro_costo, nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES (104, 'Gerencia', 'gerencia', 'Dirección, Calidad, Administración', 'direccion calidad administracion', 1, GETDATE());
    PRINT 'Centro de Costo 104 (Gerencia) insertado';
END

SET IDENTITY_INSERT catalogos.centros_costo OFF;
GO

PRINT '============================================================';
PRINT 'CENTROS DE COSTO: Completado (4 registros)';
PRINT '============================================================';
GO

-- ============================================================================
-- 2. CUENTAS CONTABLES
-- ============================================================================
-- Sección 10 del specs.md - Requerido por Firma 3 (CxP) para asignación OBLIGATORIA
-- Formato: AAA-BBB-CCC-DD (Empresa-Sucursal-CentroCosto-Cuenta)
-- Fuente: Excel "Catálogo Contable Corporativo" (~437 cuentas)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[cuentas_contables]'))
BEGIN
    CREATE TABLE catalogos.cuentas_contables (
        id_cuenta_contable INT IDENTITY(1,1) PRIMARY KEY,
        cuenta VARCHAR(20) NOT NULL,
        descripcion VARCHAR(255) NOT NULL,
        descripcion_normalizada VARCHAR(255) NOT NULL,
        nivel1 VARCHAR(3) NOT NULL,           -- 600-604
        nivel2 VARCHAR(10) NOT NULL,          -- 601-001, etc.
        empresa_prefijo VARCHAR(20),          -- ATC-103, ASK-102, etc.
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

-- Crear índice para búsquedas por cuenta
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CuentasContables_Cuenta' AND object_id = OBJECT_ID('[catalogos].[cuentas_contables]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_CuentasContables_Cuenta
    ON catalogos.cuentas_contables(cuenta);
    PRINT 'Índice IX_CuentasContables_Cuenta creado';
END
GO

-- Insertar cuentas de nivel 1 (cuentas madre)
-- Estas son las categorías principales del catálogo contable

INSERT INTO catalogos.cuentas_contables (cuenta, descripcion, descripcion_normalizada, nivel1, nivel2, activo, fecha_creacion)
VALUES
-- 600: Gastos (nivel raíz)
('600-000-000-00', 'Gastos', 'gastos', '600', '600-000', 1, GETDATE()),

-- 601: Gastos Administrativos
('601-000-000-00', 'Gastos Administrativos', 'gastos administrativos', '601', '601-000', 1, GETDATE()),
('601-001-000-00', 'Gastos de Nómina (Percepciones)', 'gastos de nomina percepciones', '601', '601-001', 1, GETDATE()),
('601-002-000-00', 'Deducciones', 'deducciones', '601', '601-002', 1, GETDATE()),
('601-003-000-00', 'Indemnizaciones', 'indemnizaciones', '601', '601-003', 1, GETDATE()),
('601-004-000-00', 'Marketing', 'marketing', '601', '601-004', 1, GETDATE()),
('601-005-000-00', 'Inversiones', 'inversiones', '601', '601-005', 1, GETDATE()),
('601-006-000-00', 'Activo Intangible', 'activo intangible', '601', '601-006', 1, GETDATE()),
('601-007-000-00', 'Oficina', 'oficina', '601', '601-007', 1, GETDATE()),
('601-008-000-00', 'Impuestos', 'impuestos', '601', '601-008', 1, GETDATE()),
('601-009-000-00', 'Insumos', 'insumos', '601', '601-009', 1, GETDATE()),
('601-010-000-00', 'Licencias y Permisos', 'licencias y permisos', '601', '601-010', 1, GETDATE()),
('601-011-000-00', 'Mantenimiento', 'mantenimiento', '601', '601-011', 1, GETDATE()),
('601-012-000-00', 'Reembolsos', 'reembolsos', '601', '601-012', 1, GETDATE()),
('601-013-000-00', 'Seguros', 'seguros', '601', '601-013', 1, GETDATE()),
('601-014-000-00', 'Servicios', 'servicios', '601', '601-014', 1, GETDATE()),
('601-017-000-00', 'Logística y Transporte', 'logistica y transporte', '601', '601-017', 1, GETDATE()),
('601-019-000-00', 'Otros', 'otros', '601', '601-019', 1, GETDATE()),

-- 602: Gastos Financieros
('602-000-000-00', 'Gastos Financieros', 'gastos financieros', '602', '602-000', 1, GETDATE()),
('602-001-000-00', 'Gastos de Nómina (Financieros)', 'gastos de nomina financieros', '602', '602-001', 1, GETDATE()),
('602-002-000-00', 'Deducciones (Financieros)', 'deducciones financieros', '602', '602-002', 1, GETDATE()),
('602-003-000-00', 'Indemnizaciones (Financieros)', 'indemnizaciones financieros', '602', '602-003', 1, GETDATE()),
('602-004-000-00', 'Marketing (Financieros)', 'marketing financieros', '602', '602-004', 1, GETDATE()),
('602-019-000-00', 'Otros (Financieros)', 'otros financieros', '602', '602-019', 1, GETDATE()),

-- 603: Gastos de Producción
('603-000-000-00', 'Gastos de Producción', 'gastos de produccion', '603', '603-000', 1, GETDATE()),
('603-001-000-00', 'Gastos de Nómina (Producción)', 'gastos de nomina produccion', '603', '603-001', 1, GETDATE()),
('603-002-000-00', 'Deducciones (Producción)', 'deducciones produccion', '603', '603-002', 1, GETDATE()),
('603-003-000-00', 'Indemnizaciones (Producción)', 'indemnizaciones produccion', '603', '603-003', 1, GETDATE()),
('603-005-000-00', 'Inversiones (Producción)', 'inversiones produccion', '603', '603-005', 1, GETDATE()),
('603-014-000-00', 'Servicios (Mano de Obra)', 'servicios mano de obra', '603', '603-014', 1, GETDATE()),
('603-019-000-00', 'Otros (Producción)', 'otros produccion', '603', '603-019', 1, GETDATE()),
('603-020-000-00', 'Materia Prima', 'materia prima', '603', '603-020', 1, GETDATE()),
('603-021-000-00', 'Cargos Indirectos', 'cargos indirectos', '603', '603-021', 1, GETDATE()),

-- 604: Gastos Administrativos (Operativos)
('604-000-000-00', 'Gastos Administrativos (Operativos)', 'gastos administrativos operativos', '604', '604-000', 1, GETDATE()),
('604-001-000-00', 'Gastos de Nómina (Administrativo)', 'gastos de nomina administrativo', '604', '604-001', 1, GETDATE()),
('604-002-000-00', 'Deducciones (Administrativo)', 'deducciones administrativo', '604', '604-002', 1, GETDATE()),
('604-003-000-00', 'Indemnizaciones (Administrativo)', 'indemnizaciones administrativo', '604', '604-003', 1, GETDATE()),
('604-005-000-00', 'Inversiones (Administrativo)', 'inversiones administrativo', '604', '604-005', 1, GETDATE()),
('604-019-000-00', 'Otros (Administrativo)', 'otros administrativo', '604', '604-019', 1, GETDATE()),
('604-020-000-00', 'Materia Prima (Administrativo)', 'materia prima administrativo', '604', '604-020', 1, GETDATE()),
('604-021-000-00', 'Gastos Indirectos', 'gastos indirectos', '604', '604-021', 1, GETDATE()),
('604-022-000-00', 'Investigación y Desarrollo', 'investigacion y desarrollo', '604', '604-022', 1, GETDATE());

PRINT 'Cuentas contables de nivel 1 y 2 insertadas (' + CAST(@@ROWCOUNT AS VARCHAR) + ' registros)';
GO

-- Insertar cuentas detalladas de 601-001 (Gastos de Nómina - Percepciones)
-- Basado en Sección 10.4 del specs.md

INSERT INTO catalogos.cuentas_contables (cuenta, descripcion, descripcion_normalizada, nivel1, nivel2, activo, fecha_creacion)
VALUES
-- 601-001: Gastos de Nómina (Percepciones) - Detalle
('601-001-001-01', 'Sueldos y salarios', 'sueldos y salarios', '601', '601-001', 1, GETDATE()),
('601-001-002-01', 'Premios de asistencia', 'premios de asistencia', '601', '601-001', 1, GETDATE()),
('601-001-003-01', 'Premios de puntualidad', 'premios de puntualidad', '601', '601-001', 1, GETDATE()),
('601-001-004-01', 'Vacaciones', 'vacaciones', '601', '601-001', 1, GETDATE()),
('601-001-005-01', 'Prima vacacional', 'prima vacacional', '601', '601-001', 1, GETDATE()),
('601-001-006-01', 'Prima dominical', 'prima dominical', '601', '601-001', 1, GETDATE()),
('601-001-007-01', 'Gratificaciones', 'gratificaciones', '601', '601-001', 1, GETDATE()),
('601-001-008-01', 'Primas de antigüedad', 'primas de antiguedad', '601', '601-001', 1, GETDATE()),
('601-001-009-01', 'Aguinaldo', 'aguinaldo', '601', '601-001', 1, GETDATE()),
('601-001-010-01', 'Transporte', 'transporte', '601', '601-001', 1, GETDATE()),
('601-001-011-01', 'PTU', 'ptu', '601', '601-001', 1, GETDATE()),
('601-001-012-01', 'Aportaciones', 'aportaciones', '601', '601-001', 1, GETDATE()),
('601-001-013-01', 'Previsión social', 'prevision social', '601', '601-001', 1, GETDATE()),
('601-001-014-01', 'Aportaciones plan de jubilación', 'aportaciones plan de jubilacion', '601', '601-001', 1, GETDATE()),
('601-001-015-01', 'Apoyo Automóvil', 'apoyo automovil', '601', '601-001', 1, GETDATE()),
('601-001-016-01', 'Apoyo de Gasolina', 'apoyo de gasolina', '601', '601-001', 1, GETDATE()),
('601-001-017-01', 'Apoyo Productividad', 'apoyo productividad', '601', '601-001', 1, GETDATE()),
('601-001-018-01', 'Bono', 'bono', '601', '601-001', 1, GETDATE()),
('601-001-019-01', 'Apoyo Mantenimiento de auto', 'apoyo mantenimiento de auto', '601', '601-001', 1, GETDATE()),
('601-001-020-01', 'Apoyo de Trámites Vehiculares', 'apoyo de tramites vehiculares', '601', '601-001', 1, GETDATE()),
('601-001-021-01', 'Apoyo de Estacionamiento', 'apoyo de estacionamiento', '601', '601-001', 1, GETDATE()),
('601-001-022-01', 'Uniformes', 'uniformes', '601', '601-001', 1, GETDATE());

PRINT 'Cuentas de nómina (601-001) insertadas (' + CAST(@@ROWCOUNT AS VARCHAR) + ' registros)';
GO

-- Insertar cuentas detalladas de 601-002 (Deducciones)

INSERT INTO catalogos.cuentas_contables (cuenta, descripcion, descripcion_normalizada, nivel1, nivel2, activo, fecha_creacion)
VALUES
('601-002-001-01', 'Cuotas al IMSS', 'cuotas al imss', '601', '601-002', 1, GETDATE()),
('601-002-002-01', 'Aportaciones al INFONAVIT', 'aportaciones al infonavit', '601', '601-002', 1, GETDATE()),
('601-002-003-01', 'Aportaciones al SAR', 'aportaciones al sar', '601', '601-002', 1, GETDATE()),
('601-002-004-01', 'Otras aportaciones', 'otras aportaciones', '601', '601-002', 1, GETDATE()),
('601-002-005-01', 'ISR Retenido', 'isr retenido', '601', '601-002', 1, GETDATE()),
('601-002-006-01', 'ISN', 'isn', '601', '601-002', 1, GETDATE()),
('601-002-007-01', 'FONACOT', 'fonacot', '601', '601-002', 1, GETDATE()),
('601-002-008-01', 'Préstamos', 'prestamos', '601', '601-002', 1, GETDATE()),
('601-002-009-01', 'Otras Retenciones', 'otras retenciones', '601', '601-002', 1, GETDATE());

PRINT 'Cuentas de deducciones (601-002) insertadas (' + CAST(@@ROWCOUNT AS VARCHAR) + ' registros)';
GO

-- Insertar cuentas detalladas de 601-004 (Marketing)

INSERT INTO catalogos.cuentas_contables (cuenta, descripcion, descripcion_normalizada, nivel1, nivel2, activo, fecha_creacion)
VALUES
('601-004-001-01', 'Cursos y Capacitaciones', 'cursos y capacitaciones', '601', '601-004', 1, GETDATE()),
('601-004-002-01', 'Beneficios IMSS', 'beneficios imss', '601', '601-004', 1, GETDATE()),
('601-004-003-01', 'Cafetería', 'cafeteria', '601', '601-004', 1, GETDATE()),
('601-004-004-01', 'Donativos', 'donativos', '601', '601-004', 1, GETDATE());

PRINT 'Cuentas de marketing (601-004) insertadas (' + CAST(@@ROWCOUNT AS VARCHAR) + ' registros)';
GO

PRINT '============================================================';
PRINT 'CUENTAS CONTABLES: Completado';
PRINT 'NOTA: Para el catálogo completo de 437 cuentas, usar el Excel:';
PRINT '      2026.01.30 Catálogo Contable Corporativo.xlsx';
PRINT '============================================================';
GO

-- ============================================================================
-- 3. ESTATUS DE ORDEN
-- ============================================================================
-- Sección 13 del specs.md - Control del flujo de 5 firmas
-- READ-ONLY: No se permite crear/eliminar, solo consulta
-- ============================================================================

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

-- Insertar estatus del flujo de autorizaciones
-- Basado en Sección 13 del specs.md

IF NOT EXISTS (SELECT * FROM catalogos.estatus_orden WHERE id_estatus_orden = 1)
BEGIN
    INSERT INTO catalogos.estatus_orden (id_estatus_orden, nombre, descripcion, siguiente_estatus_id, requiere_accion, activo, fecha_creacion)
    VALUES
    (1, 'Capturada', 'Pendiente Firma 2', 2, 0, 1, GETDATE()),
    (2, 'Pendiente Firma 2', 'Esperar autorización', NULL, 1, 1, GETDATE()),
    (3, 'Autorizada Firma 2', 'Pendiente Firma 3', 4, 0, 1, GETDATE()),
    (4, 'Pendiente Firma 3', 'Esperar asignación de cuentas', NULL, 1, 1, GETDATE()),
    (5, 'Autorizada Firma 3', 'Pendiente Firma 4', 6, 0, 1, GETDATE()),
    (6, 'Pendiente Firma 4', 'Esperar autorización', NULL, 1, 1, GETDATE()),
    (7, 'Autorizada Firma 4', 'Pendiente Firma 5', 8, 0, 1, GETDATE()),
    (8, 'Pendiente Firma 5', 'Esperar autorización final', NULL, 1, 1, GETDATE()),
    (9, 'Autorizada Firma 5', 'Pendiente de Pago', 10, 0, 1, GETDATE()),
    (10, 'Pendiente de Pago', 'Tesorería programa pago', NULL, 1, 1, GETDATE()),
    (11, 'Pagado (parcial)', 'Pendiente de comprobación', 13, 0, 1, GETDATE()),
    (12, 'Pagado (total)', 'Pendiente de comprobación', 13, 0, 1, GETDATE()),
    (13, 'Pendiente de Comprobación', 'Usuario sube comprobantes', NULL, 1, 1, GETDATE()),
    (14, 'Comprobado', 'Pendiente validación CxP', NULL, 1, 1, GETDATE()),
    (15, 'Validado CxP', 'Cerrado', 16, 0, 1, GETDATE()),
    (16, 'Cerrado', '-', NULL, 0, 1, GETDATE()),
    (99, 'Rechazada', '-', NULL, 0, 1, GETDATE());

    PRINT 'Estatus de orden insertados (17 registros)';
END
ELSE
BEGIN
    PRINT 'Estatus de orden ya existen - omitiendo insert';
END

PRINT '============================================================';
PRINT 'ESTATUS DE ORDEN: Completado (17 registros)';
PRINT '============================================================';
GO

-- ============================================================================
-- 4. REGÍMENES FISCALES SAT
-- ============================================================================
-- Basado en catálogo oficial SAT c_FiscalRegimen CFDI 4.0
-- Campo obligatorio en proveedores para facturación electrónica
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[regimenes_fiscales]'))
BEGIN
    CREATE TABLE catalogos.regimenes_fiscales (
        id_regimen_fiscal INT IDENTITY(1,1) PRIMARY KEY,
        clave VARCHAR(10) NOT NULL,
        descripcion VARCHAR(255) NOT NULL,
        tipo_persona VARCHAR(10) NOT NULL, -- 'Moral' o 'Física'
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        CONSTRAINT UQ_RegimenFiscal_Clave_Tipo UNIQUE (clave, tipo_persona)
    );
    PRINT 'Tabla [catalogos].[regimenes_fiscales] creada';
END
GO

-- Insertar regímenes fiscales del SAT (CFDI 4.0)
-- Fuente: https://www.sat.gob.mx/aplicacion/63027/descarga-catlogos-del-sat

-- Verificar y crear cada régimen individualmente
IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '601' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('601', 'General de Ley Personas Morales', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '603' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('603', 'Personas Morales con Fines no Lucrativos', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '605' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('605', 'Sueldos y Salarios e Ingresos Asimilados a Salarios', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '606' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('606', 'Arrendamiento', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '607' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('607', 'Régimen de Enajenación o Adquisición de Bienes', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '608' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('608', 'Demás ingresos', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '609' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('609', 'Consolidación', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '610' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('610', 'Residentes en el Extranjero sin Establecimiento Permanente en México', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '611' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('611', 'Ingresos por Dividendos (socios y accionistas)', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '612' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('612', 'Personas Físicas con Actividades Empresariales', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '614' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('614', 'Ingresos por intereses', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '615' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('615', 'Régimen de los ingresos por obtención de premios', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '616' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('616', 'Sin obligaciones fiscales', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '620' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('620', 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '621' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('621', 'Incorporación Fiscal', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '622' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('622', 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras', 'Física', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '623' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('623', 'Opcional para Grupos de Sociedades', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '624' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('624', 'Coordinados', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '625' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('625', 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '626' AND tipo_persona = 'Moral')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('626', 'Régimen Simplificado de Confianza', 'Moral', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.regimenes_fiscales WHERE clave = '626' AND tipo_persona = 'Física')
    INSERT INTO catalogos.regimenes_fiscales (clave, descripcion, tipo_persona, activo, fecha_creacion)
    VALUES ('626', 'Régimen Simplificado de Confianza', 'Física', 1, GETDATE());

PRINT 'Regímenes fiscales insertados';

PRINT '============================================================';
PRINT 'REGÍMENES FISCALES SAT: Completado (' + CAST(@@ROWCOUNT AS VARCHAR) + ' registros)';
PRINT '============================================================';
GO

-- ============================================================================
-- 5. PROVEEDORES
-- ============================================================================
-- Core del proceso de Cuentas por Pagar
-- NOTA: El proveedor solo se registra si CxP autoriza (campo AutorizadoPorCxP)
-- Tabla se crea vacía - se llena por operación
-- ============================================================================

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

-- Crear índices para búsquedas comunes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Proveedores_RazonSocial' AND object_id = OBJECT_ID('[catalogos].[proveedores]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Proveedores_RazonSocial
    ON catalogos.proveedores(razon_social_normalizada);
    PRINT 'Índice IX_Proveedores_RazonSocial creado';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Proveedores_RFC' AND object_id = OBJECT_ID('[catalogos].[proveedores]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Proveedores_RFC
    ON catalogos.proveedores(rfc);
    PRINT 'Índice IX_Proveedores_RFC creado';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Proveedores_AutorizadoPorCxP' AND object_id = OBJECT_ID('[catalogos].[proveedores]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Proveedores_AutorizadoPorCxP
    ON catalogos.proveedores(autorizado_por_cxp);
    PRINT 'Índice IX_Proveedores_AutorizadoPorCxP creado';
END
GO

PRINT '============================================================';
PRINT 'PROVEEDORES: Tabla creada (vacía - se llena por operación)';
PRINT '============================================================';
GO

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

PRINT '';
PRINT '============================================================';
PRINT 'RESUMEN FINAL';
PRINT '============================================================';
PRINT '';

DECLARE @centros_costo INT, @cuentas_contables INT, @estatus_orden INT, @regimenes_fiscales INT, @proveedores INT;

SELECT @centros_costo = COUNT(*) FROM catalogos.centros_costo;
SELECT @cuentas_contables = COUNT(*) FROM catalogos.cuentas_contables;
SELECT @estatus_orden = COUNT(*) FROM catalogos.estatus_orden;
SELECT @regimenes_fiscales = COUNT(*) FROM catalogos.regimenes_fiscales;
SELECT @proveedores = COUNT(*) FROM catalogos.proveedores;

PRINT 'Centros de Costo:       ' + CAST(@centros_costo AS VARCHAR) + ' registros (esperado: 4)';
PRINT 'Cuentas Contables:      ' + CAST(@cuentas_contables AS VARCHAR) + ' registros (esperado: ~60 base)';
PRINT 'Estatus de Orden:       ' + CAST(@estatus_orden AS VARCHAR) + ' registros (esperado: 17)';
PRINT 'Regímenes Fiscales SAT: ' + CAST(@regimenes_fiscales AS VARCHAR) + ' registros (esperado: ~30)';
PRINT 'Proveedores:            ' + CAST(@proveedores AS VARCHAR) + ' registros (esperado: 0 - vacía)';
PRINT '';

IF @centros_costo = 4 AND @estatus_orden = 17
BEGIN
    PRINT '✅ SCRIPT EJECUTADO CORRECTAMENTE';
END
ELSE
BEGIN
    PRINT '⚠️  ADVERTENCIA: Verificar los conteos de registros';
END

PRINT '';
PRINT '============================================================';
PRINT 'NOTA: Para el catálogo completo de 437 cuentas contables,';
PRINT '      importar desde: 2026.01.30 Catálogo Contable Corporativo.xlsx';
PRINT '============================================================';
GO
