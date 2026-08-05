-- ============================================================================
-- ALTER TABLE: Agregar estructuras de Formas de Pago y Cuentas Bancarias
-- ============================================================================
-- Fecha: 2026-04-17
-- Descripcion: Crea las tablas necesarias para manejar formas de pago,
--              bancos y cuentas bancarias asociadas a proveedores
-- ============================================================================

USE Lefarma;
GO

-- ============================================================================
-- 1. TABLA: formas_pago
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[formas_pago]'))
BEGIN
    CREATE TABLE [catalogos].[formas_pago]
    (
        [id_forma_pago] INT IDENTITY(1,1) PRIMARY KEY,
        [nombre] NVARCHAR(100) NOT NULL,
        [nombre_normalizado] NVARCHAR(100) NOT NULL,
        [descripcion] NVARCHAR(255) NULL,
        [descripcion_normalizada] NVARCHAR(255) NULL,
        [clave] NVARCHAR(20) NOT NULL,
        [requiere_cuenta] BIT NOT NULL DEFAULT 0,
        [activo] BIT NOT NULL DEFAULT 1,
        [fecha_creacion] DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_FormaPago_Clave UNIQUE ([clave]),
        CONSTRAINT UQ_FormaPago_NombreNormalizado UNIQUE ([nombre_normalizado])
    );
    PRINT 'Tabla [catalogos].[formas_pago] creada';
END
GO

-- ============================================================================
-- 2. TABLA: bancos
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[bancos]'))
BEGIN
    CREATE TABLE [catalogos].[bancos]
    (
        [id_banco] INT IDENTITY(1,1) PRIMARY KEY,
        [nombre] NVARCHAR(100) NOT NULL,
        [nombre_normalizado] NVARCHAR(100) NOT NULL,
        [clave] NVARCHAR(10) NULL,
        [codigo_swift] NVARCHAR(11) NULL,
        [descripcion] NVARCHAR(255) NULL,
        [descripcion_normalizada] NVARCHAR(255) NULL,
        [activo] BIT NOT NULL DEFAULT 1,
        [fecha_creacion] DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_Banco_NombreNormalizado UNIQUE ([nombre_normalizado]),
        CONSTRAINT UQ_Banco_Clave UNIQUE ([clave])
    );
    PRINT 'Tabla [catalogos].[bancos] creada';
END
GO

-- ============================================================================
-- 3. TABLA: proveedores_formas_pago (muchos-a-muchos)
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[proveedores_formas_pago]'))
BEGIN
    CREATE TABLE [catalogos].[proveedores_formas_pago]
    (
        [id_vinculacion] INT IDENTITY(1,1) PRIMARY KEY,
        [id_proveedor] INT NOT NULL,
        [id_forma_pago] INT NOT NULL,
        [fecha_creacion] DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_ProveedorFormaPago_Proveedor FOREIGN KEY ([id_proveedor])
            REFERENCES [catalogos].[proveedores]([id_proveedor]) ON DELETE CASCADE,
        CONSTRAINT FK_ProveedorFormaPago_FormaPago FOREIGN KEY ([id_forma_pago])
            REFERENCES [catalogos].[formas_pago]([id_forma_pago]) ON DELETE CASCADE,
        CONSTRAINT UQ_Proveedor_FormaPago UNIQUE ([id_proveedor], [id_forma_pago])
    );
    PRINT 'Tabla [catalogos].[proveedores_formas_pago] creada';
END
GO

-- ============================================================================
-- 4. TABLA: proveedor_forma_pago_cuentas
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[catalogos].[proveedor_forma_pago_cuentas]'))
BEGIN
    CREATE TABLE [catalogos].[proveedor_forma_pago_cuentas]
    (
        [id_cuenta] INT IDENTITY(1,1) PRIMARY KEY,
        [id_proveedor] INT NOT NULL,
        [id_forma_pago] INT NOT NULL,
        [id_banco] INT NULL,
        [numero_cuenta] NVARCHAR(50) NULL,
        [clabe] NVARCHAR(34) NULL,
        [numero_tarjeta] NVARCHAR(20) NULL,
        [beneficiario] NVARCHAR(255) NULL,
        [correo_notificacion] NVARCHAR(100) NULL,
        [activo] BIT NOT NULL DEFAULT 1,
        [fecha_creacion] DATETIME NOT NULL DEFAULT GETUTCDATE(),
        [fecha_modificacion] DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_PFC_Proveedor FOREIGN KEY ([id_proveedor])
            REFERENCES [catalogos].[proveedores]([id_proveedor]) ON DELETE CASCADE,
        CONSTRAINT FK_PFC_FormaPago FOREIGN KEY ([id_forma_pago])
            REFERENCES [catalogos].[formas_pago]([id_forma_pago]) ON DELETE RESTRICT,
        CONSTRAINT FK_PFC_Banco FOREIGN KEY ([id_banco])
            REFERENCES [catalogos].[bancos]([id_banco]) ON DELETE RESTRICT,
        CONSTRAINT UQ_Proveedor_FormaPago_Cuenta UNIQUE
            ([id_proveedor], [id_forma_pago], [numero_cuenta])
    );
    PRINT 'Tabla [catalogos].[proveedor_forma_pago_cuentas] creada';
END
GO

-- ============================================================================
-- 5. INDICES
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ProveedoresFormasPago_Proveedor'
    AND object_id = OBJECT_ID('[catalogos].[proveedores_formas_pago]'))
    CREATE NONCLUSTERED INDEX IX_ProveedoresFormasPago_Proveedor
    ON [catalogos].[proveedores_formas_pago]([id_proveedor]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ProveedoresFormasPago_FormaPago'
    AND object_id = OBJECT_ID('[catalogos].[proveedores_formas_pago]'))
    CREATE NONCLUSTERED INDEX IX_ProveedoresFormasPago_FormaPago
    ON [catalogos].[proveedores_formas_pago]([id_forma_pago]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PFC_Proveedor'
    AND object_id = OBJECT_ID('[catalogos].[proveedor_forma_pago_cuentas]'))
    CREATE NONCLUSTERED INDEX IX_PFC_Proveedor
    ON [catalogos].[proveedor_forma_pago_cuentas]([id_proveedor]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PFC_FormaPago'
    AND object_id = OBJECT_ID('[catalogos].[proveedor_forma_pago_cuentas]'))
    CREATE NONCLUSTERED INDEX IX_PFC_FormaPago
    ON [catalogos].[proveedor_forma_pago_cuentas]([id_forma_pago]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PFC_Banco'
    AND object_id = OBJECT_ID('[catalogos].[proveedor_forma_pago_cuentas]'))
    CREATE NONCLUSTERED INDEX IX_PFC_Banco
    ON [catalogos].[proveedor_forma_pago_cuentas]([id_banco]);
GO

PRINT '';
PRINT '============================================================';
PRINT 'ALTER TABLE completado: formas_pago, bancos,';
PRINT 'proveedores_formas_pago, proveedor_forma_pago_cuentas';
PRINT '============================================================';
GO
