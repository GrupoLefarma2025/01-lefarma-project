-- Migration 016: Add workflow states for envio concentrado flow
-- Date: 2025-05-05
-- Author: AI Assistant
-- Description: Adds states for the preparation step (before sending concentrado)
--              and optionally for the director review step

USE Lefarma;
GO

SET IDENTITY_INSERT config.workflow_estados ON;

-- Estado para el paso de preparación de concentrado (antes de enviar)
-- Este es el estado por el que filtra EnvioConcentrado.tsx
IF NOT EXISTS (SELECT 1 FROM config.workflow_estados WHERE codigo = 'PREPARACION_GAF')
BEGIN
    INSERT INTO config.workflow_estados (id_estado, codigo, nombre, color_hex, activo)
    VALUES (11, 'PREPARACION_GAF', 'Preparación GAF', '#8B5CF6', 1);
    PRINT 'Estado PREPARACION_GAF creado (id_estado = 11)';
END
ELSE
BEGIN
    PRINT 'Estado PREPARACION_GAF ya existe';
END

-- Estado para el paso del Director (después de enviar concentrado)
-- Opcional: solo si el paso del Director no tiene ya un estado asignado
IF NOT EXISTS (SELECT 1 FROM config.workflow_estados WHERE codigo = 'REVISION_DIRECTOR')
BEGIN
    INSERT INTO config.workflow_estados (id_estado, codigo, nombre, color_hex, activo)
    VALUES (12, 'REVISION_DIRECTOR', 'Revisión Director', '#EC4899', 1);
    PRINT 'Estado REVISION_DIRECTOR creado (id_estado = 12)';
END
ELSE
BEGIN
    PRINT 'Estado REVISION_DIRECTOR ya existe';
END

SET IDENTITY_INSERT config.workflow_estados OFF;
GO

PRINT 'Migration 016 completada';
GO
