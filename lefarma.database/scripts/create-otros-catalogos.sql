-- ============================================================================
-- CREAR TABLAS: Bancos, Gastos, Medidas, MediosPago
-- ============================================================================
-- Tablas faltantes para los catálogos existentes en el backend
-- ============================================================================

USE Lefarma;
GO

PRINT '============================================================';
PRINT 'CREANDO TABLAS FALTANTES DE CATÁLOGOS';
PRINT '============================================================';
PRINT '';

-- ============================================================================
-- 1. BANCOS
-- ============================================================================

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
    PRINT '✅ Tabla [catalogos].[bancos] creada';
END
ELSE
BEGIN
    PRINT 'ℹ️  La tabla [catalogos].[bancos] ya existe';
END
GO

-- Insertar bancos principales de México
IF NOT EXISTS (SELECT * FROM catalogos.bancos WHERE nombre = 'BBVA México')
BEGIN
    INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('BBVA México', 'bbva mexico', 'BBVA', 'BANMXMM', 'Banco BBVA México', 'banco bbva mexico', 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.bancos WHERE nombre = 'Bancomer')
BEGIN
    INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Bancomer', 'bancomer', 'BANCOMER', 'BMRMXMM', 'Banco Bancomer', 'banco bancomer', 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.bancos WHERE nombre = 'Santander')
BEGIN
    INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Santander', 'santander', 'SAN', 'TSMXMXMT', 'Banco Santander México', 'banco santander mexico', 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.bancos WHERE nombre = 'Banorte')
BEGIN
    INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Banorte', 'banorte', 'BANORTE', 'BMRMXMT', 'Banco Banorte', 'banco banorte', 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.bancos WHERE nombre = 'HSBC')
BEGIN
    INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('HSBC', 'hsbc', 'HSBC', 'HSBCMXMM', 'HSBC México', 'hsbc mexico', 1, GETDATE());
END

PRINT '  → Bancos: 5 registros';
PRINT '';

-- ============================================================================
-- 2. GASTOS
-- ============================================================================

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
    PRINT '✅ Tabla [catalogos].[gastos] creada';
END
ELSE
BEGIN
    PRINT 'ℹ️  La tabla [catalogos].[gastos] ya existe';
END
GO

-- Insertar gastos comunes
IF NOT EXISTS (SELECT * FROM catalogos.gastos WHERE clave = 'GASTOS_OP')
BEGIN
    INSERT INTO catalogos.gastos (nombre, nombre_normalizado, clave, concepto, cuenta, sub_cuenta, requiere_comprobacion_pago, requiere_comprobacion_gasto, permite_sin_datos_fiscales, dias_limite_comprobacion, activo, fecha_creacion)
    VALUES ('Gastos Operativos', 'gastos operativos', 'GASTOS_OP', 'Gastos de operación diaria', '601', '001', 1, 1, 0, 5, 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.gastos WHERE clave = 'GASTOS_VIAJE')
BEGIN
    INSERT INTO catalogos.gastos (nombre, nombre_normalizado, clave, concepto, cuenta, sub_cuenta, requiere_comprobacion_pago, requiere_comprobacion_gasto, permite_sin_datos_fiscales, dias_limite_comprobacion, activo, fecha_creacion)
    VALUES ('Gastos de Viaje', 'gastos de viaje', 'GASTOS_VIAJE', 'Viáticos y gastos de viaje', '601', '012', 1, 1, 0, 7, 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.gastos WHERE clave = 'GASTOS_REP')
BEGIN
    INSERT INTO catalogos.gastos (nombre, nombre_normalizado, clave, concepto, cuenta, sub_cuenta, requiere_comprobacion_pago, requiere_comprobacion_gasto, permite_sin_datos_fiscales, dias_limite_comprobacion, activo, fecha_creacion)
    VALUES ('Gastos de Representación', 'gastos de representacion', 'GASTOS_REP', 'Gastos de representación y relaciones públicas', '601', '019', 1, 1, 0, 3, 1, GETDATE());
END

PRINT '  → Gastos: 3 registros';
PRINT '';

