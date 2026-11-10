/* =============================================================================
   RECONCILIACIÓN — tablas de Educación Médica que ya existían en producción
   -----------------------------------------------------------------------------
   En producción existen desde el esquema viejo:
     educacion_medica.hospital_extension
     educacion_medica.parametros_anestesias
     educacion_medica.programas_anuales
     educacion_medica.tipo_gerencia
   0016 no las recrea (guards), así que aquí se agregan las columnas/constraints
   que el modelo final necesita y que faltan en esas tablas.
   Idempotente.
   ============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* --- hospital_extension: columnas del modelo final ------------------------- */
IF COL_LENGTH('educacion_medica.hospital_extension', 'es_zona_metropolitana') IS NULL
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ADD es_zona_metropolitana bit NULL;
    PRINT 'hospital_extension: + es_zona_metropolitana';
END
GO

IF COL_LENGTH('educacion_medica.hospital_extension', 'id_region') IS NULL
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ADD id_region int NULL;
    PRINT 'hospital_extension: + id_region';
END
GO

IF COL_LENGTH('educacion_medica.hospital_extension', 'es_almacen') IS NULL
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ADD es_almacen bit NULL;
    PRINT 'hospital_extension: + es_almacen';
END
GO

IF COL_LENGTH('educacion_medica.hospital_extension', 'es_farmacia') IS NULL
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ADD es_farmacia bit NULL;
    PRINT 'hospital_extension: + es_farmacia';
END
GO

IF COL_LENGTH('educacion_medica.hospital_extension', 'es_sede_taller') IS NULL
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ADD es_sede_taller bit NULL;
    PRINT 'hospital_extension: + es_sede_taller';
END
GO

/* fecha pasa a NULL (0016 la define NULL; producción la tenía NOT NULL) */
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND name = 'fecha' AND is_nullable = 0
)
BEGIN
    ALTER TABLE educacion_medica.hospital_extension ALTER COLUMN fecha date NULL;
    PRINT 'hospital_extension: fecha -> NULL';
END
GO

/* FK de región (regiones_cat la crea 0016 antes de este bloque) */
IF OBJECT_ID('educacion_medica.regiones_cat', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys
       WHERE name = 'FK_hospital_extension_region'
         AND parent_object_id = OBJECT_ID('educacion_medica.hospital_extension')
   )
BEGIN
    ALTER TABLE educacion_medica.hospital_extension WITH CHECK
        ADD CONSTRAINT FK_hospital_extension_region
        FOREIGN KEY (id_region) REFERENCES educacion_medica.regiones_cat (id_region)
        ON DELETE SET NULL;
    PRINT 'hospital_extension: + FK_hospital_extension_region';
END
GO

/* --- programas_anuales: CHECK del periodo (tabla vacía en producción) ------ */
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_programas_anuales_periodo'
      AND parent_object_id = OBJECT_ID('educacion_medica.programas_anuales')
)
BEGIN
    ALTER TABLE educacion_medica.programas_anuales WITH CHECK
        ADD CONSTRAINT CK_programas_anuales_periodo CHECK (
            periodo_inicio >= 1 AND periodo_inicio <= 12
            AND periodo_fin >= 1 AND periodo_fin <= 12
        );
    PRINT 'programas_anuales: + CK_programas_anuales_periodo';
END
GO

PRINT '=== RECONCILIACION completada ===';
GO
