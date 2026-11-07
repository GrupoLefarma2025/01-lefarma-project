-- =============================================================================
-- 0041 — Hospitales: campos de depuración en hospital_extension
--
-- QUÉ HACE
--   - Agrega a educacion_medica.hospital_extension:
--       mostrar_educacion_medica  BIT           (1 = aparece en el catálogo EM)
--       motivo_clasificacion      NVARCHAR(200) (razón de inclusión/exclusión)
--       requiere_revision         BIT           (1 = pendiente de revisión manual)
--       clasificacion_manual      BIT           (1 = protección contra reejecución)
--   - Crea una tabla de respaldo de la tabla actual.
--   - Agrega un índice para consultas por inclusión/sede/gerencia.
--
-- ALCANCE
--   - Solo modifica educacion_medica.hospital_extension.
--   - No toca Asokam.dbo.genContactosCat.
--   - No elimina registros.
--
-- EJECUCIÓN
--   - Revisar antes de ejecutar.
--   - Ejecutar en LefarmaDev2, en orden: 0041 -> 0042 -> 0043.
--   - Idempotente: guards por columna, índice y tabla de respaldo.
-- =============================================================================

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- -------------------------------------------------------------------------
    -- 0. Respaldo previo (solo si no existe)
    -- -------------------------------------------------------------------------
    IF OBJECT_ID('educacion_medica.hospital_extension_backup_20261107', 'U') IS NULL
    BEGIN
        SELECT *
        INTO educacion_medica.hospital_extension_backup_20261107
        FROM educacion_medica.hospital_extension;

        PRINT 'Respaldo creado: educacion_medica.hospital_extension_backup_20261107';
    END
    ELSE
    BEGIN
        PRINT 'Respaldo ya existe. Skip.';
    END

    -- -------------------------------------------------------------------------
    -- 1. mostrar_educacion_medica
    -- -------------------------------------------------------------------------
    IF COL_LENGTH('educacion_medica.hospital_extension', 'mostrar_educacion_medica') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.hospital_extension
        ADD mostrar_educacion_medica BIT NOT NULL
            CONSTRAINT DF_hospital_extension_mostrar_educacion_medica DEFAULT (0);

        PRINT 'Columna [hospital_extension].[mostrar_educacion_medica] agregada.';
    END
    ELSE
    BEGIN
        PRINT 'Columna [hospital_extension].[mostrar_educacion_medica] ya existe. Skip.';
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
          AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'mostrar_educacion_medica', 'ColumnId')
          AND name = 'MS_Description'
    )
    BEGIN
        EXEC sp_addextendedproperty
            @name = N'MS_Description',
            @value = N'1 = el contacto aparece en el catálogo de Educación Médica. 0 = contacto interno, proveedor, almacén no operativo, duplicado o registro de prueba. La fuente sigue siendo Asokam.dbo.genContactosCat; este campo es la clasificación operativa local.',
            @level0type = N'SCHEMA', @level0name = N'educacion_medica',
            @level1type = N'TABLE',  @level1name = N'hospital_extension',
            @level2type = N'COLUMN', @level2name = N'mostrar_educacion_medica';
    END

    -- -------------------------------------------------------------------------
    -- 2. motivo_clasificacion
    -- -------------------------------------------------------------------------
    IF COL_LENGTH('educacion_medica.hospital_extension', 'motivo_clasificacion') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.hospital_extension
        ADD motivo_clasificacion NVARCHAR(200) NULL;

        PRINT 'Columna [hospital_extension].[motivo_clasificacion] agregada.';
    END
    ELSE
    BEGIN
        PRINT 'Columna [hospital_extension].[motivo_clasificacion] ya existe. Skip.';
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
          AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'motivo_clasificacion', 'ColumnId')
          AND name = 'MS_Description'
    )
    BEGIN
        EXEC sp_addextendedproperty
            @name = N'MS_Description',
            @value = N'Motivo legible de la clasificación: unidad de atención, sede logística, duplicado, proveedor, almacén, registro de prueba o revisión manual.',
            @level0type = N'SCHEMA', @level0name = N'educacion_medica',
            @level1type = N'TABLE',  @level1name = N'hospital_extension',
            @level2type = N'COLUMN', @level2name = N'motivo_clasificacion';
    END

    -- -------------------------------------------------------------------------
    -- 3. requiere_revision
    -- -------------------------------------------------------------------------
    IF COL_LENGTH('educacion_medica.hospital_extension', 'requiere_revision') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.hospital_extension
        ADD requiere_revision BIT NOT NULL
            CONSTRAINT DF_hospital_extension_requiere_revision DEFAULT (0);

        PRINT 'Columna [hospital_extension].[requiere_revision] agregada.';
    END
    ELSE
    BEGIN
        PRINT 'Columna [hospital_extension].[requiere_revision] ya existe. Skip.';
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
          AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'requiere_revision', 'ColumnId')
          AND name = 'MS_Description'
    )
    BEGIN
        EXEC sp_addextendedproperty
            @name = N'MS_Description',
            @value = N'1 = el registro requiere revisión manual (duplicado dudoso, mapeo de región en CDMX, jerarquía incompleta o nombre sospechoso).',
            @level0type = N'SCHEMA', @level0name = N'educacion_medica',
            @level1type = N'TABLE',  @level1name = N'hospital_extension',
            @level2type = N'COLUMN', @level2name = N'requiere_revision';
    END

    -- -------------------------------------------------------------------------
    -- 4. clasificacion_manual
    -- -------------------------------------------------------------------------
    IF COL_LENGTH('educacion_medica.hospital_extension', 'clasificacion_manual') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.hospital_extension
        ADD clasificacion_manual BIT NOT NULL
            CONSTRAINT DF_hospital_extension_clasificacion_manual DEFAULT (0);

        PRINT 'Columna [hospital_extension].[clasificacion_manual] agregada.';
    END
    ELSE
    BEGIN
        PRINT 'Columna [hospital_extension].[clasificacion_manual] ya existe. Skip.';
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.extended_properties
        WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
          AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'clasificacion_manual', 'ColumnId')
          AND name = 'MS_Description'
    )
    BEGIN
        EXEC sp_addextendedproperty
            @name = N'MS_Description',
            @value = N'1 = la clasificación fue ajustada manualmente; los scripts de depuración no deben sobrescribirla.',
            @level0type = N'SCHEMA', @level0name = N'educacion_medica',
            @level1type = N'TABLE',  @level1name = N'hospital_extension',
            @level2type = N'COLUMN', @level2name = N'clasificacion_manual';
    END

    -- -------------------------------------------------------------------------
    -- 5. Índice de consulta
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('educacion_medica.hospital_extension')
          AND name = 'IX_hospital_extension_mostrar_sede_gerencia'
    )
    BEGIN
        CREATE INDEX IX_hospital_extension_mostrar_sede_gerencia
        ON educacion_medica.hospital_extension (mostrar_educacion_medica, es_sede_taller, id_tipo_gerencia);

        PRINT 'Índice [IX_hospital_extension_mostrar_sede_gerencia] creado.';
    END
    ELSE
    BEGIN
        PRINT 'Índice [IX_hospital_extension_mostrar_sede_gerencia] ya existe. Skip.';
    END

    COMMIT TRANSACTION;
    PRINT '0041 completado: campos de depuración agregados a hospital_extension.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    PRINT 'ERROR en 0041: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
