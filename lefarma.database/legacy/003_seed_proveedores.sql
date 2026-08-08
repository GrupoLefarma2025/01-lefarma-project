
drop table catalogos.proveedores_detalle
drop table catalogos.proveedores



-- ---------------------------------------------------------------------------
-- catalogos.proveedores (FK -> regimenes_fiscales)
-- ---------------------------------------------------------------------------
-- DROP IF EXISTS
IF EXISTS (SELECT *
FROM sys.tables
WHERE object_id = OBJECT_ID('[catalogos].[proveedores_detalle]'))
BEGIN
    DROP TABLE [catalogos].[proveedores_detalle];
    PRINT 'Tabla [catalogos].[proveedores_detalle] eliminada';
END
GO

IF EXISTS (SELECT *
FROM sys.tables
WHERE object_id = OBJECT_ID('[catalogos].[proveedores]'))
BEGIN
    DROP TABLE [catalogos].[proveedores];
    PRINT 'Tabla [catalogos].[proveedores] eliminada';
END
GO

-- CREATE TABLE proveedores (datos fiscales principales del proveedor)
CREATE TABLE [catalogos].[proveedores]
(
    id_proveedor INT IDENTITY(1,1) PRIMARY KEY,
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
    CONSTRAINT FK_Proveedores_RegimenFiscal FOREIGN KEY (regimen_fiscal_id)
        REFERENCES [catalogos].[regimenes_fiscales](id_regimen_fiscal),
    CONSTRAINT UQ_Proveedores_RFC UNIQUE (rfc)
);
PRINT 'Tabla [catalogos].[proveedores] creada';
GO

-- CREATE TABLE proveedores_detalle (datos de contacto y adicionales)
CREATE TABLE [catalogos].[proveedores_detalle]
(
    id_detalle INT IDENTITY(1,1) PRIMARY KEY,
    id_proveedor INT NOT NULL,
    persona_contacto_nombre VARCHAR(255) NULL,
    contacto_telefono VARCHAR(20) NULL,
    contacto_email VARCHAR(255) NULL,
    comentario NVARCHAR(MAX) NULL,
    fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
    fecha_modificacion DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_ProveedoresDetalle_Proveedor FOREIGN KEY (id_proveedor)
        REFERENCES [catalogos].[proveedores](id_proveedor) ON DELETE CASCADE
);
PRINT 'Tabla [catalogos].[proveedores_detalle] creada';
GO

PRINT '';
PRINT '============================================================';
PRINT 'CATALOGOS - Tablas proveedores y proveedores_detalle creadas';
PRINT '============================================================';
PRINT '';
GO




-- ============================================================================
-- SEED: catalogos.proveedores y catalogos.proveedores_detalle
-- ============================================================================
-- Estatus: 1=Nuevo, 2=Aprobado, 3=Rechazado

SET IDENTITY_INSERT [catalogos].[proveedores] ON;
GO

INSERT INTO [catalogos].[proveedores]
    (
    id_proveedor,
    razon_social,
    razon_social_normalizada,
    rfc,
    codigo_postal,
    regimen_fiscal_id,
    uso_cfdi,
    sin_datos_fiscales,
    estatus,
    cambio_estatus_por,
    fecha_registro,
    fecha_modificacion
    )
VALUES
    (1, N'Farmacia del Norte S.A. de C.V.', N'FARMACIA DEL NORTE SA DE CV', N'FNO950612J54', N'06600', 1, N'G01', 0, 1, NULL, GETDATE(), GETDATE()),
    (2, N'Distribuidora Médica del Centro S.A. de C.V.', N'DISTRIBUIDORA MEDICA DEL CENTRO SA DE CV', N'DMC880405KS2', N'06100', 1, N'G01', 0, 2, 1, GETDATE(), GETDATE()),
    (3, N'Laboratorios Biofármacos S.A. de C.V.', N'LABORATORIOS BIOFARMACOS SA DE CV', N'LBF010315H43', N'54060', 2, N'G01', 0, 1, NULL, GETDATE(), GETDATE()),
    (4, N'José Luis Pérez Vázquez', N'JOSE LUIS PEREZ VAZQUEZ', N'PEVL8501015H8', N'50090', 3, N'G03', 0, 1, NULL, GETDATE(), GETDATE()),
    (5, N'Comercializadora de Insumos Médicos S.A. de C.V.', N'COMERCIALIZADORA DE INSUMOS MEDICOS SA DE CV', N'CIM1908012A7', N'37700', 1, N'G01', 0, 2, 1, GETDATE(), GETDATE());
GO

SET IDENTITY_INSERT [catalogos].[proveedores] OFF;
GO

SET IDENTITY_INSERT [catalogos].[proveedores_detalle] ON;
GO

INSERT INTO [catalogos].[proveedores_detalle]
    (
    id_detalle,
    id_proveedor,
    persona_contacto_nombre,
    contacto_telefono,
    contacto_email,
    comentario,
    fecha_creacion,
    fecha_modificacion
    )
VALUES
    (1, 1, N'María García López', N'55-1234-5678', N'mgarcia@farmaciadelnorte.com', NULL, GETDATE(), GETDATE()),
    (2, 2, N'Juan Hernández Martínez', N'55-2345-6789', N'jhernandez@distmedicacentro.com', NULL, GETDATE(), GETDATE()),
    (3, 3, N'Laura Rodríguez Sánchez', N'55-3456-7890', N'lrodriguez@laboratoriosbiofarmacos.com', NULL, GETDATE(), GETDATE()),
    (4, 4, N'José Luis Pérez', N'55-4567-8901', N'jlperez@materialcuracion.com', NULL, GETDATE(), GETDATE()),
    (5, 5, N'Ana María Torres Cruz', N'55-5678-9012', N'atorres@insumosmedicos.com', NULL, GETDATE(), GETDATE());
GO

SET IDENTITY_INSERT [catalogos].[proveedores_detalle] OFF;
GO

PRINT 'Seed: catalogos.proveedores (5) y catalogos.proveedores_detalle (5) - estatus: 1=Nuevo, 2=Aprobado, 3=Rechazado - columnas: comentario';
GO
