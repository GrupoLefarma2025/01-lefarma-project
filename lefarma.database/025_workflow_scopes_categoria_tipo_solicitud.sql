-- =============================================================================
-- MIGRACIÓN: Nuevos scope types dinámicos para workflow
-- DESCRIPCIÓN: Agrega scopes CATEGORIA y TIPO_SOLICITUD para habilitar
--              ruteo de workflows por categoría/tipo de solicitud personal.
-- IMPORTANTE:  Este script es de ejemplo. Ajustar IDs de workflow reales
--              y scope_id según la BD de destino.
--
-- NOTA PARA AGREGAR UN NUEVO SCOPE DINÁMICO:
--   1. Insertar el scope type en config.workflow_scope_types.
--   2. Incluir la clave (codigo) y su valor en el diccionario del caller C#.
--   3. Crear los mappings necesarios en config.workflow_mappings.
-- =============================================================================

-- 1. Insertar nuevos tipos de scope
INSERT INTO config.workflow_scope_types (codigo, nombre, nivel_prioridad, descripcion, activo)
VALUES
    ('CATEGORIA',      'Por categoría de solicitud', 35, 'Rutea workflows según la categoría de solicitud personal', 1),
    ('TIPO_SOLICITUD', 'Por tipo de solicitud',      45, 'Rutea workflows según el tipo específico de solicitud',    1);
GO

-- 2. Ejemplo: workflow específico para solicitudes de permisos (Categoria = 2)
INSERT INTO config.workflow_mappings
    (codigo_proceso, id_scope_type, scope_id, id_workflow, prioridad_manual, activo, observaciones, fecha_creacion)
VALUES
    ('SOLICITUD_PERSONAL',
     (SELECT id_scope_type FROM config.workflow_scope_types WHERE codigo = 'CATEGORIA'),
     2,   -- CategoriaSolicitud.Permiso
     11,  -- id_workflow objetivo (ajustar en BD real)
     100, 1, 'Workflow para permisos', GETDATE());

-- 3. Ejemplo: workflow específico para un tipo de solicitud concreto
INSERT INTO config.workflow_mappings
    (codigo_proceso, id_scope_type, scope_id, id_workflow, prioridad_manual, activo, observaciones, fecha_creacion)
VALUES
    ('SOLICITUD_PERSONAL',
     (SELECT id_scope_type FROM config.workflow_scope_types WHERE codigo = 'TIPO_SOLICITUD'),
     5,   -- id_tipo_solicitud objetivo (ajustar en BD real)
     12,  -- id_workflow objetivo (ajustar en BD real)
     100, 1, 'Workflow especial permiso médico', GETDATE());
GO
