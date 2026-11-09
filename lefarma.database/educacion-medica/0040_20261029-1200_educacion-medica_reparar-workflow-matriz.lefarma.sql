-- =============================================================================
-- 0040 — Reparar mappings y matrices huérfanas del workflow de matriz
--
-- QUÉ HACE
--   1) Crea los mappings EDUCACION_MEDICA_MATRIZ + TIPO_GERENCIA para
--      IMSS (gerencia 1) y Descentralizado (gerencia 2), si no existe un
--      mapping activo que apunte a un workflow activo.
--   2) Re-vincula las matrices generales cuyo workflow o paso ya no existe,
--      o cuyo paso no pertenece al workflow, al paso inicial del workflow
--      vigente de su gerencia.
--   3) Alinea id_estado con el paso cuando el estado es inválido.
--
--   NO APLICA EL SCRIPT SOLO: lo revisa y ejecuta el usuario.
--   Requiere 0016 y 0018 aplicados.
--
-- IDEMPOTENTE.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF OBJECT_ID('config.workflow_mappings') IS NULL
   OR OBJECT_ID('config.workflow_pasos') IS NULL
   OR OBJECT_ID('config.workflow_scope_types') IS NULL
   OR OBJECT_ID('config.workflows') IS NULL
   OR OBJECT_ID('educacion_medica.matrices_generales') IS NULL
BEGIN
    RAISERROR('Faltan tablas de workflow o educacion_medica.matrices_generales. Ejecute 0016/0018 primero.', 16, 1);
    RETURN;
END;

DECLARE @scopeTipoGerencia int = 0;

SET @scopeTipoGerencia =
    (SELECT TOP 1 id_scope_type
     FROM config.workflow_scope_types
     WHERE codigo = 'TIPO_GERENCIA' AND activo = 1
     ORDER BY id_scope_type);

IF @scopeTipoGerencia IS NULL
BEGIN
    RAISERROR('No existe el scope type TIPO_GERENCIA. Ejecute 0018 primero.', 16, 1);
    RETURN;
END;

DECLARE @wfImss int =
    (SELECT TOP 1 id_workflow
     FROM config.workflows
     WHERE codigo_proceso = 'EDUCACION_MEDICA_MATRIZ'
       AND nombre = 'Matriz de talleres - IMSS'
       AND activo = 1
     ORDER BY id_workflow DESC);

DECLARE @wfDesc int =
    (SELECT TOP 1 id_workflow
     FROM config.workflows
     WHERE codigo_proceso = 'EDUCACION_MEDICA_MATRIZ'
       AND nombre = 'Matriz de talleres - Descentralizado'
       AND activo = 1
     ORDER BY id_workflow DESC);

