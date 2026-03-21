# Script para crear la tabla de Formas de Pago
# Ejecutar en PowerShell o SQL Server Management Studio

$Server = "192.168.4.2"
$Database = "Lefarma"
$User = "coreapi"
$Password = "L4_CL4VE_S3cReta_Y_sUp3r__SEGUR4_123!"

$SqlConnection = New-Object System.Data.SqlClient.SqlConnection
$SqlConnection.ConnectionString = "Server=$Server;Database=$Database;User Id=$User;Password=$Password;"
$SqlConnection.Open()

$SqlScript = @"
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

-- Insertar datos iniciales
IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE nombre = 'Pago a contado')
BEGIN
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES ('Pago a contado', 'pago a contado', 'Pago total al momento', 'pago total al momento', 'EFO', 1);
    PRINT 'Pago a contado insertado.';
END

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE nombre = 'Pago a crédito')
BEGIN
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES ('Pago a crédito', 'pago a credito', 'Pago diferido según acuerdo con proveedor', 'pago diferido segun acuerdo con proveedor', 'CRE', 1);
    PRINT 'Pago a crédito insertado.';
END

IF NOT EXISTS (SELECT * FROM catalogos.formas_pago WHERE nombre = 'Pago parcial')
BEGIN
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES ('Pago parcial', 'pago parcial', 'Anticipo + saldo pendiente', 'anticipo + saldo pendiente', 'PAR', 1);
    PRINT 'Pago parcial insertado.';
END

GO

SELECT * FROM catalogos.formas_pago;
GO
"@

$SqlCommand = New-Object System.Data.SqlClient.SqlCommand($SqlScript, $SqlConnection)
$SqlCommand.ExecuteNonQuery()

$SqlConnection.Close()

Write-Host "✓ Tabla formas_pago creada y datos insertados exitosamente." -ForegroundColor Green
