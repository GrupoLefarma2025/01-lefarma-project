-- ============================================================================
-- CREAR TABLA: Formas de Pago
-- ============================================================================
-- Catálogo de formas de pago del sistema
-- ============================================================================

USE Lefarma;
GO

-- Solo crear si no existe
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
    PRINT '✅ Tabla [catalogos].[formas_pago] creada';
END
ELSE
BEGIN
    PRINT 'ℹ️  La tabla [catalogos].[formas_pago] ya existe';
END
GO

-- Insertar formas de pago comunes (solo si no existen)
IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE clave = 'TRANSFERENCIA')
BEGIN
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo, fecha_creacion)
    VALUES ('Transferencia Electrónica', 'transferencia electronica', 'Transferencia entre cuentas bancarias', 'transferencia entre cuentas bancarias', 'TRANSFERENCIA', 1, GETDATE());
    PRINT '✅ Forma de pago "Transferencia Electrónica" insertada';
END

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE clave = 'EFECTIVO')
BEGIN
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo, fecha_creacion)
    VALUES ('Efectivo', 'efectivo', 'Pago en efectivo', 'pago en efectivo', 'EFECTIVO', 1, GETDATE());
    PRINT '✅ Forma de pago "Efectivo" insertada';
END

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE clave = 'CHEQUE')
BEGIN
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo, fecha_creacion)
    VALUES ('Cheque', 'cheque', 'Pago con cheque', 'pago con cheque', 'CHEQUE', 1, GETDATE());
    PRINT '✅ Forma de pago "Cheque" insertada';
END

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE clave = 'TARJETA')
BEGIN
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo, fecha_creacion)
    VALUES ('Tarjeta de Crédito/Débito', 'tarjeta de credito debito', 'Pago con tarjeta', 'pago con tarjeta', 'TARJETA', 1, GETDATE());
    PRINT '✅ Forma de pago "Tarjeta de Crédito/Débito" insertada';
END

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE clave = 'DEPOSITO')
BEGIN
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo, fecha_creacion)
    VALUES ('Depósito Bancario', 'deposito bancario', 'Depósito en cuenta bancaria', 'deposito en cuenta bancaria', 'DEPOSITO', 1, GETDATE());
    PRINT '✅ Forma de pago "Depósito Bancario" insertada';
END

PRINT '';
PRINT '============================================================';
PRINT 'FORMAS DE PAGO: Completado';
PRINT '============================================================';
GO

-- Verificación
DECLARE @count INT;
SELECT @count = COUNT(*) FROM catalogos.formas_pago;
PRINT 'Total de formas de pago: ' + CAST(@count AS VARCHAR);
GO
