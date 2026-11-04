-- =============================================================================
-- 0045 - Parametros de historial para la sugerencia de especialistas
-- =============================================================================
-- QUE HACE
--   Siembra los pesos del historial de talleres realizados en la sugerencia de
--   especialistas. El historial se calcula con talleres en estado Realizado y
--   anteriores a la fecha de la visita:
--     - mismo hospital
--     - misma institucion (hospital padre en Asokam)
--     - misma ciudad
--     - misma region
--
--   El bono total del historial se limita con sugerencia_tope_historial.
--   No crea tablas ni modifica config_ranking.
--   No ejecuta el script solo: lo revisa y ejecuta el usuario.
--
--   PARA BD NUEVA: no es necesario ejecutar. Estos parametros ya estan
--   integrados en 0035; el archivo queda para entornos existentes.
--
-- REQUISITOS
--   - 0016, 0035 y 0044 aplicados.
--
-- IDEMPOTENTE: solo inserta las claves que no existan.
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

IF OBJECT_ID('educacion_medica.parametros_modulo') IS NULL
BEGIN
    RAISERROR('Falta educacion_medica.parametros_modulo. Ejecute 0016 primero.', 16, 1);
    RETURN;
END;

IF COL_LENGTH('educacion_medica.parametros_modulo', 'tipo') IS NULL
BEGIN
    RAISERROR('Falta parametros_modulo.tipo. Ejecute 0035 primero.', 16, 1);
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    INSERT INTO educacion_medica.parametros_modulo
        (clave, valor, tipo, valor_texto, descripcion)
    SELECT v.clave, v.valor, v.tipo, v.valor_texto, v.descripcion
    FROM (VALUES
        (N'sugerencia_peso_historial_hospital', 5, N'numero', NULL,
         N'Puntos por cada visita realizada al mismo hospital; se cuentan hasta 3 visitas.'),
        (N'sugerencia_peso_historial_institucion', 5, N'numero', NULL,
         N'Puntos una vez cuando el especialista ya visito otro hospital de la misma institucion.'),
        (N'sugerencia_peso_historial_ciudad', 3, N'numero', NULL,
         N'Puntos por cada visita realizada en la misma ciudad; se cuentan hasta 3 visitas.'),
        (N'sugerencia_peso_historial_region', 2, N'numero', NULL,
         N'Puntos por cada visita realizada en la misma region; se cuentan hasta 3 visitas.'),
        (N'sugerencia_tope_historial', 25, N'numero', NULL,
         N'Maximo de puntos que puede aportar el historial completo a una sugerencia.')
    ) AS v(clave, valor, tipo, valor_texto, descripcion)
    WHERE NOT EXISTS (
        SELECT 1
        FROM educacion_medica.parametros_modulo p
        WHERE p.clave = v.clave
    );

    PRINT CONCAT('Parametros de historial insertados: ', @@ROWCOUNT);

    COMMIT TRANSACTION;
    PRINT '0045 completado: parametros de historial de sugerencias listos.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0045: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

-- =============================================================================
-- VERIFICACION (ejecutar aparte)
-- =============================================================================
-- SELECT clave, valor, tipo, descripcion
-- FROM educacion_medica.parametros_modulo
-- WHERE clave LIKE 'sugerencia_%'
-- ORDER BY clave;
