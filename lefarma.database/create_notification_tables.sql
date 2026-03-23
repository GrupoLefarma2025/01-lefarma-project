-- Notification Tables for Lefarma
-- These tables support the multi-channel notification system

USE [Lefarma]
GO

-- Ensure schema exists
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'app')
BEGIN
    EXEC('CREATE SCHEMA [app]')
END
GO

-- Notifications table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notifications' AND schema_id = SCHEMA_ID('app'))
BEGIN
    CREATE TABLE [app].[Notifications] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [Title] NVARCHAR(255) NOT NULL,
        [Message] NVARCHAR(MAX) NOT NULL,
        [Type] NVARCHAR(50) NOT NULL DEFAULT 'info',  -- info, warning, error, success, alert
        [Priority] NVARCHAR(50) NOT NULL DEFAULT 'normal',  -- low, normal, high, urgent
        [Category] NVARCHAR(100) NOT NULL DEFAULT 'system',
        [TemplateId] NVARCHAR(255) NULL,
        [TemplateData] NVARCHAR(MAX) NULL,  -- JSON
        [CreatedBy] NVARCHAR(256) NOT NULL DEFAULT 'system',
        [ScheduledFor] DATETIME2 NULL,
        [ExpiresAt] DATETIME2 NULL,
        [RetryCount] INT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    -- Indexes for performance
    CREATE INDEX IX_Notifications_CreatedAt ON [app].[Notifications]([CreatedAt]);
    CREATE INDEX IX_Notifications_ExpiresAt ON [app].[Notifications]([ExpiresAt]);
    CREATE INDEX IX_Notifications_ScheduledFor ON [app].[Notifications]([ScheduledFor]);
    CREATE INDEX IX_Notifications_ScheduledFor_Priority ON [app].[Notifications]([ScheduledFor], [Priority]);
    CREATE INDEX IX_Notifications_Type_CreatedAt ON [app].[Notifications]([Type], [CreatedAt]);

    PRINT 'Notifications table created successfully';
END
ELSE
BEGIN
    PRINT 'Notifications table already exists';
END
GO

-- NotificationChannels table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationChannels' AND schema_id = SCHEMA_ID('app'))
BEGIN
    CREATE TABLE [app].[NotificationChannels] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [NotificationId] INT NOT NULL,
        [ChannelType] NVARCHAR(50) NOT NULL,  -- email, in-app, telegram
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, sent, failed, retrying
        [Recipient] NVARCHAR(500) NOT NULL,  -- email;email or chatId;chatId
        [SentAt] DATETIME2 NULL,
        [ErrorMessage] NVARCHAR(MAX) NULL,
        [RetryCount] INT NOT NULL DEFAULT 0,
        [ExternalId] NVARCHAR(255) NULL,  -- messageId, telegram_id
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_NotificationChannels_Notifications FOREIGN KEY ([NotificationId])
            REFERENCES [app].[Notifications]([Id]) ON DELETE CASCADE
    );

    -- Indexes
    CREATE INDEX IX_NotificationChannels_NotificationId ON [app].[NotificationChannels]([NotificationId]);
    CREATE INDEX IX_NotificationChannels_ChannelType ON [app].[NotificationChannels]([ChannelType]);
    CREATE INDEX IX_NotificationChannels_Status ON [app].[NotificationChannels]([Status]);
    CREATE INDEX IX_NotificationChannels_SentAt ON [app].[NotificationChannels]([SentAt]);

    PRINT 'NotificationChannels table created successfully';
END
ELSE
BEGIN
    PRINT 'NotificationChannels table already exists';
END
GO

-- UserNotifications table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserNotifications' AND schema_id = SCHEMA_ID('app'))
BEGIN
    CREATE TABLE [app].[UserNotifications] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [NotificationId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [IsRead] BIT NOT NULL DEFAULT 0,
        [ReadAt] DATETIME2 NULL,
        [ReceivedVia] NVARCHAR(MAX) NOT NULL DEFAULT '[]',  -- JSON array of channels
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_UserNotifications_Notifications FOREIGN KEY ([NotificationId])
            REFERENCES [app].[Notifications]([Id]) ON DELETE CASCADE
    );

    -- Indexes
    CREATE INDEX IX_UserNotifications_UserId ON [app].[UserNotifications]([UserId]);
    CREATE INDEX IX_UserNotifications_NotificationId ON [app].[UserNotifications]([NotificationId]);
    CREATE INDEX IX_UserNotifications_IsRead ON [app].[UserNotifications]([IsRead]);
    CREATE INDEX IX_UserNotifications_UserId_NotificationId ON [app].[UserNotifications]([UserId], [NotificationId]);

    PRINT 'UserNotifications table created successfully';
END
ELSE
BEGIN
    PRINT 'UserNotifications table already exists';
END
GO

PRINT 'Notification system tables setup complete';
GO
