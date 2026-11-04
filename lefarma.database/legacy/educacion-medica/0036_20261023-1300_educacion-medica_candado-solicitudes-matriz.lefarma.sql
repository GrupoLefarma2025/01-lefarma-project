-- =============================================================================
-- 0036 — Candado por taller y solicitudes de cambio de matriz (ADR-00018)
--
-- QUÉ HACE
--   - taller_solicitudes_cambio: id_matriz_general + tipo_solicitud.
--   - matrices_generales: fecha_ultima_actualizacion + total_actualizado.
--   - Parámetros del candado/cambios:
--       umbral_cambio_costo_reautorizacion, permite_cambio_hospital,
--       permite_cambio_producto.
--   - Descripciones.
--
--   NO aplica el script solo: lo revisa y ejecuta el usuario.
--   Requiere 0035 (parametros_modulo.tipo/valor_texto).
--
--   PARA BD NUEVA: NO ejecutar. Columnas y parametros ya estan integrados
--   en 0016 y 0035; este archivo queda para entornos existentes.
--
-- REQUISITOS
--   - 0016, 0033, 0035 aplicados.
--
-- IDEMPOTENTE.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'educacion_medica')
BEGIN
    RAISERROR('Falta el esquema educacion_medica. Ejecute 0016 primero.', 16, 1);
    RETURN;
END;

IF COL_LENGTH('educacion_medica.parametros_modulo', 'tipo') IS NULL
BEGIN
    RAISERROR('Falta parametros_modulo.tipo. Ejecute 0035 primero.', 16, 1);
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1) Solicitudes de cambio: vínculo a matriz y tipo
    -- =========================================================================
    IF COL_LENGTH('educacion_medica.taller_solicitudes_cambio', 'id_matriz_general') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[taller_solicitudes_cambio] ADD [id_matriz_general] int NULL;
        PRINT 'Columna [taller_solicitudes_cambio].[id_matriz_general] agregada.';
    END
    ELSE
        PRINT 'Columna [taller_solicitudes_cambio].[id_matriz_general] ya existe. Skip.';

    IF COL_LENGTH('educacion_medica.taller_solicitudes_cambio', 'tipo_solicitud') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[taller_solicitudes_cambio] ADD [tipo_solicitud] varchar(30) NOT NULL
            CONSTRAINT [DF_taller_solicitudes_cambio_tipo] DEFAULT ('CAMBIO_TALLER');
        PRINT 'Columna [taller_solicitudes_cambio].[tipo_solicitud] agregada.';
    END
    ELSE
        PRINT 'Columna [taller_solicitudes_cambio].[tipo_solicitud] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND name = 'CK_taller_solicitudes_cambio_tipo')
        EXEC(N'ALTER TABLE educacion_medica.[taller_solicitudes_cambio] ADD CONSTRAINT [CK_taller_solicitudes_cambio_tipo]
            CHECK ([tipo_solicitud] IN (''CAMBIO_TALLER'', ''CANCELAR_TALLER'', ''EXTRAORDINARIO'', ''CAMBIO_COSTO''));');

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_taller_solicitudes_cambio_matriz')
    BEGIN
        EXEC(N'ALTER TABLE educacion_medica.[taller_solicitudes_cambio] ADD CONSTRAINT [FK_taller_solicitudes_cambio_matriz]
            FOREIGN KEY ([id_matriz_general]) REFERENCES educacion_medica.[matrices_generales] ([id_matriz_general]);');
        PRINT 'FK [FK_taller_solicitudes_cambio_matriz] creada.';
    END
    ELSE
        PRINT 'FK [FK_taller_solicitudes_cambio_matriz] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND name = 'IX_taller_solicitudes_cambio_matriz')
        EXEC(N'CREATE INDEX [IX_taller_solicitudes_cambio_matriz] ON educacion_medica.[taller_solicitudes_cambio] ([id_matriz_general]);');
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND name = 'IX_taller_solicitudes_cambio_tipo')
        EXEC(N'CREATE INDEX [IX_taller_solicitudes_cambio_tipo] ON educacion_medica.[taller_solicitudes_cambio] ([tipo_solicitud]);');

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]'), 'id_matriz_general', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Matriz general a la que impacta la solicitud (FK matrices_generales). NULL = solicitud histórica sin vínculo.', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'id_matriz_general';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[taller_solicitudes_cambio]'), 'tipo_solicitud', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Tipo de solicitud: CAMBIO_TALLER | CANCELAR_TALLER | EXTRAORDINARIO | CAMBIO_COSTO', 'SCHEMA', N'educacion_medica', 'TABLE', N'taller_solicitudes_cambio', 'COLUMN', N'tipo_solicitud';

    -- =========================================================================
    -- 2) Matriz general: fecha y total actualizado
    -- =========================================================================
    IF COL_LENGTH('educacion_medica.matrices_generales', 'fecha_ultima_actualizacion') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[matrices_generales] ADD [fecha_ultima_actualizacion] datetime2(7) NULL;
        PRINT 'Columna [matrices_generales].[fecha_ultima_actualizacion] agregada.';
    END
    ELSE
        PRINT 'Columna [matrices_generales].[fecha_ultima_actualizacion] ya existe. Skip.';

    IF COL_LENGTH('educacion_medica.matrices_generales', 'total_actualizado') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[matrices_generales] ADD [total_actualizado] decimal(18,2) NULL;
        PRINT 'Columna [matrices_generales].[total_actualizado] agregada.';
    END
    ELSE
        PRINT 'Columna [matrices_generales].[total_actualizado] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[matrices_generales]'), 'fecha_ultima_actualizacion', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Fecha/hora del último cambio aprobado sobre la matriz (solicitud de taller); no reabre el workflow.', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'fecha_ultima_actualizacion';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[matrices_generales]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[matrices_generales]'), 'total_actualizado', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Snapshot del costo total de la matriz tras el último cambio aprobado. NULL = calcular en lectura.', 'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'total_actualizado';

    -- =========================================================================
    -- 3) Parámetros (0035 ya agregó tipo/valor_texto)
    -- =========================================================================
    EXEC(N'
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''umbral_cambio_costo_reautorizacion'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''umbral_cambio_costo_reautorizacion'', 0, ''numero'', NULL, N''Delta de costo que obliga a reautorizar la matriz; 0 = sin umbral.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''permite_cambio_hospital'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''permite_cambio_hospital'', 1, ''booleano'', NULL, N''1 = la solicitud de taller puede cambiar el hospital dentro del alcance permitido.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''permite_cambio_producto'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''permite_cambio_producto'', 1, ''booleano'', NULL, N''1 = la solicitud de taller puede cambiar producto/cantidad y recalcular costos.'');');
    PRINT 'Parámetros del candado/matriz sembrados/verificados.';

    COMMIT TRANSACTION;
    PRINT '0036 completado: candado por taller y solicitudes de matriz.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0036: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

-- =============================================================================
-- VERIFICACIÓN (ejecutar aparte)
-- =============================================================================
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'educacion_medica' AND TABLE_NAME = 'taller_solicitudes_cambio' ORDER BY ORDINAL_POSITION;
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'educacion_medica' AND TABLE_NAME = 'matrices_generales' ORDER BY ORDINAL_POSITION;
-- SELECT clave, valor, tipo, valor_texto FROM educacion_medica.parametros_modulo WHERE clave IN ('umbral_cambio_costo_reautorizacion','permite_cambio_hospital','permite_cambio_producto');
