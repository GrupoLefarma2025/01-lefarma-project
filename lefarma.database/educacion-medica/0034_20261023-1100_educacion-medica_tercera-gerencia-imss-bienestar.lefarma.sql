-- =============================================================================
-- 0034 — Tercera gerencia: IMSS Bienestar (ADR-00017)
--
-- QUÉ HACE
--   - Agrega "IMSS Bienestar" al catálogo tipo_gerencia.
--   - Crea su juego de regiones/estados copiando el de Descentralizado.
--   - NO reclasifica hospitales existentes: los datos operativos se limpian
--     antes de operar y la clasificación se hace desde la pantalla de revisión
--     (Hospitales). Ver 0037_..._limpieza-datos-operativos.
--   - Actualiza MS_Description de tipo_gerencia/regiones_cat.
--
--   El parámetro alcance_hospital_extraordinario se siembra en 0035 (requiere
--   tipo/valor_texto). Los workflows de la tercera gerencia se configuran en el
--   admin; este script solo deja el catálogo y los datos.
--
--   NO aplica el script solo: lo revisa y ejecuta el usuario.
--
-- REQUISITOS
--   - 0016 aplicado (y 0030 para los catálogos base).
--
-- IDEMPOTENTE: inserts con NOT EXISTS.
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

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @id_imss int;
    DECLARE @id_descentralizado int;
    DECLARE @id_bienestar int;

    SELECT @id_imss = id_tipo_gerencia FROM educacion_medica.tipo_gerencia WHERE descripcion = 'IMSS';
    SELECT @id_descentralizado = id_tipo_gerencia FROM educacion_medica.tipo_gerencia WHERE descripcion = 'Descentralizado';

    IF @id_imss IS NULL OR @id_descentralizado IS NULL
    BEGIN
        RAISERROR('Faltan los tipos de gerencia base IMSS/Descentralizado. Ejecute 0030 primero.', 16, 1);
    END;

    -- -------------------------------------------------------------------------
    -- 1) Catálogo tipo_gerencia
    -- -------------------------------------------------------------------------
    SELECT @id_bienestar = id_tipo_gerencia
    FROM educacion_medica.tipo_gerencia
    WHERE descripcion = 'IMSS Bienestar';

    IF @id_bienestar IS NULL
    BEGIN
        INSERT INTO educacion_medica.tipo_gerencia (descripcion, activo, fecha_creacion, fecha_modificacion)
        VALUES ('IMSS Bienestar', 1, sysutcdatetime(), sysutcdatetime());

        SET @id_bienestar = SCOPE_IDENTITY();
        PRINT CONCAT('Tipo de gerencia [IMSS Bienestar] creado con id ', @id_bienestar, '.');
    END
    ELSE
        PRINT CONCAT('Tipo de gerencia [IMSS Bienestar] ya existe con id ', @id_bienestar, '. Skip.');

    -- -------------------------------------------------------------------------
    -- 2) Regiones de catálogo (copia inicial de Descentralizado)
    -- -------------------------------------------------------------------------
    INSERT INTO educacion_medica.regiones_cat
        (nombre, centro_latitud, centro_longitud, activo, id_tipo_gerencia, fecha_creacion, fecha_modificacion)
    SELECT
        rc.nombre,
        rc.centro_latitud,
        rc.centro_longitud,
        1,
        @id_bienestar,
        sysutcdatetime(),
        sysutcdatetime()
    FROM educacion_medica.regiones_cat rc
    WHERE rc.id_tipo_gerencia = @id_descentralizado
      AND NOT EXISTS (
          SELECT 1
          FROM educacion_medica.regiones_cat destino
          WHERE destino.id_tipo_gerencia = @id_bienestar
            AND destino.nombre = rc.nombre
      );
    PRINT CONCAT('Regiones copiadas a IMSS Bienestar: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 3) Mapeo estado -> región (copia inicial de Descentralizado)
    -- -------------------------------------------------------------------------
    INSERT INTO educacion_medica.regiones_estados
        (codigo_estado, id_region, id_tipo_gerencia, fecha_creacion, fecha_modificacion)
    SELECT
        re.codigo_estado,
        destino.id_region,
        @id_bienestar,
        sysutcdatetime(),
        sysutcdatetime()
    FROM educacion_medica.regiones_estados re
    JOIN educacion_medica.regiones_cat origen
        ON origen.id_region = re.id_region
       AND origen.id_tipo_gerencia = @id_descentralizado
    JOIN educacion_medica.regiones_cat destino
        ON destino.id_tipo_gerencia = @id_bienestar
       AND destino.nombre = origen.nombre
    WHERE NOT EXISTS (
        SELECT 1
        FROM educacion_medica.regiones_estados x
        WHERE x.id_tipo_gerencia = @id_bienestar
          AND x.codigo_estado = re.codigo_estado
    );
    PRINT CONCAT('Mapeos estado->región copiados a IMSS Bienestar: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 4) Backfill omitido a propósito (2026-10-23)
    --    No se reclasifican hospitales existentes: los datos operativos se
    --    limpian y la clasificación se hace desde la pantalla de revisión.
    --    Ver 0037_..._limpieza-datos-operativos.
    -- -------------------------------------------------------------------------

    -- -------------------------------------------------------------------------
    -- 5) Descripciones
    -- -------------------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_gerencia]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Catálogo de tipos de gerencia de ventas (no existe en Asokam): IMSS, IMSS Bienestar, Descentralizado y Privado.', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_gerencia';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_gerencia]') AND minor_id = 2 AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Descripción del tipo de gerencia (IMSS | IMSS Bienestar | Descentralizado | Privado)', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_gerencia', 'COLUMN', N'descripcion';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[regiones_cat]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[regiones_cat]'), 'id_tipo_gerencia', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'Gerencia dueña del catálogo de regiones (FK tipo_gerencia): IMSS, IMSS Bienestar y Descentralizado tienen sus propias regiones; sus ejecutivos de ventas son distintos.', 'SCHEMA', N'educacion_medica', 'TABLE', N'regiones_cat', 'COLUMN', N'id_tipo_gerencia';

    COMMIT TRANSACTION;
    PRINT '0034 completado: tercera gerencia IMSS Bienestar.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0034: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

-- =============================================================================
-- VERIFICACIÓN (ejecutar aparte)
-- =============================================================================
-- SELECT id_tipo_gerencia, descripcion, activo FROM educacion_medica.tipo_gerencia ORDER BY id_tipo_gerencia;
-- SELECT tg.descripcion AS gerencia, COUNT(*) AS regiones FROM educacion_medica.regiones_cat rc JOIN educacion_medica.tipo_gerencia tg ON tg.id_tipo_gerencia = rc.id_tipo_gerencia GROUP BY tg.descripcion;
-- SELECT tg.descripcion AS gerencia, COUNT(*) AS hospitales FROM educacion_medica.hospital_extension he JOIN educacion_medica.tipo_gerencia tg ON tg.id_tipo_gerencia = he.id_tipo_gerencia GROUP BY tg.descripcion;
-- NOTA: 0034 no reclasifica hospitales. La asignación de gerencia se hace en la
-- pantalla Hospitales o con el script de limpieza/reclasificación que defina el área.
