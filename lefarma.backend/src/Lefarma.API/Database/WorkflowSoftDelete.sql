-- ============================================================================
-- Lefarma - Workflow Soft Delete
-- Agrega columna [activo] a tablas de configuración de workflow
-- ============================================================================
USE Lefarma;
GO

IF COL_LENGTH('config.workflow_pasos', 'activo') IS NULL
BEGIN
    ALTER TABLE config.workflow_pasos ADD activo BIT NOT NULL CONSTRAINT DF_workflow_pasos_activo DEFAULT(1);
END
GO

IF COL_LENGTH('config.workflow_acciones', 'activo') IS NULL
BEGIN
    ALTER TABLE config.workflow_acciones ADD activo BIT NOT NULL CONSTRAINT DF_workflow_acciones_activo DEFAULT(1);
END
GO

IF COL_LENGTH('config.workflow_condiciones', 'activo') IS NULL
BEGIN
    ALTER TABLE config.workflow_condiciones ADD activo BIT NOT NULL CONSTRAINT DF_workflow_condiciones_activo DEFAULT(1);
END
GO

IF COL_LENGTH('config.workflow_participantes', 'activo') IS NULL
BEGIN
    ALTER TABLE config.workflow_participantes ADD activo BIT NOT NULL CONSTRAINT DF_workflow_participantes_activo DEFAULT(1);
END
GO

IF COL_LENGTH('config.workflow_notificaciones', 'activo') IS NULL
BEGIN
    ALTER TABLE config.workflow_notificaciones ADD activo BIT NOT NULL CONSTRAINT DF_workflow_notificaciones_activo DEFAULT(1);
END
GO

PRINT 'Soft delete columns added/verified for workflow tables.';
GO
