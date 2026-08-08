-- Migration 014: Add envia_concentrado column to workflow_acciones
-- Date: 2025-05-05
-- Author: AI Assistant
-- Description: Adds a flag to workflow actions to indicate if they should trigger external system communication (envio concentrado)

USE Lefarma;
GO

ALTER TABLE config.workflow_acciones
ADD envia_concentrado BIT NOT NULL DEFAULT 0;
GO

PRINT 'Column envia_concentrado added to config.workflow_acciones';
GO
