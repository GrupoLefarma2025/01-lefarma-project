-- ============================================================
-- 009_audit_logs.sql
-- Crea la tabla logs.audit_logs para auditoría de operaciones
-- de negocio (Create, Update, Delete).
--
-- Complementa:
--   - app.AuditLog  → eventos de login/sesión
--   - logs.error_logs → errores y excepciones
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'logs')
    EXEC('CREATE SCHEMA logs');
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'logs' AND t.name = 'audit_logs'
)
BEGIN
    CREATE TABLE logs.audit_logs (
        id_audit_log        BIGINT          NOT NULL IDENTITY(1,1),
        fecha_operacion     DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

        -- Entidad afectada
        entity_name         NVARCHAR(256)   NULL,
        entity_id           NVARCHAR(256)   NULL,
        nombre_entidad      NVARCHAR(512)   NULL,
        accion              NVARCHAR(100)   NOT NULL,   -- Create, Update, Delete, etc.

        -- Usuario
        user_id             NVARCHAR(256)   NULL,
        nombre_usuario      NVARCHAR(256)   NULL,
        ip_cliente          NVARCHAR(128)   NULL,

        -- HTTP
        metodo_http         NVARCHAR(10)    NULL,
        ruta_endpoint       NVARCHAR(500)   NULL,
        status_code         INT             NOT NULL DEFAULT 200,

        -- Resultado
        exitoso             BIT             NOT NULL DEFAULT 1,
        mensaje_error       NVARCHAR(2048)  NULL,

        -- Contexto adicional (JSON del WideEvent)
        datos_adicionales   NVARCHAR(MAX)   NULL,

        -- Correlación
        request_id          UNIQUEIDENTIFIER NULL,
        duration_ms         BIGINT           NULL,

        CONSTRAINT PK_audit_logs PRIMARY KEY (id_audit_log)
    );

    -- Índices para consultas frecuentes
    CREATE INDEX IX_AuditLog_FechaOperacion  ON logs.audit_logs (fecha_operacion DESC);
    CREATE INDEX IX_AuditLog_Entity          ON logs.audit_logs (entity_name, entity_id);
    CREATE INDEX IX_AuditLog_UserId          ON logs.audit_logs (user_id);
    CREATE INDEX IX_AuditLog_Accion          ON logs.audit_logs (accion);
    CREATE INDEX IX_AuditLog_RequestId       ON logs.audit_logs (request_id);

    PRINT 'Tabla logs.audit_logs creada correctamente.';
END
ELSE
BEGIN
    PRINT 'La tabla logs.audit_logs ya existe. No se realizaron cambios.';
END
GO
