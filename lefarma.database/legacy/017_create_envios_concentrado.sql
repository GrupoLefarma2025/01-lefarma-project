-- Migration 017: Create envios_concentrado tables
-- Date: 2025-05-05
-- Description: Adds intermediate table to track concentrado shipments to external system

USE Lefarma;
GO

-- Tabla maestra de envíos de concentrado
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[operaciones].[envios_concentrado]'))
BEGIN
    CREATE TABLE operaciones.envios_concentrado (
        id_envio_concentrado INT IDENTITY(1,1) PRIMARY KEY,
        id_usuario_envio INT NOT NULL,
        fecha_envio DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Estado del concentrado
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' 
            CONSTRAINT CHK_envios_concentrado_estado 
            CHECK (estado IN ('PENDIENTE', 'APROBADO', 'DEVUELTO')),
        
        -- Respuesta del sistema externo
        fecha_respuesta DATETIME2 NULL,
        id_usuario_respuesta INT NULL,
        comentario_respuesta NVARCHAR(500) NULL,
        
        -- Token de seguridad para validar respuesta
        token_seguridad VARCHAR(100) NOT NULL UNIQUE,
        
        -- Datos del concentrado
        total DECIMAL(18,2) NOT NULL DEFAULT 0,
        cantidad_ordenes INT NOT NULL DEFAULT 0,
        
        -- Auditoría
        fecha_creacion DATETIME2 NOT NULL DEFAULT GETDATE(),
        fecha_modificacion DATETIME2 NULL,
        
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT 'Tabla [operaciones].[envios_concentrado] creada';
END
ELSE
BEGIN
    PRINT 'Tabla [operaciones].[envios_concentrado] ya existe';
END
GO

-- Tabla de relación: concentrado <-> ordenes
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[operaciones].[envios_concentrado_ordenes]'))
BEGIN
    CREATE TABLE operaciones.envios_concentrado_ordenes (
        id_envio_concentrado INT NOT NULL,
        id_orden INT NOT NULL,
        CONSTRAINT PK_envios_concentrado_ordenes PRIMARY KEY (id_envio_concentrado, id_orden),
        CONSTRAINT FK_envios_concentrado_ordenes_concentrado 
            FOREIGN KEY (id_envio_concentrado) REFERENCES operaciones.envios_concentrado(id_envio_concentrado),
        CONSTRAINT FK_envios_concentrado_ordenes_orden 
            FOREIGN KEY (id_orden) REFERENCES operaciones.ordenes_compra(id_orden)
    );
    PRINT 'Tabla [operaciones].[envios_concentrado_ordenes] creada';
END
ELSE
BEGIN
    PRINT 'Tabla [operaciones].[envios_concentrado_ordenes] ya existe';
END
GO

-- Índices
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_envios_concentrado_estado' AND object_id = OBJECT_ID('[operaciones].[envios_concentrado]'))
BEGIN
    CREATE INDEX IX_envios_concentrado_estado 
        ON operaciones.envios_concentrado(estado) 
        WHERE estado = 'PENDIENTE';
    PRINT 'Índice IX_envios_concentrado_estado creado';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_envios_concentrado_ordenes_orden' AND object_id = OBJECT_ID('[operaciones].[envios_concentrado_ordenes]'))
BEGIN
    CREATE INDEX IX_envios_concentrado_ordenes_orden 
        ON operaciones.envios_concentrado_ordenes(id_orden);
    PRINT 'Índice IX_envios_concentrado_ordenes_orden creado';
END
GO

PRINT 'Migration 017 completada';
GO
