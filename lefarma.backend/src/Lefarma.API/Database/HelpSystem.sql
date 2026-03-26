-- ============================================================================
-- Lefarma - Sistema de Ayuda y Soporte
-- Script de creación de tablas (SQL Server)
-- ============================================================================

USE Lefarma;
GO

-- ============================================================================
-- Crear Schema
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'help')
BEGIN
    EXECUTE('CREATE SCHEMA [help]');
END
GO

-- ============================================================================
-- Tabla: HelpModules
-- Almacena los módulos de documentación
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HelpModules' AND schema_id = SCHEMA_ID('help'))
BEGIN
    CREATE TABLE [help].HelpModules (
        [id]               INT IDENTITY(1,1) PRIMARY KEY,
        [nombre]           NVARCHAR(50) NOT NULL UNIQUE,
        [label]            NVARCHAR(100) NOT NULL,
        [orden]            INT NOT NULL DEFAULT 0,
        [activo]           BIT NOT NULL DEFAULT 1,
        [fecha_creacion]    DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [fecha_actualizacion] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE NONCLUSTERED INDEX [IX_HelpModules_orden_activo]
        ON [help].HelpModules([orden], [activo]);

    PRINT '✓ Tabla [help].HelpModules creada exitosamente';
END
ELSE
BEGIN
    PRINT '⚠ Tabla [help].HelpModules ya existe';
END
GO

-- ============================================================================
-- Tabla: HelpArticles
-- Almacena los artículos de documentación con contenido JSON de Lexical
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HelpArticles' AND schema_id = SCHEMA_ID('help'))
BEGIN
    CREATE TABLE [help].HelpArticles (
        [id]               INT IDENTITY(1,1) PRIMARY KEY,
        [titulo]           NVARCHAR(200) NOT NULL,
        [contenido]        NVARCHAR(MAX) NOT NULL,
        [resumen]          NVARCHAR(500) NULL,
        [modulo_id]        INT NULL,
        [modulo]           NVARCHAR(50) NOT NULL,
        [tipo]             NVARCHAR(50) NOT NULL DEFAULT 'usuario',
        [categoria]        NVARCHAR(100) NULL,
        [orden]            INT NOT NULL DEFAULT 0,
        [activo]           BIT NOT NULL DEFAULT 1,
        [fecha_creacion]    DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [fecha_actualizacion] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [creado_por]        NVARCHAR(100) NULL,
        [actualizado_por]   NVARCHAR(100) NULL,
        CONSTRAINT [FK_HelpArticles_HelpModules] FOREIGN KEY ([modulo_id])
            REFERENCES [help].HelpModules([id]) ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX [IX_HelpArticles_modulo_activo]
        ON [help].HelpArticles([modulo], [activo]);

    CREATE NONCLUSTERED INDEX [IX_HelpArticles_tipo_activo]
        ON [help].HelpArticles([tipo], [activo]);

    CREATE NONCLUSTERED INDEX [IX_HelpArticles_categoria_activo]
        ON [help].HelpArticles([categoria], [activo])
        WHERE [categoria] IS NOT NULL;

    PRINT '✓ Tabla [help].HelpArticles creada exitosamente';
END
ELSE
BEGIN
    PRINT '⚠ Tabla [help].HelpArticles ya existe';
END
GO

-- ============================================================================
-- Tabla: HelpImages
-- Almacena información de imágenes subidas para la documentación
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HelpImages' AND schema_id = SCHEMA_ID('help'))
BEGIN
    CREATE TABLE [help].HelpImages (
        [id]               INT IDENTITY(1,1) PRIMARY KEY,
        [nombre_original]   NVARCHAR(255) NOT NULL,
        [nombre_archivo]    NVARCHAR(255) NOT NULL,
        [ruta_relativa]     NVARCHAR(500) NOT NULL,
        [tamano_bytes]     BIGINT NOT NULL,
        [mime_type]         NVARCHAR(100) NOT NULL,
        [ancho]            INT NULL,
        [alto]             INT NULL,
        [fecha_subida]      DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [subido_por]        NVARCHAR(100) NULL
    );

    CREATE NONCLUSTERED INDEX [IX_HelpImages_nombre_archivo]
        ON [help].HelpImages([nombre_archivo]);

    CREATE NONCLUSTERED INDEX [IX_HelpImages_fecha_subida]
        ON [help].HelpImages([fecha_subida] DESC);

    PRINT '✓ Tabla [help].HelpImages creada exitosamente';
END
ELSE
BEGIN
    PRINT '⚠ Tabla [help].HelpImages ya existe';
END
GO

-- ============================================================================
-- Datos iniciales: Módulos
-- ============================================================================
IF NOT EXISTS (SELECT * FROM [help].HelpModules)
BEGIN
    INSERT INTO [help].HelpModules (nombre, label, orden) VALUES
    ('General', 'General', 1),
    ('Catalogos', 'Catálogos', 2),
    ('Auth', 'Autenticación', 3),
    ('Notificaciones', 'Notificaciones', 4),
    ('Profile', 'Perfil', 5),
    ('Admin', 'Administración', 6),
    ('SystemConfig', 'Configuración', 7);

    PRINT '✓ Módulos iniciales insertados';
END
GO

PRINT '';
PRINT '====================================';
PRINT '✓ Script completado exitosamente';
PRINT '====================================';
PRINT 'Schema: [help]';
PRINT 'Tablas creadas:';
PRINT '  - [help].HelpModules';
PRINT '  - [help].HelpArticles';
PRINT '  - [help].HelpImages';
PRINT '====================================';
GO
