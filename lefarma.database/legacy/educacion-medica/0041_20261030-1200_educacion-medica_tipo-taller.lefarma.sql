-- =============================================================================
-- 0041 - Tipo de taller por taller
-- =============================================================================
-- QUÉ HACE
--   - Agrega talleres.id_tipo_visita (FK a tipo_visita).
--   - Agrega el índice IX_talleres_tipo_visita.
--   - Renombra el tipo TALLER a "Promoción producto nuevo" y lo marca como
--     no generador de talleres (es_taller = 0).
--   No se migran datos de talleres existentes: el tipo queda NULL y se captura
--   al editar cada taller.
--
-- POR QUÉ
--   El tipo describe el taller (promoción, informativa, captación de queja, etc.),
--   no la visita planeada. Una visita planeada puede generar cero, uno o varios
--   talleres, incluso con tipos distintos.
--
--   PARA BD NUEVA: NO ejecutar. La columna id_tipo_visita ya esta en el
--   CREATE TABLE de 0016 y los tipos finales se siembran en 0035.
--
-- ORDEN
--   Ejecutar después de 0035 y 0040.
--
-- NOTA
--   No se elimina rutas_visitas.id_tipo_visita: queda como dato histórico.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- Columna en talleres
    IF COL_LENGTH('educacion_medica.talleres', 'id_tipo_visita') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[talleres]
            ADD [id_tipo_visita] int NULL;
        PRINT 'Columna [talleres].[id_tipo_visita] agregada.';
    END
    ELSE
    BEGIN
        PRINT 'Columna [talleres].[id_tipo_visita] ya existe. Skip.';
    END

    -- FK
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_talleres_tipo_visita')
    BEGIN
        ALTER TABLE educacion_medica.[talleres]
            ADD CONSTRAINT [FK_talleres_tipo_visita]
            FOREIGN KEY ([id_tipo_visita])
            REFERENCES educacion_medica.[tipo_visita] ([id_tipo_visita]);
        PRINT 'FK [FK_talleres_tipo_visita] creada.';
    END
    ELSE
    BEGIN
        PRINT 'FK [FK_talleres_tipo_visita] ya existe. Skip.';
    END

    -- Índice
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('educacion_medica.[talleres]')
          AND name = 'IX_talleres_tipo_visita'
    )
    BEGIN
        CREATE INDEX [IX_talleres_tipo_visita]
            ON educacion_medica.[talleres] ([id_tipo_visita]);
        PRINT 'Índice [IX_talleres_tipo_visita] creado.';
    END
    ELSE
    BEGIN
        PRINT 'Índice [IX_talleres_tipo_visita] ya existe. Skip.';
    END

    -- El tipo que antes se llamaba "Taller" ahora es un tipo de taller más.
    UPDATE educacion_medica.[tipo_visita]
       SET [descripcion] = N'Promoción producto nuevo',
           [es_taller] = 0,
           [fecha_modificacion] = SYSUTCDATETIME()
     WHERE [clave] = 'TALLER';

    PRINT CONCAT('Tipos TALLER renombrados: ', @@ROWCOUNT);

    COMMIT TRANSACTION;
    PRINT '0041 completado: tipo de taller por taller.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0041: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
