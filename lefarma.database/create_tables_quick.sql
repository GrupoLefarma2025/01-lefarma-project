-- ===============================================
-- Script SQL para crear tablas de notificaciones
-- Ejecutar en la base de datos Lefarma
-- Server: 192.168.4.2
-- Database: Lefarma
-- ===============================================

USE [Lefarma]
GO

-- Crear esquema app si no existe
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'app')
BEGIN
    EXEC('CREATE SCHEMA [app]');
    PRINT '✓ Schema [app] creado';
END
ELSE
    PRINT '✓ Schema [app] ya existe';
GO

PRINT '';
PRINT '--- Creando tabla Notifications ---';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notifications' AND schema_id = SCHEMA_ID('app'))
BEGIN
    CREATE TABLE [app].[Notifications] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [Title] NVARCHAR(255) NOT NULL,
        [Message] NVARCHAR(MAX) NOT NULL,
        [Type] NVARCHAR(50) NOT NULL DEFAULT 'info',
        [Priority] NVARCHAR(50) NOT NULL DEFAULT 'normal',
        [Category] NVARCHAR(100) NOT NULL DEFAULT 'system',
        [TemplateId] NVARCHAR(255) NULL,
        [TemplateData] NVARCHAR(MAX) NULL,
        [CreatedBy] NVARCHAR(256) NOT NULL DEFAULT 'system',
        [ScheduledFor] DATETIME2 NULL,
        [ExpiresAt] DATETIME2 NULL,
        [RetryCount] INT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_Notifications_CreatedAt ON [app].[Notifications]([CreatedAt]);
    CREATE INDEX IX_Notifications_ExpiresAt ON [app].[Notifications]([ExpiresAt]);
    CREATE INDEX IX_Notifications_ScheduledFor ON [app].[Notifications]([ScheduledFor]);

    PRINT '✓ Tabla [app].[Notifications] creada con índices';
END
ELSE
    PRINT '✓ Tabla [app].[Notifications] ya existe';
GO

PRINT '';
PRINT '--- Creando tabla NotificationChannels ---';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationChannels' AND schema_id = SCHEMA_ID('app'))
BEGIN
    CREATE TABLE [app].[NotificationChannels] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [NotificationId] INT NOT NULL,
        [ChannelType] NVARCHAR(50) NOT NULL,
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'pending',
        [Recipient] NVARCHAR(500) NOT NULL,
        [SentAt] DATETIME2 NULL,
        [ErrorMessage] NVARCHAR(MAX) NULL,
        [RetryCount] INT NOT NULL DEFAULT 0,
        [ExternalId] NVARCHAR(255) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_NotificationChannels_Notifications FOREIGN KEY ([NotificationId])
            REFERENCES [app].[Notifications]([Id]) ON DELETE CASCADE
    );

    CREATE INDEX IX_NotificationChannels_NotificationId ON [app].[NotificationChannels]([NotificationId]);
    CREATE INDEX IX_NotificationChannels_ChannelType ON [app].[NotificationChannels]([ChannelType]);
    CREATE INDEX IX_NotificationChannels_Status ON [app].[NotificationChannels]([Status]);
    CREATE INDEX IX_NotificationChannels_SentAt ON [app].[NotificationChannels]([SentAt]);

    PRINT '✓ Tabla [app].[NotificationChannels] creada con índices y FK';
END
ELSE
    PRINT '✓ Tabla [app].[NotificationChannels] ya existe';
GO

PRINT '';
PRINT '--- Creando tabla UserNotifications ---';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserNotifications' AND schema_id = SCHEMA_ID('app'))
BEGIN
    CREATE TABLE [app].[UserNotifications] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [NotificationId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [IsRead] BIT NOT NULL DEFAULT 0,
        [ReadAt] DATETIME2 NULL,
        [ReceivedVia] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_UserNotifications_Notifications FOREIGN KEY ([NotificationId])
            REFERENCES [app].[Notifications]([Id]) ON DELETE CASCADE
    );

    CREATE INDEX IX_UserNotifications_UserId ON [app].[UserNotifications]([UserId]);
    CREATE INDEX IX_UserNotifications_NotificationId ON [app].[UserNotifications]([NotificationId]);
    CREATE INDEX IX_UserNotifications_IsRead ON [app].[UserNotifications]([IsRead]);
    CREATE INDEX IX_UserNotifications_UserId_NotificationId ON [app].[UserNotifications]([UserId], [NotificationId]);

    PRINT '✓ Tabla [app].[UserNotifications] creada con índices y FK';
END
ELSE
    PRINT '✓ Tabla [app].[UserNotifications] ya existe';
GO

PRINT '';
PRINT '==================================================';
PRINT '✅ TABLAS DE NOTIFICACIONES CREADAS EXITOSAMENTE';
PRINT '==================================================';
PRINT '';
PRINT 'Tablas creadas:';
PRINT '  - app.Notifications';
PRINT '  - app.NotificationChannels';
PRINT '  - app.UserNotifications';
PRINT '';
PRINT 'El sistema de notificaciones está listo para usar.';
PRINT '==================================================';
GO
