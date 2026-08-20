-- =============================================================================
-- MIGRACIÓN: Campos registro_entrada / registro_salida para omisiones
-- DESCRIPCIÓN: Agrega a rh.incidencias_checado_config los campos que indican
--              a qué checada aplica una regla de omisión.
--
-- NOTA: Los tipos TARDANZA_*, SALIDA_ANTICIPADA no usan estos campos.
-- =============================================================================

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('rh.incidencias_checado_config')
      AND name = 'registro_entrada'
)
BEGIN
    ALTER TABLE rh.incidencias_checado_config
        ADD registro_entrada BIT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('rh.incidencias_checado_config')
      AND name = 'registro_salida'
)
BEGIN
    ALTER TABLE rh.incidencias_checado_config
        ADD registro_salida BIT NOT NULL DEFAULT 0;
END
GO

-- Ajustar semilla inicial: las omisiones indican su lado correspondiente.
UPDATE rh.incidencias_checado_config
SET registro_entrada = 1,
    registro_salida = 0
WHERE tipo_incidencia = 'OMISION_ENTRADA';
GO

UPDATE rh.incidencias_checado_config
SET registro_entrada = 0,
    registro_salida = 1
WHERE tipo_incidencia = 'OMISION_SALIDA';
GO

-- Regla inicial para salida anticipada (usa solo minutos_min).
IF NOT EXISTS (SELECT 1 FROM rh.incidencias_checado_config WHERE nombre = N'Salida anticipada')
BEGIN
    SET IDENTITY_INSERT rh.incidencias_checado_config ON;

    INSERT INTO rh.incidencias_checado_config
        (id_config, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
         tipo_incidencia, minutos_min, minutos_max, cantidad_acumulada, periodo, prioridad, activo,
         registro_entrada, registro_salida, fecha_creacion)
    VALUES
        (5, N'Salida anticipada', N'Salida anticipada',
         N'Una salida anticipada de 20 minutos o más en el mes genera descuento.',
         N'Una salida anticipada de 20 minutos o más en el mes genera descuento.',
         'SALIDA_ANTICIPADA', 20, NULL, 1, 'mes', 50, 1, 0, 0, GETDATE());

    SET IDENTITY_INSERT rh.incidencias_checado_config OFF;
END
GO
