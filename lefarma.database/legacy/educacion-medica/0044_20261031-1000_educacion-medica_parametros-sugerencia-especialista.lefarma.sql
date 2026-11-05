-- =============================================================================
-- 0044 - Parametros configurables de la sugerencia de especialistas
-- =============================================================================
-- QUE HACE
--   Siembra los pesos y parametros del score de sugerencia de especialistas en
--   educacion_medica.parametros_modulo. Los valores iniciales reproducen el
--   comportamiento actual; se pueden ajustar desde la pantalla de configuracion.
--
--   No crea tablas ni modifica config_ranking.
--   No ejecuta el script solo: lo revisa y ejecuta el usuario.
--
--   PARA BD NUEVA: no es necesario ejecutar. Estos parametros ya estan
--   integrados en 0035; el archivo queda para entornos existentes.
--
-- REQUISITOS
--   - 0016 y 0035 aplicados (parametros_modulo con tipo/valor_texto).
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
        (N'sugerencia_peso_misma_ciudad_dia', 100, N'numero', NULL,
         N'Puntos cuando el especialista ya tiene visita en la misma ciudad el mismo dia.'),
        (N'sugerencia_peso_misma_ciudad_cerca', 50, N'numero', NULL,
         N'Puntos cuando el especialista tiene visita en la misma ciudad dentro de la ventana de cercania.'),
        (N'sugerencia_peso_misma_institucion', 25, N'numero', NULL,
         N'Puntos cuando el especialista tiene visita en la misma institucion dentro de la ventana de cercania.'),
        (N'sugerencia_penalizacion_dia_consecutivo', 20, N'numero', NULL,
         N'Puntos que se restan cuando el especialista tiene visita el dia anterior o siguiente.'),
        (N'sugerencia_factor_carga_semana', 1, N'numero', NULL,
         N'Puntos que se restan por cada visita del especialista en la semana.'),
        (N'sugerencia_factor_carga_mes', 1, N'numero', NULL,
         N'Puntos que se restan por cada visita del especialista en el mes.'),
        (N'sugerencia_ventana_dias_cercania', 1, N'numero', NULL,
         N'Dias hacia atras y adelante para considerar misma ciudad o institucion cercana.')
    ) AS v(clave, valor, tipo, valor_texto, descripcion)
    WHERE NOT EXISTS (
        SELECT 1
        FROM educacion_medica.parametros_modulo p
        WHERE p.clave = v.clave
    );

    PRINT CONCAT('Parametros de sugerencia insertados: ', @@ROWCOUNT);

    COMMIT TRANSACTION;
    PRINT '0044 completado: parametros de sugerencia de especialistas listos.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0044: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

-- =============================================================================
-- VERIFICACION (ejecutar aparte)
-- =============================================================================
-- SELECT clave, valor, tipo, descripcion
-- FROM educacion_medica.parametros_modulo
-- WHERE clave LIKE 'sugerencia_%'
-- ORDER BY clave;
