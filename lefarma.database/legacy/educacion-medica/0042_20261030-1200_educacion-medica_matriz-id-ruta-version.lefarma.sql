-- =============================================================================
-- 0042 - Enlazar la Matriz General con su version de rutas
-- =============================================================================
-- QUE HACE
--   - Agrega matrices_generales.id_ruta_version (FK a rutas_versiones).
--   - Crea el indice IX_matrices_generales_ruta_version.
--   - Rellena las matrices historicas usando sus talleres -> visitas -> rutas.
--   - Documenta la columna.
--
-- POR QUE
--   La matriz es el documento autorizable y debe apuntar a la version exacta
--   de rutas de la misma gerencia y del mismo mes. La matriz, la ruta y la
--   seleccion siempre operan por mes completo.
--
-- ORDEN
--   Ejecutar despues de 0016, 0018, 0040 y 0041.
--
-- NOTA
--   No aplica columnas de workflow. No elimina datos. Es idempotente.
--   NO EJECUTAR sin autorizacion del usuario.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('educacion_medica.matrices_generales') IS NULL
   OR OBJECT_ID('educacion_medica.rutas_versiones') IS NULL
   OR OBJECT_ID('educacion_medica.talleres') IS NULL
   OR OBJECT_ID('educacion_medica.rutas_visitas') IS NULL
   OR OBJECT_ID('educacion_medica.rutas') IS NULL
BEGIN
    RAISERROR('Faltan tablas de educacion_medica. Ejecute 0016 primero.', 16, 1);
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('educacion_medica.matrices_generales', 'id_ruta_version') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[matrices_generales]
            ADD [id_ruta_version] int NULL;
        PRINT 'Columna [matrices_generales].[id_ruta_version] agregada.';
    END
    ELSE
    BEGIN
        PRINT 'Columna [matrices_generales].[id_ruta_version] ya existe. Skip.';
    END

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = 'FK_matrices_generales_ruta_version'
          AND parent_object_id = OBJECT_ID('educacion_medica.[matrices_generales]')
    )
    BEGIN
        ALTER TABLE educacion_medica.[matrices_generales]
            ADD CONSTRAINT [FK_matrices_generales_ruta_version]
            FOREIGN KEY ([id_ruta_version])
            REFERENCES educacion_medica.[rutas_versiones] ([id_ruta_version]);
        PRINT 'FK [FK_matrices_generales_ruta_version] creada.';
    END
    ELSE
    BEGIN
        PRINT 'FK [FK_matrices_generales_ruta_version] ya existe. Skip.';
    END

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('educacion_medica.[matrices_generales]')
          AND name = 'IX_matrices_generales_ruta_version'
    )
    BEGIN
        CREATE INDEX [IX_matrices_generales_ruta_version]
            ON educacion_medica.[matrices_generales] ([id_ruta_version]);
        PRINT 'Indice [IX_matrices_generales_ruta_version] creado.';
    END
    ELSE
    BEGIN
        PRINT 'Indice [IX_matrices_generales_ruta_version] ya existe. Skip.';
    END

    -- Backfill: ultima version activa de rutas vinculada por los talleres de la matriz.
    -- Se valida gerencia y mes completo usando la seleccion mensual.
    UPDATE m
       SET m.[id_ruta_version] = x.[id_ruta_version]
      FROM educacion_medica.[matrices_generales] m
     CROSS APPLY (
        SELECT TOP 1 rv.[id_ruta_version]
          FROM educacion_medica.[talleres] t
          JOIN educacion_medica.[rutas_visitas] v
            ON v.[id_ruta_visita] = t.[id_ruta_visita]
          JOIN educacion_medica.[rutas] r
            ON r.[id_ruta] = v.[id_ruta]
          JOIN educacion_medica.[rutas_versiones] rv
            ON rv.[id_ruta_version] = r.[id_ruta_version]
          JOIN educacion_medica.[selecciones_mensuales] s
            ON s.[id_seleccion_mensual] = rv.[id_seleccion_mensual]
         WHERE t.[id_matriz_general] = m.[id_matriz_general]
           AND t.[activo] = 1
           AND s.[id_tipo_gerencia] = m.[id_tipo_gerencia]
           AND DATEFROMPARTS(YEAR(s.[fecha_seleccion]), MONTH(s.[fecha_seleccion]), 1) = m.[periodo]
           AND rv.[estado] NOT IN ('Archivada', 'Cancelada', 'Rechazada')
         ORDER BY rv.[version] DESC
     ) x
     WHERE m.[id_ruta_version] IS NULL;

    PRINT CONCAT('Matrices enlazadas a una version de rutas: ', @@ROWCOUNT);

    IF NOT EXISTS (
        SELECT 1 FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]')
          AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[matrices_generales]'), 'id_ruta_version', 'ColumnId')
          AND name = 'MS_Description'
    )
        EXEC sp_addextendedproperty
            N'MS_Description',
            N'Version de rutas de la misma gerencia y mes que esta matriz (FK fisica a rutas_versiones). Permite vincular planeacion y matriz sin depender de busquedas por periodo.',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'id_ruta_version';

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
