-- =============================================================================
-- 0037 — Limpieza de datos operativos de Educación Médica
--
-- UBICACION: lefarma.database/manual/educacion-medica/
--   NO lo lee DbUp. Es una utilidad manual y destructiva.
--
-- QUÉ HACE
--   Borra los datos transaccionales del módulo para empezar con el modelo
--   nuevo (selección → ejecutivo, ruta → especialista) sin backfill.
--
--   Limpia:
--     ajustes_post_cierre, taller_solicitudes_cambio, taller_estados_historial,
--     taller_evidencias, taller_asistencias, taller_materiales, taller_recursos,
--     taller_aprobaciones (si existe), talleres, matrices_individuales,
--     matrices_generales, rutas_visitas, rutas, rutas_versiones,
--     selecciones_mensuales_hospitales, selecciones_regiones,
--     selecciones_mensuales, equipos_pareo, ranking_ejecucion_hospitales,
--     ranking_ejecuciones y la bitácora de workflow de los procesos
--     EDUCACION_MEDICA_SELECCION / RUTAS / MATRIZ.
--
--   NO toca catálogos ni configuración:
--     tipo_gerencia, regiones_cat, regiones_estados, hospital_extension,
--     parametros_modulo, parametros_anestesias, config_ranking,
--     config_ranking_factores, tipo_visita, tema_taller.
--
--   Tampoco toca programas_anuales/programas_anuales_detalles (bloque opcional
--   comentado al final, por si el área quiere limpiar también el programa).
--
--   ⚠️ Es destructivo. Ejecutar solo en desarrollo o con autorización expresa.
--   ⚠️ No aplica el script solo: lo revisa y ejecuta el usuario.
--
-- ORDEN DE INSTALACION LIMPIA (solo Educacion Medica)
--   Requisito: esquema base de la plataforma aplicado (config.workflow_* y
--   estados del workflow). Luego ejecutar en este orden:
--     1) 0016  esquema completo de educacion_medica
--     2) 0030  catalogos base y backfills (incluye IMSS Bienestar)
--     3) 0035  catalogos de calendario y parametros
--     4) 0018  workflows de seleccion, rutas y matriz
--     5) 0037  este script (OPCIONAL/manual: solo si se desea borrar datos operativos)
--   Si el Asokam del entorno esta nuevo, aplicar tambien 0017 (permisos base),
--   0021 (guards) y 0029 (ajustes/extraordinarios).
--
--   En una BD NUEVA no es necesario ejecutar: 0033, 0034, 0036, 0038, 0039,
--   0041, 0042, 0043, 0044, 0045 ni 0046. Su DDL/seed ya esta integrado en
--   0016, 0030, 0035 y 0018; se movieron a legacy/educacion-medica como
--   referencia. 0040 es una reparacion de datos para entornos existentes.
--
-- ORDEN (entornos ya migrados)
--   Ejecutar despues de 0016 y, si existen, 0033-0043. El borrado de datos no
--   depende de las columnas nuevas de 0042/0043, asi que tambien puede
--   ejecutarse antes de esos scripts.
--
-- IDEMPOTENTE: DELETE sobre tablas ya vacías no falla.
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

    -- Bitácora de workflow de Educación Médica. No tiene FK a las entidades,
    -- pero dejaría historial huérfano de selecciones/rutas/matrices eliminadas.
    IF OBJECT_ID('config.workflow_bitacora') IS NOT NULL
    BEGIN
        IF OBJECT_ID('config.workflows') IS NOT NULL
           AND COL_LENGTH('config.workflows', 'codigo_proceso') IS NOT NULL
        BEGIN
            DELETE b
              FROM config.[workflow_bitacora] b
              JOIN config.[workflows] w ON w.id_workflow = b.id_workflow
             WHERE w.codigo_proceso IN (
                 'EDUCACION_MEDICA_SELECCION',
                 'EDUCACION_MEDICA_RUTAS',
                 'EDUCACION_MEDICA_MATRIZ'
             );
            PRINT CONCAT('workflow_bitacora (por workflow): ', @@ROWCOUNT, ' fila(s) eliminada(s).');
        END

        IF COL_LENGTH('config.workflow_bitacora', 'tipo_entidad') IS NOT NULL
        BEGIN
            DELETE FROM config.[workflow_bitacora]
             WHERE tipo_entidad IN (
                 'EDUCACION_MEDICA_SELECCION',
                 'EDUCACION_MEDICA_RUTAS',
                 'EDUCACION_MEDICA_MATRIZ'
             );
            PRINT CONCAT('workflow_bitacora (por tipo_entidad): ', @@ROWCOUNT, ' fila(s) eliminada(s).');
        END
    END

    -- Hijos de talleres
    DELETE FROM educacion_medica.[ajustes_post_cierre];
    PRINT CONCAT('ajustes_post_cierre: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[taller_solicitudes_cambio];
    PRINT CONCAT('taller_solicitudes_cambio: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[taller_estados_historial];
    PRINT CONCAT('taller_estados_historial: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[taller_evidencias];
    PRINT CONCAT('taller_evidencias: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[taller_asistencias];
    PRINT CONCAT('taller_asistencias: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[taller_materiales];
    PRINT CONCAT('taller_materiales: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[taller_recursos];
    PRINT CONCAT('taller_recursos: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    -- Tabla legacy de 0003; en instalaciones nuevas ya no se crea. Si existe,
    -- se limpia explícitamente (aunque su FK a talleres sea ON DELETE CASCADE).
    IF OBJECT_ID('educacion_medica.[taller_aprobaciones]') IS NOT NULL
    BEGIN
        DELETE FROM educacion_medica.[taller_aprobaciones];
        PRINT CONCAT('taller_aprobaciones: ', @@ROWCOUNT, ' fila(s) eliminada(s).');
    END

    DELETE FROM educacion_medica.[talleres];
    PRINT CONCAT('talleres: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    -- Matrices
    DELETE FROM educacion_medica.[matrices_individuales];
    PRINT CONCAT('matrices_individuales: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[matrices_generales];
    PRINT CONCAT('matrices_generales: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    -- Rutas
    DELETE FROM educacion_medica.[rutas_visitas];
    PRINT CONCAT('rutas_visitas: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[rutas];
    PRINT CONCAT('rutas: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[rutas_versiones];
    PRINT CONCAT('rutas_versiones: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    -- Selecciones y rankings
    -- Orden obligatorio: los hospitales seleccionados referencian rankings y
    -- regiones; los rankings referencian la selección; equipos va al final.
    DELETE FROM educacion_medica.[selecciones_mensuales_hospitales];
    PRINT CONCAT('selecciones_mensuales_hospitales: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[ranking_ejecucion_hospitales];
    PRINT CONCAT('ranking_ejecucion_hospitales: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[ranking_ejecuciones];
    PRINT CONCAT('ranking_ejecuciones: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[selecciones_regiones];
    PRINT CONCAT('selecciones_regiones: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    DELETE FROM educacion_medica.[selecciones_mensuales];
    PRINT CONCAT('selecciones_mensuales: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    -- Equipos (legacy): después de rutas, matrices, regiones y selecciones
    DELETE FROM educacion_medica.[equipos_pareo];
    PRINT CONCAT('equipos_pareo: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    -- -------------------------------------------------------------------------
    -- OPCIONAL: programa anual (descomentar si el área quiere limpiarlo también)
    -- -------------------------------------------------------------------------
    -- DELETE FROM educacion_medica.[programas_anuales_detalles];
    -- PRINT CONCAT('programas_anuales_detalles: ', @@ROWCOUNT, ' fila(s) eliminada(s).');
    -- DELETE FROM educacion_medica.[programas_anuales];
    -- PRINT CONCAT('programas_anuales: ', @@ROWCOUNT, ' fila(s) eliminada(s).');

    -- -------------------------------------------------------------------------
    -- NO se limpian: hospital_extension, regiones_cat, regiones_estados,
    -- tipo_gerencia, parametros_modulo, tipo_visita, tema_taller,
    -- config_ranking, parametros_anestesias.
    -- La clasificación de gerencias se hace en la pantalla Hospitales.
    -- La configuración de workflows (workflows/pasos/acciones) se conserva;
    -- solo se limpia la bitácora de los procesos EDUCACION_MEDICA_*.
    -- -------------------------------------------------------------------------

    COMMIT TRANSACTION;
    PRINT '0037 completado: datos operativos de Educación Médica limpios.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0037: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

-- =============================================================================
-- VERIFICACIÓN (ejecutar aparte)
-- =============================================================================
-- SELECT 'selecciones' AS tabla, COUNT(*) AS filas FROM educacion_medica.selecciones_mensuales
-- UNION ALL SELECT 'rutas', COUNT(*) FROM educacion_medica.rutas
-- UNION ALL SELECT 'rutas_visitas', COUNT(*) FROM educacion_medica.rutas_visitas
-- UNION ALL SELECT 'talleres', COUNT(*) FROM educacion_medica.talleres
-- UNION ALL SELECT 'matrices_generales', COUNT(*) FROM educacion_medica.matrices_generales
-- UNION ALL SELECT 'equipos_pareo', COUNT(*) FROM educacion_medica.equipos_pareo
-- UNION ALL SELECT 'workflow_bitacora_em', COUNT(*) FROM config.workflow_bitacora
--     WHERE id_workflow IN (SELECT id_workflow FROM config.workflows
--         WHERE codigo_proceso IN ('EDUCACION_MEDICA_SELECCION','EDUCACION_MEDICA_RUTAS','EDUCACION_MEDICA_MATRIZ'));
