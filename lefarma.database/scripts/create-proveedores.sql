-- ============================================================================
-- CREAR TABLA: Proveedores
-- ============================================================================
-- Catálogo de proveedores para el sistema de Cuentas por Pagar
-- ============================================================================

USE Lefarma;
GO

-- Solo crear si no existe
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
    PRINT '✅ Tabla [catalogos].[proveedores] creada';
END
ELSE
BEGIN
    PRINT 'ℹ️  La tabla [catalogos].[proveedores] ya existe';
END
GO

-- Crear índices para búsquedas comunes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Proveedores_RazonSocial' AND object_id = OBJECT_ID('[catalogos].[proveedores]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Proveedores_RazonSocial
    ON catalogos.proveedores(razon_social_normalizada);
    PRINT '✅ Índice IX_Proveedores_RazonSocial creado';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Proveedores_RFC' AND object_id = OBJECT_ID('[catalogos].[proveedores]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Proveedores_RFC
    ON catalogos.proveedores(rfc);
    PRINT '✅ Índice IX_Proveedores_RFC creado';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Proveedores_AutorizadoPorCxP' AND object_id = OBJECT_ID('[catalogos].[proveedores]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Proveedores_AutorizadoPorCxP
    ON catalogos.proveedores(autorizado_por_cxp);
    PRINT '✅ Índice IX_Proveedores_AutorizadoPorCxP creado';
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'PROVEEDORES: Tabla creada exitosamente';
PRINT 'NOTA: La tabla se crea vacía - se llena por operación CxP';
PRINT '============================================================';
GO
