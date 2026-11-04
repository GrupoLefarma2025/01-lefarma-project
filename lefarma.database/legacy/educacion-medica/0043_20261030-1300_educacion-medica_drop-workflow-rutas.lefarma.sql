-- =============================================================================
-- 0043 - Eliminar columnas historicas de workflow de rutas
-- =============================================================================
-- QUE HACE
--   - Elimina rutas_versiones.id_workflow, id_paso_actual e id_estado.
--   - Elimina defaults/indices residuales asociados si existen.
--
-- POR QUE
--   La version de rutas deja de ser entidad del motor de workflow. La matriz
--   de talleres es el unico documento autorizable. La planeacion conserva su
--   estado de negocio (Creada/Cerrada/...), pero no columnas de workflow.
--
-- ORDEN
--   Ejecutar despues de 0042.
--
-- NOTA
--   No elimina columnas de workflow de selecciones_mensuales ni de
--   matrices_generales. Es idempotente. NO EJECUTAR sin autorizacion.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('educacion_medica.rutas_versiones') IS NULL
BEGIN
    RAISERROR('No existe educacion_medica.rutas_versiones. Ejecute 0016 primero.', 16, 1);
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    -- Defaults residuales sobre las columnas a eliminar.
    DECLARE @dropDefaults nvarchar(max) = N'';
    SELECT @dropDefaults = @dropDefaults
        + N'ALTER TABLE educacion_medica.[rutas_versiones] DROP CONSTRAINT '
        + QUOTENAME(dc.[name]) + N';'
    FROM sys.default_constraints dc
    JOIN sys.columns c
      ON c.[object_id] = dc.[parent_object_id]
     AND c.[column_id] = dc.[parent_column_id]
    WHERE dc.[parent_object_id] = OBJECT_ID('educacion_medica.[rutas_versiones]')
      AND c.[name] IN ('id_workflow', 'id_paso_actual', 'id_estado');

    IF @dropDefaults <> N''
        EXEC sp_executesql @dropDefaults;

    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('educacion_medica.[rutas_versiones]')
          AND name = 'IX_rutas_versiones_id_estado'
    )
    BEGIN
        DROP INDEX [IX_rutas_versiones_id_estado]
            ON educacion_medica.[rutas_versiones];
        PRINT 'Indice [IX_rutas_versiones_id_estado] eliminado.';
    END

    IF COL_LENGTH('educacion_medica.rutas_versiones', 'id_workflow') IS NOT NULL
    BEGIN
        ALTER TABLE educacion_medica.[rutas_versiones] DROP COLUMN [id_workflow];
        PRINT 'Columna [rutas_versiones].[id_workflow] eliminada.';
    END

    IF COL_LENGTH('educacion_medica.rutas_versiones', 'id_paso_actual') IS NOT NULL
    BEGIN
        ALTER TABLE educacion_medica.[rutas_versiones] DROP COLUMN [id_paso_actual];
        PRINT 'Columna [rutas_versiones].[id_paso_actual] eliminada.';
    END

    IF COL_LENGTH('educacion_medica.rutas_versiones', 'id_estado') IS NOT NULL
    BEGIN
        ALTER TABLE educacion_medica.[rutas_versiones] DROP COLUMN [id_estado];
        PRINT 'Columna [rutas_versiones].[id_estado] eliminada.';
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
