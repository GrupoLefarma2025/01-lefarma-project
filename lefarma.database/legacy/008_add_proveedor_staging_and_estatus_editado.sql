-- ================================================================
-- Script 008: Staging para ediciones de proveedor
-- Schema: staging (espejo de catalogos.proveedores y relacionados)
-- ================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'staging')
BEGIN
    EXEC('CREATE SCHEMA staging');
END
GO

-- staging.proveedores: espejo de catalogos.proveedores
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'proveedores' AND schema_id = SCHEMA_ID('staging'))
BEGIN
    CREATE TABLE staging.proveedores (
        id_staging INT IDENTITY(1,1) PRIMARY KEY,
        id_proveedor INT NOT NULL,
        razon_social VARCHAR(255) NOT NULL,
        razon_social_normalizada VARCHAR(255) NOT NULL,
        rfc VARCHAR(13) NULL,
        codigo_postal VARCHAR(10) NULL,
        regimen_fiscal_id INT NULL,
        uso_cfdi VARCHAR(10) NULL,
        sin_datos_fiscales BIT NOT NULL DEFAULT(0),
        estatus INT NOT NULL DEFAULT(1),
        cambio_estatus_por INT NULL,
        fecha_registro DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE(),
        fecha_staging DATETIME NOT NULL DEFAULT GETDATE(),
        editado_por INT NULL
    );

    CREATE INDEX IX_StagingProveedores_IdProveedor ON staging.proveedores(id_proveedor);
    CREATE INDEX IX_StagingProveedores_FechaStaging ON staging.proveedores(fecha_staging);
END
GO

-- staging.proveedores_detalles: espejo de catalogos.proveedores_detalle
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'proveedores_detalles' AND schema_id = SCHEMA_ID('staging'))
BEGIN
    CREATE TABLE staging.proveedores_detalles (
        id_staging_detalle INT IDENTITY(1,1) PRIMARY KEY,
        id_staging INT NOT NULL,
        id_detalle INT NOT NULL,
        persona_contacto_nombre VARCHAR(255) NULL,
        contacto_telefono VARCHAR(20) NULL,
        contacto_email VARCHAR(255) NULL,
        comentario NVARCHAR(MAX) NULL,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE(),
        caratula_path VARCHAR(500) NULL
    );

    CREATE INDEX IX_StagingProveedoresDetalles_IdStaging ON staging.proveedores_detalles(id_staging);
END
GO

-- staging.proveedor_forma_pago_cuentas: espejo de catalogos.proveedor_forma_pago_cuentas
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'proveedor_forma_pago_cuentas' AND schema_id = SCHEMA_ID('staging'))
BEGIN
    CREATE TABLE staging.proveedor_forma_pago_cuentas (
        id_staging_cuenta INT IDENTITY(1,1) PRIMARY KEY,
        id_staging INT NOT NULL,
        id_forma_pago INT NOT NULL,
        id_banco INT NULL,
        numero_cuenta VARCHAR(50) NULL,
        clabe VARCHAR(18) NULL,
        numero_tarjeta VARCHAR(50) NULL,
        beneficiario VARCHAR(200) NULL,
        correo_notificacion VARCHAR(200) NULL,
        activo BIT NOT NULL DEFAULT(1)
    );

    CREATE INDEX IX_StagingProveedorFormaPagoCuentas_IdStaging ON staging.proveedor_forma_pago_cuentas(id_staging);
END
GO

-- Agregar columna id_staging a catalogos.proveedores (sin FK)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('catalogos.proveedores') AND name = 'id_staging')
BEGIN
    ALTER TABLE catalogos.proveedores
    ADD id_staging INT NULL;
END
GO

-- Agregar columna id_staging a catalogos.proveedores_detalle (sin FK)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('catalogos.proveedores_detalle') AND name = 'id_staging')
BEGIN
    ALTER TABLE catalogos.proveedores_detalle
    ADD id_staging INT NULL;
END
GO

-- Agregar columna caratula_url a catalogos.proveedores_detalle (si no existe)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('catalogos.proveedores_detalle') AND name = 'caratula_url')
BEGIN
    ALTER TABLE catalogos.proveedores_detalle
    ADD caratula_url VARCHAR(500) NULL;
END
GO

PRINT 'Script 008 ejecutado: schema staging con tablas espejo (sin FK)';
GO
