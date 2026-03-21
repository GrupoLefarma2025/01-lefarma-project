-- Create FormasPago table only
-- Run this directly in SQL Server Management Studio or any SQL client

USE Lefarma;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'formas_pago' AND schema_id = SCHEMA_ID('catalogos'))
BEGIN
    CREATE TABLE catalogos.formas_pago (
        id_forma_pago INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(255) NOT NULL,
        nombre_normalizado NVARCHAR(255) NOT NULL,
        descripcion NVARCHAR(500) NULL,
        descripcion_normalizada NVARCHAR(500) NULL,
        clave NVARCHAR(50) NULL,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETDATE() NOT NULL,
        fecha_modificacion DATETIME DEFAULT GETDATE() NULL
    );
    PRINT 'Tabla catalogos.formas_pago creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'La tabla catalogos.formas_pago ya existe.';
END
GO
