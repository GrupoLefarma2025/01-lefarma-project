-- =============================================================================
-- 019. QUITAR id_workflow DE config.workflow_campos (globalizar campos)
-- =============================================================================
-- Objetivo: Los campos de workflow ahora son globales (no atados a un workflow
--           especifico). Se enlazan a los handlers via id_workflow_campo.
-- =============================================================================

-- Eliminar FK si existe
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('[config].[workflow_campos]') AND name = 'FK_workflow_campos_workflow')
BEGIN
    ALTER TABLE config.workflow_campos DROP CONSTRAINT FK_workflow_campos_workflow;
    PRINT 'FK [FK_workflow_campos_workflow] eliminada';
END
GO

-- Eliminar indice unico antiguo (id_workflow, nombre_tecnico) si existe
IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[config].[workflow_campos]') AND name = 'UX_workflow_campos_workflow_nombre')
BEGIN
    DROP INDEX UX_workflow_campos_workflow_nombre ON config.workflow_campos;
    PRINT 'Indice [UX_workflow_campos_workflow_nombre] eliminado';
END
GO

-- Eliminar columna id_workflow si existe
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[config].[workflow_campos]') AND name = 'id_workflow')
BEGIN
    ALTER TABLE config.workflow_campos DROP CONSTRAINT IF EXISTS DF__workflow_campos__id_wor; -- default constraint si existe
    ALTER TABLE config.workflow_campos DROP COLUMN id_workflow;
    PRINT 'Columna [id_workflow] eliminada';
END
GO

-- Crear nuevo indice unico global sobre nombre_tecnico
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[config].[workflow_campos]') AND name = 'UX_workflow_campos_nombre')
BEGIN
    CREATE UNIQUE INDEX UX_workflow_campos_nombre ON config.workflow_campos (nombre_tecnico);
    PRINT 'Indice [UX_workflow_campos_nombre] creado';
END
GO
