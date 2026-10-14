-- =============================================================================
-- 0015 — Flujos de Educación Médica (Selección, Rutas y Matriz de Talleres)
--        + esquema de la Matriz de Talleres
-- ADR: lefarma.docs/educacion-medica/decisiones/00007_modulo-matriz-talleres.md
--      (y 00006_workflow-seleccion-y-rutas.md para selección/rutas)
--
-- QUÉ HACE
--   1) Tipos de acción EM por proceso (workflow_tipos_accion es único por
--      codigo + codigo_proceso): siembra AUTORIZAR, ENVIAR, DEVOLVER y CANCELAR
--      para EDUCACION_MEDICA_SELECCION, EDUCACION_MEDICA_RUTAS y
--      EDUCACION_MEDICA_MATRIZ (guardas por codigo + codigo_proceso).
--   2) LIMPIEZA "DESDE CERO" de los tres flujos EM: elimina, si existen, los
--      workflows de esos procesos con TODA su configuración (pasos, acciones,
--      condiciones, handlers, notificaciones, recordatorios, participantes,
--      jefes excluidos, mappings y bitácora). Ver ADVERTENCIA abajo.
--   3) INSERTs limpios de los SEIS flujos que deben existir:
--        EDUCACION_MEDICA_SELECCION
--            - 'Selección mensual - IMSS'            (Borrador -> GG -> GV IMSS -> Autorizada)
--            - 'Selección mensual - Descentralizado' (Borrador -> GG -> GV Desc. -> Autorizada)
--        EDUCACION_MEDICA_RUTAS
--            - 'Rutas - IMSS'                        (Draft -> GV IMSS -> CA -> DC -> Confirmada / Cancelada)
--            - 'Rutas - Descentralizado'             (Draft -> GV Desc. -> CA -> DC -> Confirmada / Cancelada)
--        EDUCACION_MEDICA_MATRIZ
--            - 'Matriz de talleres - IMSS'           (Concentración -> GV IMSS -> costos AEM -> CA -> DC -> Autorizada)
--            - 'Matriz de talleres - Descentralizado'(Concentración -> GV Desc. -> costos AEM -> CA -> DC -> Autorizada)
--   4) Esquema de la Matriz (idempotente):
--        - educacion_medica.matrices_individuales (equipo de pareo + mes)
--        - educacion_medica.matrices_generales    (gerencia + mes; entidad del
--          workflow: id_workflow/id_paso_actual/id_estado, SIN estado propio)
--        - ALTER talleres: id_matriz_individual e id_matriz_general
--          (FKs ON DELETE NO ACTION + índices). No se toca la columna estado.
--   5) Scope type TIPO_GERENCIA (idempotente), necesario para los mappings
--      por gerencia que se crean en el frontend.
--
-- REQUISITOS
--   - Esquema base de 0014 aplicado (rutas_versiones y columnas de workflow en
--     selecciones_mensuales/rutas). Este script NO lo re-crea.
--   - Estados del catálogo: CREADA, REVISION, PREPARACION, REVISION_DIRECTOR,
--     APROBACION y CANCELADA.
--   - Este script reemplaza el seed de workflows de 0014: los flujos de
--     selección y rutas se recrean aquí con los tipos de acción de su proceso
--     (por eso ya no se hace el remapeo de acciones).
--
-- ⚠️ ADVERTENCIA
--   La sección 2 borra la configuración manual existente de los tres flujos EM
--   (mappings, participantes, notificaciones, recordatorios) y recrea los
--   workflows con IDs nuevos. Está pensada para la puesta en marcha /
--   recreación limpia: NO re-ejecutar una vez que haya documentos en flujo.
--
-- QUÉ NO HACE (se configura en el FRONTEND, admin de workflows)
--   1) MAPPINGS por gerencia (scope TIPO_GERENCIA):
--        EDUCACION_MEDICA_SELECCION + 1 -> 'Selección mensual - IMSS'
--        EDUCACION_MEDICA_SELECCION + 2 -> 'Selección mensual - Descentralizado'
--        EDUCACION_MEDICA_RUTAS     + 1 -> 'Rutas - IMSS'
--        EDUCACION_MEDICA_RUTAS     + 2 -> 'Rutas - Descentralizado'
--        EDUCACION_MEDICA_MATRIZ    + 1 -> 'Matriz de talleres - IMSS'
--        EDUCACION_MEDICA_MATRIZ    + 2 -> 'Matriz de talleres - Descentralizado'
--   2) PARTICIPANTES por paso (selección, rutas y matriz):
--        Selección: Firma GG -> usuario GG; Firma GV -> usuario GV de la gerencia
--        Rutas:     Firma GV -> usuario GV de la gerencia; Revisión CA -> CA; Autorización DC -> DC
--        Matriz:    Concentración y Firma GV -> usuario GV de la gerencia;
--                   Registro de costos AEM -> AEM; Revisión CA -> CA; Autorización DC -> DC
--
--   >>> ADVERTENCIA 1: mientras un paso no tenga participantes, el motor permite
--   >>> ejecutar sus acciones a CUALQUIER usuario autenticado.
--   >>> ADVERTENCIA 2: los mappings son OBLIGATORIOS. Sin mapping, el resolver
--   >>> cae al fallback por código compartido y podría elegir la variante
--   >>> equivocada (p. ej. pedir la firma al GV que no corresponde).
--
--   Sin backfill: las tablas de talleres están vacías en operación.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 0. PREFLIGHT: prerrequisitos (falla con mensaje claro si falta algo)
    -- =========================================================================
    DECLARE @faltantes NVARCHAR(MAX) = N'';

    IF OBJECT_ID('educacion_medica.tipo_gerencia') IS NULL
        SET @faltantes += N'educacion_medica.tipo_gerencia (script 0003), ';
    IF OBJECT_ID('educacion_medica.talleres') IS NULL
        SET @faltantes += N'educacion_medica.talleres (script 0003), ';
    IF OBJECT_ID('educacion_medica.equipos_pareo') IS NULL
        SET @faltantes += N'educacion_medica.equipos_pareo (scripts 0010 + 0006), ';
    IF OBJECT_ID('config.workflows') IS NULL
        OR OBJECT_ID('config.workflow_pasos') IS NULL
        OR OBJECT_ID('config.workflow_acciones') IS NULL
        OR OBJECT_ID('config.workflow_tipos_accion') IS NULL
        OR OBJECT_ID('config.workflow_estados') IS NULL
        OR OBJECT_ID('config.workflow_scope_types') IS NULL
        OR OBJECT_ID('config.workflow_participantes') IS NULL
        OR OBJECT_ID('config.workflow_condiciones') IS NULL
        OR OBJECT_ID('config.workflow_notificaciones') IS NULL
        OR OBJECT_ID('config.workflow_notificacion_canal') IS NULL
        OR OBJECT_ID('config.workflow_bitacora') IS NULL
        OR OBJECT_ID('config.workflow_accion_handlers') IS NULL
        OR OBJECT_ID('config.workflow_mappings') IS NULL
        OR OBJECT_ID('config.workflow_jefes_excluidos') IS NULL
        OR OBJECT_ID('config.workflow_recordatorio') IS NULL
        OR OBJECT_ID('config.workflow_recordatorio_canal') IS NULL
        OR OBJECT_ID('config.workflow_recordatorio_log') IS NULL
        SET @faltantes += N'catálogo del motor config.workflow_* (esquema base de la plataforma), ';

    IF LEN(@faltantes) > 0
    BEGIN
        SET @faltantes = LEFT(@faltantes, LEN(@faltantes) - 1); -- quita la última coma
        DECLARE @mensaje NVARCHAR(2048) = N'0015: faltan prerrequisitos -> ' + @faltantes
            + N'. Aplica los scripts pendientes (orden recomendado: 0003, 0010, 0006, 0007, 0013, 0014) '
            + N'o usa el paquete consolidado, y vuelve a ejecutar 0015.';
        RAISERROR(@mensaje, 16, 1);
    END

    -- =========================================================================
    -- 1. TIPOS DE ACCIÓN EM POR PROCESO (único por codigo + codigo_proceso)
    -- =========================================================================

    DECLARE @procesos TABLE (codigo_proceso VARCHAR(50));
    INSERT INTO @procesos (codigo_proceso)
    VALUES ('EDUCACION_MEDICA_SELECCION'), ('EDUCACION_MEDICA_RUTAS'), ('EDUCACION_MEDICA_MATRIZ');

    DECLARE @tipos TABLE (codigo VARCHAR(50), nombre VARCHAR(100), descripcion VARCHAR(300), cambia_estado BIT);
    INSERT INTO @tipos (codigo, nombre, descripcion, cambia_estado)
    VALUES
        ('AUTORIZAR', 'Autorizar',              'Autoriza y avanza al siguiente paso del workflow de Educación Médica.', 1),
        ('ENVIAR',    'Enviar',                 'Envía al siguiente paso del workflow de Educación Médica (sin firma).', 1),
        ('DEVOLVER',  'Devolver',               'Devuelve al paso anterior para corrección (comentario obligatorio).',   1),
        ('CANCELAR',  'Cancelar',               'Cancela la entidad del workflow de Educación Médica.',                  1);

    INSERT INTO config.workflow_tipos_accion (codigo, nombre, descripcion, cambia_estado, activo, codigo_proceso)
    SELECT t.codigo, t.nombre, t.descripcion, t.cambia_estado, 1, p.codigo_proceso
    FROM @tipos t
    CROSS JOIN @procesos p
    WHERE NOT EXISTS (
        SELECT 1 FROM config.workflow_tipos_accion x
        WHERE x.codigo = t.codigo AND x.codigo_proceso = p.codigo_proceso
    );
    IF @@ROWCOUNT > 0
        PRINT 'Tipos de acción EM sembrados (AUTORIZAR/ENVIAR/DEVOLVER/CANCELAR x 3 procesos).';
    ELSE
        PRINT 'Tipos de acción EM ya existen. Skip.';

    -- =========================================================================
    -- 2. LIMPIEZA "DESDE CERO" DE LOS FLUJOS EM (selección, rutas, matriz)
    --    Borra los workflows de los tres procesos con toda su configuración.
    --    Orden: hijos -> acciones -> pasos -> workflows (respeta las FKs).
    -- =========================================================================

    DECLARE @procesos_em TABLE (codigo_proceso VARCHAR(50) PRIMARY KEY);
    INSERT INTO @procesos_em (codigo_proceso)
    VALUES ('EDUCACION_MEDICA_SELECCION'), ('EDUCACION_MEDICA_RUTAS'), ('EDUCACION_MEDICA_MATRIZ');

    DECLARE @wf_em TABLE (id_workflow INT PRIMARY KEY);
    INSERT INTO @wf_em (id_workflow)
    SELECT w.id_workflow
    FROM config.workflows w
    JOIN @procesos_em t ON t.codigo_proceso = w.codigo_proceso;

    DECLARE @pasos_em TABLE (id_paso INT PRIMARY KEY);
    INSERT INTO @pasos_em (id_paso)
    SELECT p.id_paso
    FROM config.workflow_pasos p
    JOIN @wf_em w ON w.id_workflow = p.id_workflow;

    DECLARE @acciones_em TABLE (id_accion INT PRIMARY KEY);
    INSERT INTO @acciones_em (id_accion)
    SELECT a.id_accion
    FROM config.workflow_acciones a
    JOIN @pasos_em p ON p.id_paso = a.id_paso_origen;

    DECLARE @recordatorios_em TABLE (id_recordatorio INT PRIMARY KEY);
    INSERT INTO @recordatorios_em (id_recordatorio)
    SELECT r.id_recordatorio
    FROM config.workflow_recordatorio r
    JOIN @wf_em w ON w.id_workflow = r.id_workflow;

    -- 2.1 Hijos de recordatorios y canales de notificación
    DELETE l FROM config.workflow_recordatorio_log l
        JOIN @recordatorios_em r ON r.id_recordatorio = l.id_recordatorio;
    DELETE c FROM config.workflow_recordatorio_canal c
        JOIN @recordatorios_em r ON r.id_recordatorio = c.id_recordatorio;
    DELETE c FROM config.workflow_notificacion_canal c
        JOIN config.workflow_notificaciones n ON n.id_notificacion = c.id_notificacion
        WHERE n.id_accion IN (SELECT id_accion FROM @acciones_em)
           OR n.id_paso_destino IN (SELECT id_paso FROM @pasos_em);

    -- 2.2 Configuración dependiente de acciones/pasos
    DELETE n FROM config.workflow_notificaciones n
        WHERE n.id_accion IN (SELECT id_accion FROM @acciones_em)
           OR n.id_paso_destino IN (SELECT id_paso FROM @pasos_em);
    DELETE c FROM config.workflow_condiciones c
        WHERE c.id_accion IN (SELECT id_accion FROM @acciones_em)
           OR c.id_paso_si_cumple IN (SELECT id_paso FROM @pasos_em);
    DELETE h FROM config.workflow_accion_handlers h
        WHERE h.id_accion IN (SELECT id_accion FROM @acciones_em);
    DELETE b FROM config.workflow_bitacora b
        WHERE b.id_workflow IN (SELECT id_workflow FROM @wf_em);

    -- 2.3 Acciones, participantes y configuración del workflow
    DELETE a FROM config.workflow_acciones a
        WHERE a.id_paso_origen IN (SELECT id_paso FROM @pasos_em)
           OR a.id_paso_destino IN (SELECT id_paso FROM @pasos_em);
    DELETE pa FROM config.workflow_participantes pa
        WHERE pa.id_paso IN (SELECT id_paso FROM @pasos_em);
    DELETE j FROM config.workflow_jefes_excluidos j
        WHERE j.id_workflow IN (SELECT id_workflow FROM @wf_em);
    DELETE m FROM config.workflow_mappings m
        WHERE m.id_workflow IN (SELECT id_workflow FROM @wf_em);
    DELETE r FROM config.workflow_recordatorio r
        WHERE r.id_recordatorio IN (SELECT id_recordatorio FROM @recordatorios_em);
    DELETE p FROM config.workflow_pasos p
        WHERE p.id_paso IN (SELECT id_paso FROM @pasos_em);
    DELETE w FROM config.workflows w
        WHERE w.id_workflow IN (SELECT id_workflow FROM @wf_em);

    PRINT 'Limpieza desde cero de los flujos EM (selección, rutas, matriz) completada.';

    -- =========================================================================
    -- 3. CATÁLOGO DEL MOTOR (estados, scope y tipos de acción por proceso)
    -- =========================================================================

    -- 3.1 Estados EXISTENTES del catálogo (misma convención que OC y 0014)
    DECLARE @eCreada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'CREADA');
    DECLARE @eRevision INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'REVISION');
    DECLARE @ePreparacion INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'PREPARACION');
    DECLARE @eRevisionDirector INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'REVISION_DIRECTOR');
    DECLARE @eAprobacion INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'APROBACION');
    DECLARE @eCancelada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'CANCELADA');

    IF @eCreada IS NULL OR @eRevision IS NULL OR @ePreparacion IS NULL
       OR @eRevisionDirector IS NULL OR @eAprobacion IS NULL OR @eCancelada IS NULL
    BEGIN
        RAISERROR('Faltan estados en config.workflow_estados (se esperan CREADA, REVISION, PREPARACION, REVISION_DIRECTOR, APROBACION, CANCELADA).', 16, 1);
    END

    -- 3.2 Scope type TIPO_GERENCIA (para crear los mappings por gerencia en el frontend)
    IF NOT EXISTS (SELECT 1 FROM config.workflow_scope_types WHERE codigo = 'TIPO_GERENCIA')
    BEGIN
        INSERT INTO config.workflow_scope_types (codigo, nombre, nivel_prioridad, descripcion, activo, fecha_creacion)
        VALUES ('TIPO_GERENCIA', 'Tipo de gerencia (Educación Médica)', 20,
                'Rutea EDUCACION_MEDICA_SELECCION, EDUCACION_MEDICA_RUTAS y EDUCACION_MEDICA_MATRIZ a su variante por gerencia (1 = IMSS, 2 = Descentralizado)', 1, GETDATE());
        PRINT 'Scope type [TIPO_GERENCIA] creado (usa este scope para los mappings en el frontend).';
    END
    ELSE
    BEGIN
        PRINT 'Scope type [TIPO_GERENCIA] ya existe. Skip.';
    END

    -- 3.3 Tipos de acción por proceso (sembrados en la sección 1)
    DECLARE @selAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR' AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR'    AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER'  AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selCancelar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CANCELAR'  AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');

    DECLARE @rutAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR' AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR'    AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER'  AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutCancelar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CANCELAR'  AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');

    DECLARE @matAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR' AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR'    AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER'  AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matCancelar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CANCELAR'  AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');

    IF @selAutorizar IS NULL OR @rutAutorizar IS NULL OR @matAutorizar IS NULL
    BEGIN
        RAISERROR('Faltan tipos de acción por proceso en config.workflow_tipos_accion.', 16, 1);
    END

    -- =========================================================================
    -- 4. FLUJOS (6 variantes lineales, sin condiciones)
    -- =========================================================================

    -----------------------------------------------------------------------------
    -- 4.1 EDUCACION_MEDICA_SELECCION · 'Selección mensual - IMSS'
    --     Borrador -> Firma GG -> Firma GV IMSS -> Autorizada
    -----------------------------------------------------------------------------
    DECLARE @wfSelImss INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Selección mensual - IMSS', 'Selección mensual de hospitales de IMSS: firma Gerencia General y después el Gerente de Ventas IMSS.', 'EDUCACION_MEDICA_SELECCION', 1, 1, GETDATE());
    SET @wfSelImss = SCOPE_IDENTITY();
    PRINT 'Workflow [Selección mensual - IMSS] creado (id ' + CAST(@wfSelImss AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfSelImss,  0, 'Borrador',                       @eCreada,   'Selección capturada; editable hasta enviarse a revisión.',                          1, 0, 0, 0, 0, 1, 1),
        (@wfSelImss, 10, 'Firma Gerencia General',         @eRevision, 'Gerencia General firma y solicita la firma del Gerente de Ventas (IDT-003 5.1.3).', 0, 0, 1, 0, 0, 1, 1),
        (@wfSelImss, 20, 'Firma Gerente de Ventas - IMSS', @eRevision, 'Firma del Gerente de Ventas de la gerencia IMSS.',                                  0, 0, 1, 0, 0, 1, 1),
        (@wfSelImss, 30, 'Autorizada',                     @eAprobacion, 'Selección autorizada; habilita la planificación de rutas.',                       0, 1, 0, 0, 0, 1, 1);

    DECLARE @siInicio INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 0);
    DECLARE @siGg     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 10);
    DECLARE @siGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 20);
    DECLARE @siFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 30);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@siInicio, @siGg,     @selEnviar,    1),
        (@siGg,     @siGv,     @selAutorizar, 1),
        (@siGg,     @siInicio, @selDevolver,  1),
        (@siGv,     @siFin,    @selAutorizar, 1),
        (@siGv,     @siInicio, @selDevolver,  1);

    -----------------------------------------------------------------------------
    -- 4.2 EDUCACION_MEDICA_SELECCION · 'Selección mensual - Descentralizado'
    --     Borrador -> Firma GG -> Firma GV Descentralizado -> Autorizada
    -----------------------------------------------------------------------------
    DECLARE @wfSelDesc INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Selección mensual - Descentralizado', 'Selección mensual de hospitales Descentralizados: firma Gerencia General y después el Gerente de Ventas Descentralizado.', 'EDUCACION_MEDICA_SELECCION', 1, 1, GETDATE());
    SET @wfSelDesc = SCOPE_IDENTITY();
    PRINT 'Workflow [Selección mensual - Descentralizado] creado (id ' + CAST(@wfSelDesc AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfSelDesc,  0, 'Borrador',                              @eCreada,   'Selección capturada; editable hasta enviarse a revisión.',                          1, 0, 0, 0, 0, 1, 1),
        (@wfSelDesc, 10, 'Firma Gerencia General',                @eRevision, 'Gerencia General firma y solicita la firma del Gerente de Ventas (IDT-003 5.1.3).', 0, 0, 1, 0, 0, 1, 1),
        (@wfSelDesc, 20, 'Firma Gerente de Ventas - Descentralizado', @eRevision, 'Firma del Gerente de Ventas de la gerencia Descentralizado.',                   0, 0, 1, 0, 0, 1, 1),
        (@wfSelDesc, 30, 'Autorizada',                            @eAprobacion, 'Selección autorizada; habilita la planificación de rutas.',                       0, 1, 0, 0, 0, 1, 1);

    DECLARE @sdInicio INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 0);
    DECLARE @sdGg     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 10);
    DECLARE @sdGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 20);
    DECLARE @sdFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 30);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@sdInicio, @sdGg,     @selEnviar,    1),
        (@sdGg,     @sdGv,     @selAutorizar, 1),
        (@sdGg,     @sdInicio, @selDevolver,  1),
        (@sdGv,     @sdFin,    @selAutorizar, 1),
        (@sdGv,     @sdInicio, @selDevolver,  1);

    -----------------------------------------------------------------------------
    -- 4.3 EDUCACION_MEDICA_RUTAS · 'Rutas - IMSS'
    --     Draft -> Firma GV IMSS -> Revisión CA -> Autorización DC -> Confirmada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfRutImss INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Rutas - IMSS', 'Autorización de la versión de rutas de IMSS: firma GV IMSS, revisión de costos del Coordinador Administrativo y autorización de Dirección Corporativa.', 'EDUCACION_MEDICA_RUTAS', 1, 1, GETDATE());
    SET @wfRutImss = SCOPE_IDENTITY();
    PRINT 'Workflow [Rutas - IMSS] creado (id ' + CAST(@wfRutImss AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfRutImss,  0, 'Draft (en captura)',                 @eCreada,           'Propuesta generada; editable hasta enviarse a autorización.',                           1, 0, 0, 0, 0, 1, 1),
        (@wfRutImss, 10, 'Firma Gerente de Ventas - IMSS',     @eRevision,         'Firma del Gerente de Ventas IMSS (concentra y firma, IDT-003 5.2.3).',                  0, 0, 1, 0, 0, 1, 1),
        (@wfRutImss, 20, 'Revisión Coordinador Administrativo', @ePreparacion,     'Revisa costos y firma la matriz (IDT-004 5.2).',                                        0, 0, 1, 0, 0, 1, 1),
        (@wfRutImss, 30, 'Autorización Dirección Corporativa',  @eRevisionDirector, 'Autoriza la planeación (IDT-004 5.2).',                                                 0, 0, 1, 0, 0, 1, 1),
        (@wfRutImss, 40, 'Confirmada',                          @eAprobacion,       'Rutas confirmadas; se publican las asignaciones a los ejecutivos.',                     0, 1, 0, 0, 0, 1, 1),
        (@wfRutImss, 50, 'Cancelada',                           @eCancelada,        'Versión cancelada; habilita regenerar (solo el creador puede cancelar).',               0, 1, 0, 0, 0, 1, 1);

    DECLARE @riDraft INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 0);
    DECLARE @riGv    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 10);
    DECLARE @riCa    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 20);
    DECLARE @riDc    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 30);
    DECLARE @riFin   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 40);
    DECLARE @riCan   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 50);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@riDraft, @riGv,    @rutEnviar,    1),
        (@riGv,    @riCa,    @rutAutorizar, 1),
        (@riCa,    @riDc,    @rutAutorizar, 1),
        (@riDc,    @riFin,   @rutAutorizar, 1),
        (@riGv,    @riDraft, @rutDevolver,  1),
        (@riCa,    @riDraft, @rutDevolver,  1),
        (@riDc,    @riDraft, @rutDevolver,  1),
        (@riDraft, @riCan,   @rutCancelar,  1),
        (@riGv,    @riCan,   @rutCancelar,  1),
        (@riCa,    @riCan,   @rutCancelar,  1),
        (@riDc,    @riCan,   @rutCancelar,  1);

    -----------------------------------------------------------------------------
    -- 4.4 EDUCACION_MEDICA_RUTAS · 'Rutas - Descentralizado'
    --     Draft -> Firma GV Desc. -> Revisión CA -> Autorización DC -> Confirmada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfRutDesc INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Rutas - Descentralizado', 'Autorización de la versión de rutas Descentralizadas: firma GV Descentralizado, revisión de costos del Coordinador Administrativo y autorización de Dirección Corporativa.', 'EDUCACION_MEDICA_RUTAS', 1, 1, GETDATE());
    SET @wfRutDesc = SCOPE_IDENTITY();
    PRINT 'Workflow [Rutas - Descentralizado] creado (id ' + CAST(@wfRutDesc AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfRutDesc,  0, 'Draft (en captura)',                    @eCreada,           'Propuesta generada; editable hasta enviarse a autorización.',                           1, 0, 0, 0, 0, 1, 1),
        (@wfRutDesc, 10, 'Firma Gerente de Ventas - Descentralizado', @eRevision,     'Firma del Gerente de Ventas Descentralizado (concentra y firma, IDT-003 5.2.3).',      0, 0, 1, 0, 0, 1, 1),
        (@wfRutDesc, 20, 'Revisión Coordinador Administrativo',   @ePreparacion,      'Revisa costos y firma la matriz (IDT-004 5.2).',                                        0, 0, 1, 0, 0, 1, 1),
        (@wfRutDesc, 30, 'Autorización Dirección Corporativa',    @eRevisionDirector, 'Autoriza la planeación (IDT-004 5.2).',                                                 0, 0, 1, 0, 0, 1, 1),
        (@wfRutDesc, 40, 'Confirmada',                            @eAprobacion,       'Rutas confirmadas; se publican las asignaciones a los ejecutivos.',                     0, 1, 0, 0, 0, 1, 1),
        (@wfRutDesc, 50, 'Cancelada',                             @eCancelada,        'Versión cancelada; habilita regenerar (solo el creador puede cancelar).',               0, 1, 0, 0, 0, 1, 1);

    DECLARE @rdDraft INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 0);
    DECLARE @rdGv    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 10);
    DECLARE @rdCa    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 20);
    DECLARE @rdDc    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 30);
    DECLARE @rdFin   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 40);
    DECLARE @rdCan   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 50);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@rdDraft, @rdGv,    @rutEnviar,    1),
        (@rdGv,    @rdCa,    @rutAutorizar, 1),
        (@rdCa,    @rdDc,    @rutAutorizar, 1),
        (@rdDc,    @rdFin,   @rutAutorizar, 1),
        (@rdGv,    @rdDraft, @rutDevolver,  1),
        (@rdCa,    @rdDraft, @rutDevolver,  1),
        (@rdDc,    @rdDraft, @rutDevolver,  1),
        (@rdDraft, @rdCan,   @rutCancelar,  1),
        (@rdGv,    @rdCan,   @rutCancelar,  1),
        (@rdCa,    @rdCan,   @rutCancelar,  1),
        (@rdDc,    @rdCan,   @rutCancelar,  1);

    -----------------------------------------------------------------------------
    -- 4.5 EDUCACION_MEDICA_MATRIZ · 'Matriz de talleres - IMSS'
    --     Concentración -> Firma GV IMSS -> Costos AEM -> Revisión CA -> Autorización DC -> Autorizada
    -----------------------------------------------------------------------------
    DECLARE @wfMatImss INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Matriz de talleres - IMSS', 'Autorización de la matriz de talleres de IMSS: firma del Gerente de Ventas IMSS, costos del AEM, revisión del CA y autorización de DC.', 'EDUCACION_MEDICA_MATRIZ', 1, 1, GETDATE());
    SET @wfMatImss = SCOPE_IDENTITY();
    PRINT 'Workflow [Matriz de talleres - IMSS] creado (id ' + CAST(@wfMatImss AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfMatImss,  0, 'Concentración',                    @eCreada,           'Los equipos de pareo capturan talleres; la matriz es editable solo en este paso.',  1, 0, 0, 0, 0, 1, 1),
        (@wfMatImss, 10, 'Firma Gerente de Ventas - IMSS',   @eRevision,         'El Gerente de Ventas IMSS revisa la concentración por equipo y firma la matriz (IDT-003 5.2.3).', 0, 0, 1, 0, 0, 1, 1),
        (@wfMatImss, 20, 'Registro de costos - AEM',         @ePreparacion,      'El Auxiliar Administrativo de Educación Médica registra los costos (muestras, folletos, envío, box lunch) y envía (IDT-004 5.1).', 0, 0, 0, 0, 0, 1, 1),
        (@wfMatImss, 30, 'Revisión de costos - CA',          @eRevision,         'El Coordinador Administrativo revisa los costos contra políticas y firma (IDT-004 5.2).', 0, 0, 1, 0, 0, 1, 1),
        (@wfMatImss, 40, 'Autorización - DC',                @eRevisionDirector, 'Dirección Corporativa autoriza la matriz (IDT-004 5.2).',                          0, 0, 1, 0, 0, 1, 1),
        (@wfMatImss, 50, 'Autorizada',                       @eAprobacion,       'Matriz autorizada; los talleres pasan a Autorizado.',                              0, 1, 0, 0, 0, 1, 1);

    DECLARE @miConc INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 0);
    DECLARE @miGv   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 10);
    DECLARE @miAem  INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 20);
    DECLARE @miCa   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 30);
    DECLARE @miDc   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 40);
    DECLARE @miFin  INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 50);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@miConc, @miGv,   @matEnviar,    1),
        (@miGv,   @miAem,  @matAutorizar, 1),
        (@miGv,   @miConc, @matDevolver,  1),
        (@miAem,  @miCa,   @matEnviar,    1),
        (@miAem,  @miConc, @matDevolver,  1),
        (@miCa,   @miDc,   @matAutorizar, 1),
        (@miCa,   @miAem,  @matDevolver,  1),
        (@miDc,   @miFin,  @matAutorizar, 1),
        (@miDc,   @miCa,   @matDevolver,  1);

    -----------------------------------------------------------------------------
    -- 4.6 EDUCACION_MEDICA_MATRIZ · 'Matriz de talleres - Descentralizado'
    --     Concentración -> Firma GV Desc. -> Costos AEM -> Revisión CA -> Autorización DC -> Autorizada
    -----------------------------------------------------------------------------
    DECLARE @wfMatDesc INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Matriz de talleres - Descentralizado', 'Autorización de la matriz de talleres Descentralizados: firma del Gerente de Ventas, costos del AEM, revisión del CA y autorización de DC.', 'EDUCACION_MEDICA_MATRIZ', 1, 1, GETDATE());
    SET @wfMatDesc = SCOPE_IDENTITY();
    PRINT 'Workflow [Matriz de talleres - Descentralizado] creado (id ' + CAST(@wfMatDesc AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfMatDesc,  0, 'Concentración',                            @eCreada,           'Los equipos de pareo capturan talleres; la matriz es editable solo en este paso.',  1, 0, 0, 0, 0, 1, 1),
        (@wfMatDesc, 10, 'Firma Gerente de Ventas - Descentralizado', @eRevision,        'El Gerente de Ventas Descentralizado revisa la concentración por equipo y firma la matriz (IDT-003 5.2.3).', 0, 0, 1, 0, 0, 1, 1),
        (@wfMatDesc, 20, 'Registro de costos - AEM',                 @ePreparacion,      'El Auxiliar Administrativo de Educación Médica registra los costos (muestras, folletos, envío, box lunch) y envía (IDT-004 5.1).', 0, 0, 0, 0, 0, 1, 1),
        (@wfMatDesc, 30, 'Revisión de costos - CA',                  @eRevision,         'El Coordinador Administrativo revisa los costos contra políticas y firma (IDT-004 5.2).', 0, 0, 1, 0, 0, 1, 1),
        (@wfMatDesc, 40, 'Autorización - DC',                        @eRevisionDirector, 'Dirección Corporativa autoriza la matriz (IDT-004 5.2).',                          0, 0, 1, 0, 0, 1, 1),
        (@wfMatDesc, 50, 'Autorizada',                               @eAprobacion,       'Matriz autorizada; los talleres pasan a Autorizado.',                              0, 1, 0, 0, 0, 1, 1);

    DECLARE @mdConc INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 0);
    DECLARE @mdGv   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 10);
    DECLARE @mdAem  INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 20);
    DECLARE @mdCa   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 30);
    DECLARE @mdDc   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 40);
    DECLARE @mdFin  INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 50);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@mdConc, @mdGv,   @matEnviar,    1),
        (@mdGv,   @mdAem,  @matAutorizar, 1),
        (@mdGv,   @mdConc, @matDevolver,  1),
        (@mdAem,  @mdCa,   @matEnviar,    1),
        (@mdAem,  @mdConc, @matDevolver,  1),
        (@mdCa,   @mdDc,   @matAutorizar, 1),
        (@mdCa,   @mdAem,  @matDevolver,  1),
        (@mdDc,   @mdFin,  @matAutorizar, 1),
        (@mdDc,   @mdCa,   @matDevolver,  1);

    -- =========================================================================
    -- 5. ESQUEMA educacion_medica DE LA MATRIZ (idempotente)
    -- =========================================================================

    -- 5.1 matrices_individuales (matriz por equipo de pareo + mes)
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'matrices_individuales')
    BEGIN
        CREATE TABLE educacion_medica.matrices_individuales
        (
            id_matriz_individual    INT IDENTITY(1,1) NOT NULL,
            id_equipo               INT NOT NULL,           -- FK física -> equipos_pareo (EV + EP)
            periodo                 DATE NOT NULL,          -- primer día del mes
            estado                  VARCHAR(15) NOT NULL CONSTRAINT DF_matrices_individuales_estado DEFAULT 'EnCaptura',
            fecha_generacion        DATETIME2 NULL,         -- cuándo el equipo generó/bloqueó su matriz
            fecha_creacion          DATETIME2 NOT NULL CONSTRAINT DF_matrices_individuales_fecha_creacion DEFAULT SYSUTCDATETIME(),
            fecha_modificacion      DATETIME2 NOT NULL CONSTRAINT DF_matrices_individuales_fecha_modificacion DEFAULT SYSUTCDATETIME(),
            id_usuario_creacion     INT NULL,
            id_usuario_modificacion INT NULL,
            CONSTRAINT PK_matrices_individuales PRIMARY KEY (id_matriz_individual),
            CONSTRAINT FK_matrices_individuales_equipo FOREIGN KEY (id_equipo)
                REFERENCES educacion_medica.equipos_pareo (id_equipo),
            CONSTRAINT UQ_matrices_individuales_equipo_periodo UNIQUE (id_equipo, periodo),
            CONSTRAINT CK_matrices_individuales_periodo CHECK (DAY(periodo) = 1),
            CONSTRAINT CK_matrices_individuales_estado CHECK (estado IN ('EnCaptura','Generada'))
        );
        PRINT 'Tabla [educacion_medica].[matrices_individuales] creada.';
    END
    ELSE
    BEGIN
        PRINT 'Tabla [educacion_medica].[matrices_individuales] ya existe. Skip.';
    END

    -- 5.2 matrices_generales (matriz por gerencia + mes; entidad del workflow)
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'matrices_generales')
    BEGIN
        CREATE TABLE educacion_medica.matrices_generales
        (
            id_matriz_general       INT IDENTITY(1,1) NOT NULL,
            id_tipo_gerencia        INT NOT NULL,           -- FK física -> tipo_gerencia (IMSS | Descentralizado)
            periodo                 DATE NOT NULL,          -- primer día del mes
            id_workflow             INT NULL,               -- FK lógica -> config.workflows
            id_paso_actual          INT NULL,               -- FK lógica -> config.workflow_pasos
            id_estado               INT NULL,               -- FK lógica -> config.workflow_estados (CREADA mientras es editable)
            fecha_creacion          DATETIME2 NOT NULL CONSTRAINT DF_matrices_generales_fecha_creacion DEFAULT SYSUTCDATETIME(),
            fecha_modificacion      DATETIME2 NOT NULL CONSTRAINT DF_matrices_generales_fecha_modificacion DEFAULT SYSUTCDATETIME(),
            id_usuario_creacion     INT NULL,
            id_usuario_modificacion INT NULL,
            CONSTRAINT PK_matrices_generales PRIMARY KEY (id_matriz_general),
            CONSTRAINT FK_matrices_generales_tipo_gerencia FOREIGN KEY (id_tipo_gerencia)
                REFERENCES educacion_medica.tipo_gerencia (id_tipo_gerencia),
            CONSTRAINT UQ_matrices_generales_gerencia_periodo UNIQUE (id_tipo_gerencia, periodo),
            CONSTRAINT CK_matrices_generales_periodo CHECK (DAY(periodo) = 1)
        );
        PRINT 'Tabla [educacion_medica].[matrices_generales] creada.';
    END
    ELSE
    BEGIN
        PRINT 'Tabla [educacion_medica].[matrices_generales] ya existe. Skip.';
    END

    -- 5.3 talleres: enlaces a las matrices
    IF COL_LENGTH('educacion_medica.talleres', 'id_matriz_individual') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.talleres ADD id_matriz_individual INT NULL;
        PRINT 'Columna [id_matriz_individual] agregada a talleres.';
    END
    IF COL_LENGTH('educacion_medica.talleres', 'id_matriz_general') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.talleres ADD id_matriz_general INT NULL;
        PRINT 'Columna [id_matriz_general] agregada a talleres.';
    END
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('educacion_medica.talleres') AND name = 'FK_talleres_matriz_individual')
    BEGIN
        ALTER TABLE educacion_medica.talleres
            ADD CONSTRAINT FK_talleres_matriz_individual FOREIGN KEY (id_matriz_individual)
                REFERENCES educacion_medica.matrices_individuales (id_matriz_individual) ON DELETE NO ACTION;
        PRINT 'FK [FK_talleres_matriz_individual] creada.';
    END
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('educacion_medica.talleres') AND name = 'FK_talleres_matriz_general')
    BEGIN
        ALTER TABLE educacion_medica.talleres
            ADD CONSTRAINT FK_talleres_matriz_general FOREIGN KEY (id_matriz_general)
                REFERENCES educacion_medica.matrices_generales (id_matriz_general) ON DELETE NO ACTION;
        PRINT 'FK [FK_talleres_matriz_general] creada.';
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.talleres') AND name = 'IX_talleres_id_matriz_individual')
    BEGIN
        CREATE INDEX IX_talleres_id_matriz_individual ON educacion_medica.talleres (id_matriz_individual);
        PRINT 'Indice [IX_talleres_id_matriz_individual] creado.';
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.talleres') AND name = 'IX_talleres_id_matriz_general')
    BEGIN
        CREATE INDEX IX_talleres_id_matriz_general ON educacion_medica.talleres (id_matriz_general);
        PRINT 'Indice [IX_talleres_id_matriz_general] creado.';
    END

    -- 5.4 MS_Description (tablas nuevas y columnas nuevas)
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_individuales') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description',
            N'Matriz de talleres por equipo de pareo (EV+EP) y mes (FOR-005). EnCaptura -> Generada: al generar se bloquea la captura del equipo; el GV puede reabrirla mientras la matriz general siga en el paso inicial (ADR-00007).',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_generales') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description',
            N'Matriz general de talleres por gerencia (IMSS/Descentralizado) y mes: es la entidad autorizable del workflow EDUCACION_MEDICA_MATRIZ (GV -> costos AEM -> CA -> DC). No tiene estado propio: su estado es el del motor (id_estado). Nace automáticamente con el primer taller capturado de la gerencia/mes (ADR-00007).',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_individuales')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.matrices_individuales'), 'id_equipo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Equipo de pareo (EV+EP) dueño de la matriz (FK física educacion_medica.equipos_pareo)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'id_equipo';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_individuales')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.matrices_individuales'), 'periodo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Mes de la matriz (primer día del mes; CHECK DAY(periodo) = 1)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'periodo';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_individuales')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.matrices_individuales'), 'estado', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'EnCaptura | Generada. Generada bloquea la captura del equipo (el GV puede reabrir)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'estado';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_individuales')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.matrices_individuales'), 'fecha_generacion', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Fecha en que el equipo generó/bloqueó su matriz (UTC)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_individuales', 'COLUMN', N'fecha_generacion';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_generales')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.matrices_generales'), 'id_tipo_gerencia', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Gerencia de la matriz (FK física educacion_medica.tipo_gerencia: IMSS | Descentralizado)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'id_tipo_gerencia';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_generales')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.matrices_generales'), 'periodo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Mes de la matriz (primer día del mes; CHECK DAY(periodo) = 1)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'periodo';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_generales')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.matrices_generales'), 'id_workflow', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Workflow asignado (FK lógica -> config.workflows; variante resuelta por TIPO_GERENCIA)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'id_workflow';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_generales')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.matrices_generales'), 'id_paso_actual', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Paso actual del workflow (FK lógica -> config.workflow_pasos)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'id_paso_actual';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.matrices_generales')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.matrices_generales'), 'id_estado', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Estado actual del workflow (FK lógica -> config.workflow_estados). CREADA = paso inicial editable (patrón OC/Solicitudes)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'matrices_generales', 'COLUMN', N'id_estado';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.talleres')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'id_matriz_individual', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Matriz individual (equipo + mes) a la que pertenece el taller (FK física educacion_medica.matrices_individuales, ON DELETE NO ACTION)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_matriz_individual';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.talleres')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'id_matriz_general', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Matriz general (gerencia + mes) a la que pertenece el taller (FK física educacion_medica.matrices_generales, ON DELETE NO ACTION)',
            'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_matriz_general';

    COMMIT TRANSACTION;
    PRINT '0015 completado: 6 flujos EM (selección, rutas, matriz) + esquema de la Matriz.';

    -- =========================================================================
    -- VERIFICACIÓN (ejecutar aparte) y PASOS MANUALES EN EL FRONTEND
    -- =========================================================================
    -- SELECT id_workflow, nombre, codigo_proceso FROM config.workflows
    --   WHERE codigo_proceso LIKE 'EDUCACION_MEDICA%' ORDER BY codigo_proceso, nombre;
    -- SELECT p.id_workflow, p.orden, p.nombre_paso, e.codigo AS estado, p.es_inicio, p.es_final, p.requiere_firma
    --   FROM config.workflow_pasos p LEFT JOIN config.workflow_estados e ON e.id_estado = p.id_estado
    --   WHERE p.id_workflow IN (SELECT id_workflow FROM config.workflows WHERE codigo_proceso LIKE 'EDUCACION_MEDICA%')
    --   ORDER BY p.id_workflow, p.orden;
    -- SELECT po.nombre_paso AS origen, pd.nombre_paso AS destino, ta.codigo AS tipo, ta.codigo_proceso
    --   FROM config.workflow_acciones a
    --   JOIN config.workflow_pasos po ON po.id_paso = a.id_paso_origen
    --   JOIN config.workflow_pasos pd ON pd.id_paso = a.id_paso_destino
    --   LEFT JOIN config.workflow_tipos_accion ta ON ta.id_tipo_accion = a.id_tipo_accion
    --   WHERE po.id_workflow IN (SELECT id_workflow FROM config.workflows WHERE codigo_proceso LIKE 'EDUCACION_MEDICA%')
    --   ORDER BY po.id_workflow, po.orden, pd.orden;
    --
    -- FRONTEND (admin de workflows), después de aplicar:
    --   1) MAPPINGS (scope "Tipo de gerencia (Educación Médica)"):
    --        EDUCACION_MEDICA_SELECCION + 1 -> 'Selección mensual - IMSS'
    --        EDUCACION_MEDICA_SELECCION + 2 -> 'Selección mensual - Descentralizado'
    --        EDUCACION_MEDICA_RUTAS     + 1 -> 'Rutas - IMSS'
    --        EDUCACION_MEDICA_RUTAS     + 2 -> 'Rutas - Descentralizado'
    --        EDUCACION_MEDICA_MATRIZ    + 1 -> 'Matriz de talleres - IMSS'
    --        EDUCACION_MEDICA_MATRIZ    + 2 -> 'Matriz de talleres - Descentralizado'
    --      (Sin estos mappings el resolver NO puede distinguir la variante; crearlos
    --       antes de usar cada flujo.)
    --   2) PARTICIPANTES (por paso, en los 6 workflows):
    --        Selección: Firma GG -> usuario GG;  Firma GV -> usuario GV de la gerencia
    --        Rutas:     Firma GV -> usuario GV de la gerencia;  Revisión CA -> usuario CA;  Autorización DC -> usuario DC
    --        Matriz:    Concentración (0) y Firma GV (10) -> usuario GV de la gerencia;
    --                   Registro de costos - AEM (20) -> usuario AEM;
    --                   Revisión de costos - CA (30) -> usuario CA;
    --                   Autorización - DC (40) -> usuario DC
    -- =========================================================================
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0015: ' + ERROR_MESSAGE();
    THROW;
END CATCH
