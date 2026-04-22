-- ============================================================================
-- LEFARMA - PROVEEDOR FORMAS DE PAGO Y CUENTAS
-- ============================================================================
-- Fecha: 2026-04-17
-- Descripcion: Agrega forma de pago al proveedor y cuentas por forma de pago
-- ============================================================================

USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'INICIANDO 005_proveedor_cuentas_formas_pago.sql';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- ALTER TABLE: catalogos.formas_pago - agregar requiere_cuenta
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[catalogos].[formas_pago]') AND name = 'requiere_cuenta')
BEGIN
    ALTER TABLE catalogos.formas_pago ADD requiere_cuenta BIT DEFAULT 1;
    PRINT 'Columna [catalogos].[formas_pago].[requiere_cuenta] agregada';
END
GO

-- ============================================================================
-- ALTER TABLE: catalogos.proveedores - agregar forma_pago_id
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[catalogos].[proveedores]') AND name = 'forma_pago_id')
BEGIN
    ALTER TABLE catalogos.proveedores ADD forma_pago_id INT NULL;
    PRINT 'Columna [catalogos].[proveedores].[forma_pago_id] agregada';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Proveedores_FormasPago')
BEGIN
    ALTER TABLE catalogos.proveedores
        ADD CONSTRAINT FK_Proveedores_FormasPago
        FOREIGN KEY (forma_pago_id) REFERENCES catalogos.formas_pago(id_forma_pago);
    PRINT 'FK [catalogos].[proveedores] -> [catalogos].[formas_pago] creada';
END
GO

-- ============================================================================
-- TABLA: catalogos.proveedor_forma_pago_cuentas
-- Cuenta bancaria ligada a un proveedor y forma de pago
-- Soporta múltiples cuentas por proveedor-forma-pago
-- ============================================================================
IF NOT EXISTS (SELECT *
FROM sys.tables
WHERE object_id = OBJECT_ID('[catalogos].[proveedor_forma_pago_cuentas]'))
BEGIN
    CREATE TABLE catalogos.proveedor_forma_pago_cuentas
    (
        id_cuenta INT IDENTITY(1,1) PRIMARY KEY,
        id_proveedor INT NOT NULL,
        id_forma_pago INT NOT NULL,
        id_banco INT NULL,                         -- banco de la cuenta (puede ser null para efectivo)
        numero_cuenta VARCHAR(50) NULL,           -- número de cuenta bancaria
        clabe VARCHAR(34) NULL,                   -- CLABE interbancaria (18 dígitos)
        numero_tarjeta VARCHAR(20) NULL,           -- para tarjetas
        beneficiario VARCHAR(255) NULL,            -- nombre del beneficiario
        correo_notificacion VARCHAR(100) NULL,     -- correo para recibir notificaciones de pago
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_ProveedorFormaPagoCuenta_Proveedor
            FOREIGN KEY (id_proveedor) REFERENCES catalogos.proveedores(id_proveedor),
        CONSTRAINT FK_ProveedorFormaPagoCuenta_FormaPago
            FOREIGN KEY (id_forma_pago) REFERENCES catalogos.formas_pago(id_forma_pago),
        CONSTRAINT FK_ProveedorFormaPagoCuenta_Banco
            FOREIGN KEY (id_banco) REFERENCES catalogos.bancos(id_banco)
    );
    PRINT 'Tabla [catalogos].[proveedor_forma_pago_cuentas] creada';
END
GO

-- ============================================================================
-- INDICES
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_proveedor_forma_pago_cuentas_proveedor' AND object_id = OBJECT_ID('[catalogos].[proveedor_forma_pago_cuentas]'))
BEGIN
    CREATE INDEX IX_proveedor_forma_pago_cuentas_proveedor
        ON catalogos.proveedor_forma_pago_cuentas(id_proveedor);
    PRINT 'Indice IX_proveedor_forma_pago_cuentas_proveedor creado';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_proveedor_forma_pago_cuentas_forma_pago' AND object_id = OBJECT_ID('[catalogos].[proveedor_forma_pago_cuentas]'))
BEGIN
    CREATE INDEX IX_proveedor_forma_pago_cuentas_forma_pago
        ON catalogos.proveedor_forma_pago_cuentas(id_forma_pago);
    PRINT 'Indice IX_proveedor_forma_pago_cuentas_forma_pago creado';
END
GO

-- ============================================================================
-- ACTUALIZAR: catalogos.formas_pago - marcar cuales requieren cuenta
-- ============================================================================
PRINT 'Actualizando catalogos.formas_pago.requiere_cuenta...';

UPDATE catalogos.formas_pago SET requiere_cuenta = 1 WHERE clave IN ('TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'TARJETA');
UPDATE catalogos.formas_pago SET requiere_cuenta = 0 WHERE clave = 'EFECTIVO';

PRINT 'Formas de pago actualizadas con requiere_cuenta';
GO

PRINT '';
PRINT '============================================================';
PRINT '005_proveedor_cuentas_formas_pago.sql COMPLETADO';
PRINT '============================================================';
PRINT '';
GO