-- ============================================================================
-- 3. MEDIDAS
-- ============================================================================

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
    PRINT '✅ Tabla [catalogos].[medidas] creada';
END
ELSE
BEGIN
    PRINT 'ℹ️  La tabla [catalogos].[medidas] ya existe';
END
GO

-- Insertar medidas comunes
IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Peso')
BEGIN
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Peso', 'peso', 'Medida de peso/masa', 'medida de peso masa', 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Longitud')
BEGIN
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Longitud', 'longitud', 'Medida de longitud/distancia', 'medida de longitud distancia', 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Volumen')
BEGIN
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Volumen', 'volumen', 'Medida de volumen/capacidad', 'medida de volumen capacidad', 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Tiempo')
BEGIN
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Tiempo', 'tiempo', 'Medida de tiempo/duración', 'medida de tiempo duracion', 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Temperatura')
BEGIN
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Temperatura', 'temperatura', 'Medida de temperatura', 'medida de temperatura', 1, GETDATE());
END

PRINT '  → Medidas: 5 registros';
PRINT '';

-- ============================================================================
-- 4. MEDIOS DE PAGO
-- ============================================================================

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
    PRINT '✅ Tabla [catalogos].[medios_pago] creada';
END
ELSE
BEGIN
    PRINT 'ℹ️  La tabla [catalogos].[medios_pago] ya existe';
END
GO

-- Insertar medios de pago SAT
IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '01')
BEGIN
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES ('Efectivo', 'efectivo', 'EFEC', '01', 'Pago en efectivo', 'pago en efectivo', 0, 0, 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '02')
BEGIN
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES ('Cheque Nominativo', 'cheque nominativo', 'CHEQ', '02', 'Pago con cheque nominativo', 'pago con cheque nominativo', 1, 0, 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '03')
BEGIN
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, limite_monto, activo, fecha_creacion)
    VALUES ('Transferencia Electrónica', 'transferencia electronica', 'TRANSF', '03', 'Transferencia bancaria SPEI', 'transferencia bancaria spei', 1, 0, 1000000, 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '04')
BEGIN
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES ('Tarjeta de Crédito', 'tarjeta de credito', 'TDC', '04', 'Pago con tarjeta de crédito', 'pago con tarjeta de credito', 1, 0, 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '28')
BEGIN
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES ('Tarjeta de Débito', 'tarjeta de debito', 'TDD', '28', 'Pago con tarjeta de débito', 'pago con tarjeta de debito', 1, 0, 1, GETDATE());
END

IF NOT EXISTS (SELECT * FROM catalogos.medios_pago WHERE codigo_sat = '99')
BEGIN
    INSERT INTO catalogos.medios_pago (nombre, nombre_normalizado, clave, codigo_sat, descripcion, descripcion_normalizada, requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES ('Otros', 'otros', 'OTROS', '99', 'Otros medios de pago', 'otros medios de pago', 1, 1, 1, GETDATE());
END

PRINT '  → Medios de Pago: 6 registros';
PRINT '';

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

PRINT '';
PRINT '============================================================';
PRINT 'VERIFICACIÓN FINAL';
PRINT '============================================================';

DECLARE @bancos INT, @gastos INT, @medidas INT, @medios_pago INT;

SELECT @bancos = COUNT(*) FROM catalogos.bancos;
SELECT @gastos = COUNT(*) FROM catalogos.gastos;
SELECT @medidas = COUNT(*) FROM catalogos.medidas;
SELECT @medios_pago = COUNT(*) FROM catalogos.medios_pago;

PRINT '';
PRINT 'Bancos:         ' + CAST(@bancos AS VARCHAR) + ' registros';
PRINT 'Gastos:         ' + CAST(@gastos AS VARCHAR) + ' registros';
PRINT 'Medidas:        ' + CAST(@medidas AS VARCHAR) + ' registros';
PRINT 'Medios de Pago: ' + CAST(@medios_pago AS VARCHAR) + ' registros';
PRINT '';
PRINT '✅ TODAS LAS TABLAS CREADAS EXITOSAMENTE';
PRINT '============================================================';
GO