IF @wfImss IS NULL AND @wfDesc IS NULL
BEGIN
    RAISERROR('No existen workflows activos de matriz (IMSS/Descentralizado). Ejecute 0018 primero.', 16, 1);
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1) Mappings por gerencia
    -- =========================================================================
    IF @wfImss IS NOT NULL
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM config.workflow_mappings m
            JOIN config.workflows w ON w.id_workflow = m.id_workflow AND w.activo = 1
            WHERE m.codigo_proceso = 'EDUCACION_MEDICA_MATRIZ'
              AND m.id_scope_type = @scopeTipoGerencia
              AND m.scope_id = 1
              AND m.activo = 1
        )
        BEGIN
            INSERT INTO config.workflow_mappings
                (codigo_proceso, id_scope_type, scope_id, id_workflow,
                 prioridad_manual, activo, observaciones, fecha_creacion)
            VALUES
                ('EDUCACION_MEDICA_MATRIZ', @scopeTipoGerencia, 1, @wfImss,
                 100, 1, 'Mapping base IMSS (script 0040)', GETDATE());
            PRINT 'Mapping EDUCACION_MEDICA_MATRIZ + gerencia 1 (IMSS) creado.';
        END
        ELSE
            PRINT 'Mapping EDUCACION_MEDICA_MATRIZ + gerencia 1 (IMSS) ya existe. Skip.';
    END
    ELSE
        PRINT 'ADVERTENCIA: no existe workflow activo "Matriz de talleres - IMSS"; no se creó su mapping.';

    IF @wfDesc IS NOT NULL
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM config.workflow_mappings m
            JOIN config.workflows w ON w.id_workflow = m.id_workflow AND w.activo = 1
            WHERE m.codigo_proceso = 'EDUCACION_MEDICA_MATRIZ'
              AND m.id_scope_type = @scopeTipoGerencia
              AND m.scope_id = 2
              AND m.activo = 1
        )
        BEGIN
            INSERT INTO config.workflow_mappings
                (codigo_proceso, id_scope_type, scope_id, id_workflow,
                 prioridad_manual, activo, observaciones, fecha_creacion)
            VALUES
                ('EDUCACION_MEDICA_MATRIZ', @scopeTipoGerencia, 2, @wfDesc,
                 100, 1, 'Mapping base Descentralizado (script 0040)', GETDATE());
            PRINT 'Mapping EDUCACION_MEDICA_MATRIZ + gerencia 2 (Descentralizado) creado.';
        END
        ELSE
            PRINT 'Mapping EDUCACION_MEDICA_MATRIZ + gerencia 2 (Descentralizado) ya existe. Skip.';
    END
    ELSE
        PRINT 'ADVERTENCIA: no existe workflow activo "Matriz de talleres - Descentralizado"; no se creó su mapping.';

    -- =========================================================================
    -- 2) Re-vincular matrices huérfanas al paso inicial
    -- =========================================================================
    DECLARE @map TABLE (
        id_tipo_gerencia int NOT NULL PRIMARY KEY,
        id_workflow int NOT NULL
    );

    IF @wfImss IS NOT NULL
        INSERT INTO @map (id_tipo_gerencia, id_workflow) VALUES (1, @wfImss);

    IF @wfDesc IS NOT NULL
        INSERT INTO @map (id_tipo_gerencia, id_workflow) VALUES (2, @wfDesc);

    UPDATE mg
    SET id_workflow = w.id_workflow,
        id_paso_actual = p.id_paso,
        id_estado = p.id_estado,
        fecha_modificacion = GETDATE()
    FROM educacion_medica.matrices_generales mg
    JOIN @map m ON m.id_tipo_gerencia = mg.id_tipo_gerencia
    JOIN config.workflows w ON w.id_workflow = m.id_workflow AND w.activo = 1
    CROSS APPLY (
        SELECT TOP 1 p.id_paso, p.id_estado
        FROM config.workflow_pasos p
        WHERE p.id_workflow = w.id_workflow
          AND p.es_inicio = 1
          AND p.activo = 1
        ORDER BY p.orden, p.id_paso
    ) p
    WHERE NOT EXISTS (SELECT 1 FROM config.workflows w2 WHERE w2.id_workflow = mg.id_workflow)
       OR mg.id_paso_actual IS NULL
       OR NOT EXISTS (
            SELECT 1
            FROM config.workflow_pasos p2
            WHERE p2.id_paso = mg.id_paso_actual
              AND p2.id_workflow = w.id_workflow
              AND p2.activo = 1
       );

    PRINT 'Matrices re-vinculadas al paso inicial: ' + CAST(@@ROWCOUNT AS varchar(10)) + ' fila(s).';

    -- =========================================================================
    -- 3) Alinear id_estado cuando el paso es válido pero el estado es inválido
    -- =========================================================================
    UPDATE mg
    SET id_estado = p.id_estado,
        fecha_modificacion = GETDATE()
    FROM educacion_medica.matrices_generales mg
    JOIN config.workflow_pasos p
        ON p.id_paso = mg.id_paso_actual
       AND p.id_workflow = mg.id_workflow
       AND p.activo = 1
    WHERE mg.id_estado IS NULL
       OR NOT EXISTS (SELECT 1 FROM config.workflow_estados e WHERE e.id_estado = mg.id_estado);

    PRINT 'Estados alineados: ' + CAST(@@ROWCOUNT AS varchar(10)) + ' fila(s).';

    IF EXISTS (
        SELECT 1
        FROM educacion_medica.matrices_generales mg
        WHERE mg.id_tipo_gerencia NOT IN (1, 2)
          AND (
              mg.id_workflow IS NULL
              OR NOT EXISTS (SELECT 1 FROM config.workflows w WHERE w.id_workflow = mg.id_workflow)
          )
    )
        PRINT 'ADVERTENCIA: hay matrices de gerencias sin workflow configurado (3/4). Crea su variante antes de usarlas.';

    COMMIT TRANSACTION;
    PRINT '0040 completado: mappings y matrices de talleres reparados.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0040: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

-- =============================================================================
-- VERIFICACIÓN (ejecutar aparte)
-- =============================================================================
-- 1) Mappings de matriz
-- SELECT m.id_mapping, m.codigo_proceso, m.id_scope_type, m.scope_id,
--        m.id_workflow, w.nombre, w.activo AS workflow_activo, m.activo
-- FROM config.workflow_mappings m
-- LEFT JOIN config.workflows w ON w.id_workflow = m.id_workflow
-- WHERE m.codigo_proceso = 'EDUCACION_MEDICA_MATRIZ'
-- ORDER BY m.scope_id, m.id_mapping;
--
-- 2) Matrices y su paso
-- SELECT mg.id_matriz_general, mg.id_tipo_gerencia,
--        CONVERT(varchar(10), mg.periodo, 23) AS periodo,
--        mg.id_workflow, w.nombre AS workflow,
--        mg.id_paso_actual, p.nombre_paso, p.es_inicio, mg.id_estado
-- FROM educacion_medica.matrices_generales mg
-- LEFT JOIN config.workflows w ON w.id_workflow = mg.id_workflow
-- LEFT JOIN config.workflow_pasos p
--        ON p.id_paso = mg.id_paso_actual AND p.id_workflow = mg.id_workflow
-- ORDER BY mg.id_matriz_general;
--
-- 3) Matrices huérfanas (debe devolver 0 filas)
-- SELECT mg.id_matriz_general, mg.id_tipo_gerencia, mg.id_workflow, mg.id_paso_actual
-- FROM educacion_medica.matrices_generales mg
-- LEFT JOIN config.workflows w ON w.id_workflow = mg.id_workflow
-- LEFT JOIN config.workflow_pasos p
--        ON p.id_paso = mg.id_paso_actual AND p.id_workflow = mg.id_workflow
-- WHERE mg.id_workflow IS NULL OR w.id_workflow IS NULL OR p.id_paso IS NULL;
