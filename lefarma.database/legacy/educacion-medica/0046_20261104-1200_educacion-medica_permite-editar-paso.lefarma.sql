-- =============================================================================
-- 0046 - Edición por paso del workflow (Selección Mensual)
--
-- QUÉ HACE (idempotente)
--   1) Agrega config.workflow_pasos.permite_editar (BIT, default 0).
--   2) Habilita la edición en los pasos actuales de la selección mensual:
--      Creada, Firma Gerencia General y Firma Gerente de Ventas.
--
-- NOTA
--   Los pasos nuevos (por ejemplo, una revisión final no editable) quedan en 0
--   por default. Para hacerlos editables, marcar el checkbox en el admin de
--   workflows o actualizar manualmente la columna.
--
--   Para una BD NUEVA no hace falta ejecutar este script: 0018 crea la columna
--   y siembra permite_editar en los mismos pasos. Este archivo queda para
--   entornos ya existentes que aún no tienen la columna.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('config.workflow_pasos', 'permite_editar') IS NULL
    BEGIN
        ALTER TABLE config.workflow_pasos
        ADD permite_editar BIT NULL
            CONSTRAINT DF_workflow_pasos_permite_editar DEFAULT (0);

        PRINT 'Columna [permite_editar] agregada a config.workflow_pasos.';
    END
    ELSE
        PRINT 'Columna [permite_editar] ya existe en config.workflow_pasos. Skip.';

    UPDATE p
    SET p.permite_editar = 1
    FROM config.workflow_pasos p
    INNER JOIN config.workflows w ON w.id_workflow = p.id_workflow
    WHERE w.codigo_proceso = N'EDUCACION_MEDICA_SELECCION'
      AND p.activo = 1
      AND p.es_final = 0
      AND (
            p.es_inicio = 1
            OR p.nombre_paso LIKE N'Firma Gerencia General%'
            OR p.nombre_paso LIKE N'Firma Gerente de Ventas%'
      );

    PRINT 'Pasos editables habilitados para EDUCACION_MEDICA_SELECCION.';

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0046: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
