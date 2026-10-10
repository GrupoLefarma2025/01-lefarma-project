-- =============================================================================
-- 0018 — Workflows de Educación Médica (Selección, Rutas y Matriz de Talleres)
-- ADR: lefarma.docs/educacion-medica/decisiones/00006_workflow-seleccion-y-rutas.md
--      (y 00007_modulo-matriz-talleres.md para la matriz)
--
-- CÓMO USAR
--   Entorno NUEVO: 0016 (esquema) -> 0017 (seeds) -> 0018 (este script).
--   Entornos ya migrados: este script es el VIGENTE; se puede re-ejecutar para
--   recrear los flujos EM (borra y recrea; ver ADVERTENCIA).
--
--   ⚠️ Ejecutar el script COMPLETO en un solo lote (sqlcmd -i, SSMS F5 o
--      DBeaver "Execute script" / Alt+X). NO ejecutarlo sentencia por sentencia:
--      contiene BEGIN TRY/CATCH y una transacción que abarcan todo el cuerpo.
--
-- PATRÓN ÚNICO DE FLUJOS EM (igual a OC/Solicitudes de Personal)
--   - Paso inicial: 'Creada' (estado CREADA) — editable.
--   - Pasos de firma intermedios: AUTORIZAR / DEVOLVER / RECHAZAR / CANCELAR.
--   - Penúltimo paso de firma: CERRAR (final feliz) / DEVOLVER / RECHAZAR.
--     NO tiene CANCELAR (ese paso es el que cierra o rechaza).
--   - Finales SIEMPRE presentes: Cerrada (CERRADA), Rechazada (RECHAZADA),
--     Cancelada (CANCELADA). "Cerrada" equivale a Autorizada por completo.
--   - CANCELAR disponible desde cualquier paso EXCEPTO el penúltimo.
--
-- QUÉ HACE
--   1) Tipos de acción EM por proceso (workflow_tipos_accion es único por
--      codigo + codigo_proceso): siembra AUTORIZAR, ENVIAR, DEVOLVER, CANCELAR,
--      CERRAR y RECHAZAR para EDUCACION_MEDICA_SELECCION, EDUCACION_MEDICA_RUTAS
--      y EDUCACION_MEDICA_MATRIZ (guardas por codigo + codigo_proceso).
--   2) LIMPIEZA "DESDE CERO" de los tres flujos EM: elimina, si existen, los
--      workflows de esos procesos con TODA su configuración (pasos, acciones,
--      condiciones, handlers, notificaciones, recordatorios, participantes,
--      jefes excluidos, mappings y bitácora). Ver ADVERTENCIA abajo.
--   3) INSERTs limpios de los SEIS flujos que deben existir:
--        EDUCACION_MEDICA_SELECCION
--            - 'Selección mensual - IMSS'            (Creada -> GG -> GV IMSS -> Cerrada/Rechazada/Cancelada)
--            - 'Selección mensual - Descentralizado' (Creada -> GG -> GV Desc. -> Cerrada/Rechazada/Cancelada)
--        EDUCACION_MEDICA_RUTAS
--            - 'Rutas - IMSS'                        (Creada -> GV IMSS -> CA -> DC -> Cerrada/Rechazada/Cancelada)
--            - 'Rutas - Descentralizado'             (Creada -> GV Desc. -> CA -> DC -> Cerrada/Rechazada/Cancelada)
--        EDUCACION_MEDICA_MATRIZ
--            - 'Matriz de talleres - IMSS'           (Creada -> GV IMSS -> costos AEM -> CA -> DC -> Cerrada/Rechazada/Cancelada)
--            - 'Matriz de talleres - Descentralizado'(Creada -> GV Desc. -> costos AEM -> CA -> DC -> Cerrada/Rechazada/Cancelada)
--   4) Scope type TIPO_GERENCIA (idempotente), necesario para los mappings
--      por gerencia que se crean en el frontend.
--   5) MIGRACIÓN de estados de dominio y backfill:
--        selecciones_mensuales.estado: Borrador->Creada, Autorizada->Cerrada;
--        CHECK nuevo ('Creada','EnRevision','Cerrada','Rechazada','Cancelada').
--        rutas / rutas_versiones.estado: Draft->Creada, Confirmada->Cerrada;
--        CHECK nuevo ('Creada','Cerrada','Rechazada','Cancelada','Archivada').
--        talleres.estado: Borrador->Creada; CHECK nuevo
--        ('Creada','Elaborado','Revisado','Autorizado','Programado','EnCurso','Realizado','Cancelado').
--        Backfill de id_workflow/id_paso_actual de selecciones y versiones de
--        rutas huérfanas (apuntaban a los workflows borrados).
--
-- REQUISITOS
--   - Esquema de 0016 aplicado (incluye rutas_versiones, las columnas de
--     workflow en selecciones_mensuales/rutas y las tablas de la Matriz) y
--     seeds de 0017.
--   - Estados del catálogo: CREADA, REVISION, PREPARACION, REVISION_DIRECTOR,
--     CERRADA, RECHAZADA y CANCELADA (el script siembra RECHAZADA si falta).
--
-- ⚠️ ADVERTENCIA
--   La sección 2 borra la configuración manual existente de los tres flujos EM
--   (mappings, participantes, notificaciones, recordatorios) y recrea los
--   workflows con IDs nuevos. Tras re-ejecutarlo hay que recrear mappings y
--   participantes en el admin de workflows (ver pasos manuales al final).
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
--        Matriz:    Creada y Firma GV -> usuario GV de la gerencia;
--                   Registro de costos AEM -> AEM; Revisión CA -> CA; Autorización DC -> DC
--
--   >>> ADVERTENCIA 1: mientras un paso no tenga participantes, el motor permite
--   >>> ejecutar sus acciones a CUALQUIER usuario autenticado.
--   >>> ADVERTENCIA 2: los mappings son OBLIGATORIOS. Sin mapping, el resolver
--   >>> cae al fallback por código compartido y podría elegir la variante
--   >>> equivocada (p. ej. pedir la firma al GV que no corresponde).
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
        DECLARE @mensaje NVARCHAR(2048) = N'0018: faltan prerrequisitos -> ' + @faltantes
            + N'. Aplica primero 0016 (esquema) y 0017 (seeds), y vuelve a ejecutar 0018.';
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
        ('CANCELAR',  'Cancelar',               'Cancela la entidad del workflow de Educación Médica (no disponible en el penúltimo paso).', 1),
        ('CERRAR',    'Cerrar',                 'Cierra la entidad: pasó por todos los pasos y quedó autorizada por completo.', 1),
        ('RECHAZAR',  'Rechazar',               'Rechaza definitivamente la entidad del workflow de Educación Médica (comentario obligatorio).', 1);

    INSERT INTO config.workflow_tipos_accion (codigo, nombre, descripcion, cambia_estado, activo, codigo_proceso)
    SELECT t.codigo, t.nombre, t.descripcion, t.cambia_estado, 1, p.codigo_proceso
    FROM @tipos t
    CROSS JOIN @procesos p
    WHERE NOT EXISTS (
        SELECT 1 FROM config.workflow_tipos_accion x
        WHERE x.codigo = t.codigo AND x.codigo_proceso = p.codigo_proceso
    );
    IF @@ROWCOUNT > 0
        PRINT 'Tipos de acción EM sembrados (AUTORIZAR/ENVIAR/DEVOLVER/CANCELAR/CERRAR/RECHAZAR x 3 procesos).';
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

    -- 3.1 Estados del catálogo (misma convención que OC y Solicitudes)
    IF NOT EXISTS (SELECT 1 FROM config.workflow_estados WHERE codigo = 'RECHAZADA')
    BEGIN
        INSERT INTO config.workflow_estados (codigo, nombre, color_hex, activo)
        VALUES ('RECHAZADA', 'Rechazada', '#fc3d3d', 1);
        PRINT 'Estado [RECHAZADA] agregado al catálogo config.workflow_estados.';
    END

    DECLARE @eCreada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'CREADA');
    DECLARE @eRevision INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'REVISION');
    DECLARE @ePreparacion INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'PREPARACION');
    DECLARE @eRevisionDirector INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'REVISION_DIRECTOR');
    DECLARE @eCerrada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'CERRADA');
    DECLARE @eRechazada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'RECHAZADA');
    DECLARE @eCancelada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'CANCELADA');

    IF @eCreada IS NULL OR @eRevision IS NULL OR @ePreparacion IS NULL
       OR @eRevisionDirector IS NULL OR @eCerrada IS NULL OR @eRechazada IS NULL OR @eCancelada IS NULL
    BEGIN
        RAISERROR('Faltan estados en config.workflow_estados (se esperan CREADA, REVISION, PREPARACION, REVISION_DIRECTOR, CERRADA, RECHAZADA, CANCELADA).', 16, 1);
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

    -- 3.3 Limpieza: el scope SUBPROCESO quedó OBSOLETO (versión previa; el ruteo
    --     ahora es por TIPO_GERENCIA). Solo se elimina si ningún mapping lo usa.
    DELETE s
    FROM config.workflow_scope_types s
    WHERE s.codigo = 'SUBPROCESO'
      AND NOT EXISTS (SELECT 1 FROM config.workflow_mappings m WHERE m.id_scope_type = s.id_scope_type);
    IF @@ROWCOUNT > 0
        PRINT 'Scope type obsoleto [SUBPROCESO] eliminado (sin mappings que lo usen).';

    -- 3.4 Tipos de acción por proceso (sembrados en la sección 1)
    DECLARE @selAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR' AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR'    AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER'  AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selCancelar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CANCELAR'  AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selCerrar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CERRAR'    AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');
    DECLARE @selRechazar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'RECHAZAR'  AND codigo_proceso = 'EDUCACION_MEDICA_SELECCION');

    DECLARE @rutAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR' AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR'    AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER'  AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutCancelar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CANCELAR'  AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutCerrar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CERRAR'    AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');
    DECLARE @rutRechazar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'RECHAZAR'  AND codigo_proceso = 'EDUCACION_MEDICA_RUTAS');

    DECLARE @matAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR' AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR'    AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER'  AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matCancelar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CANCELAR'  AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matCerrar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CERRAR'    AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @matRechazar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'RECHAZAR'  AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');

    IF @selAutorizar IS NULL OR @rutAutorizar IS NULL OR @matAutorizar IS NULL
       OR @selCerrar IS NULL OR @rutCerrar IS NULL OR @matCerrar IS NULL
       OR @selRechazar IS NULL OR @rutRechazar IS NULL OR @matRechazar IS NULL
    BEGIN
        RAISERROR('Faltan tipos de acción por proceso en config.workflow_tipos_accion (AUTORIZAR/CERRAR/RECHAZAR).', 16, 1);
    END

    -- =========================================================================
    -- 4. FLUJOS (6 variantes de 6 pasos: Creada + intermedios + 3 finales)
    --    CANCELAR en todos los pasos excepto el penúltimo;
    --    RECHAZAR en todos los intermedios y en el penúltimo;
    --    el penúltimo cierra (CERRAR) o rechaza (RECHAZAR).
    -- =========================================================================

    -----------------------------------------------------------------------------
    -- 4.1 EDUCACION_MEDICA_SELECCION · 'Selección mensual - IMSS'
    --     Creada -> Firma GG -> Firma GV IMSS -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfSelImss INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Selección mensual - IMSS', 'Selección mensual de hospitales de IMSS: firma Gerencia General y después el Gerente de Ventas IMSS, quien cierra o rechaza.', 'EDUCACION_MEDICA_SELECCION', 1, 1, GETDATE());
    SET @wfSelImss = SCOPE_IDENTITY();
    PRINT 'Workflow [Selección mensual - IMSS] creado (id ' + CAST(@wfSelImss AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfSelImss,  0, 'Creada',                         @eCreada,   'Selección capturada; editable solo en este paso.',                                   1, 0, 0, 0, 0, 1, 1),
        (@wfSelImss, 10, 'Firma Gerencia General',         @eRevision, 'Gerencia General firma y solicita la firma del Gerente de Ventas (IDT-003 5.1.3).', 0, 0, 1, 0, 0, 1, 1),
        (@wfSelImss, 20, 'Firma Gerente de Ventas - IMSS', @eRevision, 'Firma del Gerente de Ventas de la gerencia IMSS; cierra (Queda autorizada) o rechaza.', 0, 0, 1, 0, 0, 1, 1),
        (@wfSelImss, 30, 'Cerrada',                        @eCerrada,  'Selección completa y autorizada; habilita la planificación de rutas.',               0, 1, 0, 0, 0, 1, 1),
        (@wfSelImss, 40, 'Rechazada',                      @eRechazada,'Selección rechazada en alguna firma.',                                               0, 1, 0, 0, 0, 1, 1),
        (@wfSelImss, 50, 'Cancelada',                      @eCancelada,'Selección cancelada por el creador.',                                                0, 1, 0, 0, 0, 1, 1);

    DECLARE @siCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 0);
    DECLARE @siGg     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 10);
    DECLARE @siGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 20);
    DECLARE @siFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 30);
    DECLARE @siRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 40);
    DECLARE @siCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 50);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@siCreada, @siGg,   @selEnviar,   1),
        (@siCreada, @siCan,  @selCancelar, 1),
        (@siGg,     @siGv,   @selAutorizar,1),
        (@siGg,     @siCreada, @selDevolver,1),
        (@siGg,     @siRech, @selRechazar, 1),
        (@siGg,     @siCan,  @selCancelar, 1),
        (@siGv,     @siFin,  @selCerrar,   1),
        (@siGv,     @siCreada, @selDevolver,1),
        (@siGv,     @siRech, @selRechazar, 1);

    -----------------------------------------------------------------------------
    -- 4.2 EDUCACION_MEDICA_SELECCION · 'Selección mensual - Descentralizado'
    --     Creada -> Firma GG -> Firma GV Desc. -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfSelDesc INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Selección mensual - Descentralizado', 'Selección mensual de hospitales Descentralizados: firma Gerencia General y después el Gerente de Ventas Descentralizado, quien cierra o rechaza.', 'EDUCACION_MEDICA_SELECCION', 1, 1, GETDATE());
    SET @wfSelDesc = SCOPE_IDENTITY();
    PRINT 'Workflow [Selección mensual - Descentralizado] creado (id ' + CAST(@wfSelDesc AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfSelDesc,  0, 'Creada',                                    @eCreada,   'Selección capturada; editable solo en este paso.',                                   1, 0, 0, 0, 0, 1, 1),
        (@wfSelDesc, 10, 'Firma Gerencia General',                    @eRevision, 'Gerencia General firma y solicita la firma del Gerente de Ventas (IDT-003 5.1.3).', 0, 0, 1, 0, 0, 1, 1),
        (@wfSelDesc, 20, 'Firma Gerente de Ventas - Descentralizado', @eRevision, 'Firma del Gerente de Ventas de la gerencia Descentralizado; cierra (Queda autorizada) o rechaza.', 0, 0, 1, 0, 0, 1, 1),
        (@wfSelDesc, 30, 'Cerrada',                                   @eCerrada,  'Selección completa y autorizada; habilita la planificación de rutas.',               0, 1, 0, 0, 0, 1, 1),
        (@wfSelDesc, 40, 'Rechazada',                                 @eRechazada,'Selección rechazada en alguna firma.',                                               0, 1, 0, 0, 0, 1, 1),
        (@wfSelDesc, 50, 'Cancelada',                                 @eCancelada,'Selección cancelada por el creador.',                                                0, 1, 0, 0, 0, 1, 1);

    DECLARE @sdCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 0);
    DECLARE @sdGg     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 10);
    DECLARE @sdGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 20);
    DECLARE @sdFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 30);
    DECLARE @sdRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 40);
    DECLARE @sdCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 50);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@sdCreada, @sdGg,    @selEnviar,   1),
        (@sdCreada, @sdCan,   @selCancelar, 1),
        (@sdGg,     @sdGv,    @selAutorizar,1),
        (@sdGg,     @sdCreada, @selDevolver,1),
        (@sdGg,     @sdRech,  @selRechazar, 1),
        (@sdGg,     @sdCan,   @selCancelar, 1),
        (@sdGv,     @sdFin,   @selCerrar,   1),
        (@sdGv,     @sdCreada, @selDevolver,1),
        (@sdGv,     @sdRech,  @selRechazar, 1);

    -----------------------------------------------------------------------------
    -- 4.3 EDUCACION_MEDICA_RUTAS · 'Rutas - IMSS'
    --     Creada -> Firma GV IMSS -> Revisión CA -> Autorización DC -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfRutImss INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Rutas - IMSS', 'Autorización de la versión de rutas de IMSS: firma GV IMSS, revisión de costos del Coordinador Administrativo y cierre o rechazo de Dirección Corporativa.', 'EDUCACION_MEDICA_RUTAS', 1, 1, GETDATE());
    SET @wfRutImss = SCOPE_IDENTITY();
    PRINT 'Workflow [Rutas - IMSS] creado (id ' + CAST(@wfRutImss AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfRutImss,  0, 'Creada',                            @eCreada,           'Propuesta generada; editable solo en este paso.',                                       1, 0, 0, 0, 0, 1, 1),
        (@wfRutImss, 10, 'Firma Gerente de Ventas - IMSS',    @eRevision,         'Firma del Gerente de Ventas IMSS (concentra y firma, IDT-003 5.2.3).',                  0, 0, 1, 0, 0, 1, 1),
        (@wfRutImss, 20, 'Revisión Coordinador Administrativo', @ePreparacion,    'Revisa costos y firma la matriz (IDT-004 5.2).',                                        0, 0, 1, 0, 0, 1, 1),
        (@wfRutImss, 30, 'Autorización Dirección Corporativa',  @eRevisionDirector,'Dirección Corporativa cierra (rutas confirmadas) o rechaza (IDT-004 5.2).',            0, 0, 1, 0, 0, 1, 1),
        (@wfRutImss, 40, 'Cerrada',                           @eCerrada,          'Rutas confirmadas; se publican las asignaciones a los ejecutivos.',                     0, 1, 0, 0, 0, 1, 1),
        (@wfRutImss, 50, 'Rechazada',                         @eRechazada,        'Versión rechazada en alguna firma.',                                                    0, 1, 0, 0, 0, 1, 1),
        (@wfRutImss, 60, 'Cancelada',                         @eCancelada,        'Versión cancelada; habilita regenerar (solo el creador puede cancelar).',               0, 1, 0, 0, 0, 1, 1);

    DECLARE @riCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 0);
    DECLARE @riGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 10);
    DECLARE @riCa     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 20);
    DECLARE @riDc     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 30);
    DECLARE @riFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 40);
    DECLARE @riRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 50);
    DECLARE @riCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 60);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@riCreada, @riGv,    @rutEnviar,    1),
        (@riCreada, @riCan,   @rutCancelar,  1),
        (@riGv,     @riCa,    @rutAutorizar, 1),
        (@riGv,     @riCreada,@rutDevolver,  1),
        (@riGv,     @riRech,  @rutRechazar,  1),
        (@riGv,     @riCan,   @rutCancelar,  1),
        (@riCa,     @riDc,    @rutAutorizar, 1),
        (@riCa,     @riCreada,@rutDevolver,  1),
        (@riCa,     @riRech,  @rutRechazar,  1),
        (@riCa,     @riCan,   @rutCancelar,  1),
        (@riDc,     @riFin,   @rutCerrar,    1),
        (@riDc,     @riCreada,@rutDevolver,  1),
        (@riDc,     @riRech,  @rutRechazar,  1);

    -----------------------------------------------------------------------------
    -- 4.4 EDUCACION_MEDICA_RUTAS · 'Rutas - Descentralizado'
    --     Creada -> Firma GV Desc. -> Revisión CA -> Autorización DC -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfRutDesc INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Rutas - Descentralizado', 'Autorización de la versión de rutas Descentralizadas: firma GV Descentralizado, revisión de costos del Coordinador Administrativo y cierre o rechazo de Dirección Corporativa.', 'EDUCACION_MEDICA_RUTAS', 1, 1, GETDATE());
    SET @wfRutDesc = SCOPE_IDENTITY();
    PRINT 'Workflow [Rutas - Descentralizado] creado (id ' + CAST(@wfRutDesc AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfRutDesc,  0, 'Creada',                                       @eCreada,           'Propuesta generada; editable solo en este paso.',                                       1, 0, 0, 0, 0, 1, 1),
        (@wfRutDesc, 10, 'Firma Gerente de Ventas - Descentralizado',    @eRevision,         'Firma del Gerente de Ventas Descentralizado (concentra y firma, IDT-003 5.2.3).',      0, 0, 1, 0, 0, 1, 1),
        (@wfRutDesc, 20, 'Revisión Coordinador Administrativo',          @ePreparacion,      'Revisa costos y firma la matriz (IDT-004 5.2).',                                        0, 0, 1, 0, 0, 1, 1),
        (@wfRutDesc, 30, 'Autorización Dirección Corporativa',           @eRevisionDirector, 'Dirección Corporativa cierra (rutas confirmadas) o rechaza (IDT-004 5.2).',            0, 0, 1, 0, 0, 1, 1),
        (@wfRutDesc, 40, 'Cerrada',                                      @eCerrada,          'Rutas confirmadas; se publican las asignaciones a los ejecutivos.',                     0, 1, 0, 0, 0, 1, 1),
        (@wfRutDesc, 50, 'Rechazada',                                    @eRechazada,        'Versión rechazada en alguna firma.',                                                    0, 1, 0, 0, 0, 1, 1),
        (@wfRutDesc, 60, 'Cancelada',                                    @eCancelada,        'Versión cancelada; habilita regenerar (solo el creador puede cancelar).',               0, 1, 0, 0, 0, 1, 1);

    DECLARE @rdCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 0);
    DECLARE @rdGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 10);
    DECLARE @rdCa     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 20);
    DECLARE @rdDc     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 30);
    DECLARE @rdFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 40);
    DECLARE @rdRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 50);
    DECLARE @rdCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 60);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@rdCreada, @rdGv,    @rutEnviar,    1),
        (@rdCreada, @rdCan,   @rutCancelar,  1),
        (@rdGv,     @rdCa,    @rutAutorizar, 1),
        (@rdGv,     @rdCreada,@rutDevolver,  1),
        (@rdGv,     @rdRech,  @rutRechazar,  1),
        (@rdGv,     @rdCan,   @rutCancelar,  1),
        (@rdCa,     @rdDc,    @rutAutorizar, 1),
        (@rdCa,     @rdCreada,@rutDevolver,  1),
        (@rdCa,     @rdRech,  @rutRechazar,  1),
        (@rdCa,     @rdCan,   @rutCancelar,  1),
        (@rdDc,     @rdFin,   @rutCerrar,    1),
        (@rdDc,     @rdCreada,@rutDevolver,  1),
        (@rdDc,     @rdRech,  @rutRechazar,  1);

    -----------------------------------------------------------------------------
    -- 4.5 EDUCACION_MEDICA_MATRIZ · 'Matriz de talleres - IMSS'
    --     Creada -> Firma GV IMSS -> Costos AEM -> Revisión CA -> Autorización DC -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfMatImss INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Matriz de talleres - IMSS', 'Autorización de la matriz de talleres de IMSS: firma del Gerente de Ventas IMSS, costos del AEM, revisión del CA y cierre o rechazo de DC.', 'EDUCACION_MEDICA_MATRIZ', 1, 1, GETDATE());
    SET @wfMatImss = SCOPE_IDENTITY();
    PRINT 'Workflow [Matriz de talleres - IMSS] creado (id ' + CAST(@wfMatImss AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfMatImss,  0, 'Creada',                           @eCreada,           'Los equipos de pareo capturan talleres; la matriz es editable solo en este paso.',  1, 0, 0, 0, 0, 1, 1),
        (@wfMatImss, 10, 'Firma Gerente de Ventas - IMSS',   @eRevision,         'El Gerente de Ventas IMSS revisa la concentración por equipo y firma la matriz (IDT-003 5.2.3).', 0, 0, 1, 0, 0, 1, 1),
        (@wfMatImss, 20, 'Registro de costos - AEM',         @ePreparacion,      'El Auxiliar Administrativo de Educación Médica registra los costos (muestras, folletos, envío, box lunch) y envía (IDT-004 5.1).', 0, 0, 0, 0, 0, 1, 1),
        (@wfMatImss, 30, 'Revisión de costos - CA',          @eRevision,         'El Coordinador Administrativo revisa los costos contra políticas y firma (IDT-004 5.2).', 0, 0, 1, 0, 0, 1, 1),
        (@wfMatImss, 40, 'Autorización - DC',                @eRevisionDirector, 'Dirección Corporativa cierra (matriz autorizada) o rechaza (IDT-004 5.2).',          0, 0, 1, 0, 0, 1, 1),
        (@wfMatImss, 50, 'Cerrada',                          @eCerrada,          'Matriz completa y autorizada; los talleres pasan a Autorizado.',                    0, 1, 0, 0, 0, 1, 1),
        (@wfMatImss, 60, 'Rechazada',                        @eRechazada,        'Matriz rechazada en alguna firma.',                                                 0, 1, 0, 0, 0, 1, 1),
        (@wfMatImss, 70, 'Cancelada',                        @eCancelada,        'Matriz cancelada por el creador.',                                                  0, 1, 0, 0, 0, 1, 1);

    DECLARE @miCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 0);
    DECLARE @miGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 10);
    DECLARE @miAem    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 20);
    DECLARE @miCa     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 30);
    DECLARE @miDc     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 40);
    DECLARE @miFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 50);
    DECLARE @miRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 60);
    DECLARE @miCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 70);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@miCreada, @miGv,    @matEnviar,    1),
        (@miCreada, @miCan,   @matCancelar,  1),
        (@miGv,     @miAem,   @matAutorizar, 1),
        (@miGv,     @miCreada,@matDevolver,  1),
        (@miGv,     @miRech,  @matRechazar,  1),
        (@miGv,     @miCan,   @matCancelar,  1),
        (@miAem,    @miCa,    @matEnviar,    1),
        (@miAem,    @miCreada,@matDevolver,  1),
        (@miAem,    @miRech,  @matRechazar,  1),
        (@miAem,    @miCan,   @matCancelar,  1),
        (@miCa,     @miDc,    @matAutorizar, 1),
        (@miCa,     @miAem,   @matDevolver,  1),
        (@miCa,     @miRech,  @matRechazar,  1),
        (@miCa,     @miCan,   @matCancelar,  1),
        (@miDc,     @miFin,   @matCerrar,    1),
        (@miDc,     @miCa,    @matDevolver,  1),
        (@miDc,     @miRech,  @matRechazar,  1);

    -----------------------------------------------------------------------------
    -- 4.6 EDUCACION_MEDICA_MATRIZ · 'Matriz de talleres - Descentralizado'
    --     Creada -> Firma GV Desc. -> Costos AEM -> Revisión CA -> Autorización DC -> Cerrada / Rechazada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfMatDesc INT;
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES ('Matriz de talleres - Descentralizado', 'Autorización de la matriz de talleres Descentralizados: firma del Gerente de Ventas, costos del AEM, revisión del CA y cierre o rechazo de DC.', 'EDUCACION_MEDICA_MATRIZ', 1, 1, GETDATE());
    SET @wfMatDesc = SCOPE_IDENTITY();
    PRINT 'Workflow [Matriz de talleres - Descentralizado] creado (id ' + CAST(@wfMatDesc AS VARCHAR(10)) + ').';

    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
    VALUES
        (@wfMatDesc,  0, 'Creada',                                    @eCreada,           'Los equipos de pareo capturan talleres; la matriz es editable solo en este paso.',  1, 0, 0, 0, 0, 1, 1),
        (@wfMatDesc, 10, 'Firma Gerente de Ventas - Descentralizado', @eRevision,         'El Gerente de Ventas Descentralizado revisa la concentración por equipo y firma la matriz (IDT-003 5.2.3).', 0, 0, 1, 0, 0, 1, 1),
        (@wfMatDesc, 20, 'Registro de costos - AEM',                  @ePreparacion,      'El Auxiliar Administrativo de Educación Médica registra los costos (muestras, folletos, envío, box lunch) y envía (IDT-004 5.1).', 0, 0, 0, 0, 0, 1, 1),
        (@wfMatDesc, 30, 'Revisión de costos - CA',                   @eRevision,         'El Coordinador Administrativo revisa los costos contra políticas y firma (IDT-004 5.2).', 0, 0, 1, 0, 0, 1, 1),
        (@wfMatDesc, 40, 'Autorización - DC',                         @eRevisionDirector, 'Dirección Corporativa cierra (matriz autorizada) o rechaza (IDT-004 5.2).',          0, 0, 1, 0, 0, 1, 1),
        (@wfMatDesc, 50, 'Cerrada',                                   @eCerrada,          'Matriz completa y autorizada; los talleres pasan a Autorizado.',                    0, 1, 0, 0, 0, 1, 1),
        (@wfMatDesc, 60, 'Rechazada',                                 @eRechazada,        'Matriz rechazada en alguna firma.',                                                 0, 1, 0, 0, 0, 1, 1),
        (@wfMatDesc, 70, 'Cancelada',                                 @eCancelada,        'Matriz cancelada por el creador.',                                                  0, 1, 0, 0, 0, 1, 1);

    DECLARE @mdCreada INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 0);
    DECLARE @mdGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 10);
    DECLARE @mdAem    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 20);
    DECLARE @mdCa     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 30);
    DECLARE @mdDc     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 40);
    DECLARE @mdFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 50);
    DECLARE @mdRech   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 60);
    DECLARE @mdCan    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 70);

    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
    VALUES
        (@mdCreada, @mdGv,    @matEnviar,    1),
        (@mdCreada, @mdCan,   @matCancelar,  1),
        (@mdGv,     @mdAem,   @matAutorizar, 1),
        (@mdGv,     @mdCreada,@matDevolver,  1),
        (@mdGv,     @mdRech,  @matRechazar,  1),
        (@mdGv,     @mdCan,   @matCancelar,  1),
        (@mdAem,    @mdCa,    @matEnviar,    1),
        (@mdAem,    @mdCreada,@matDevolver,  1),
        (@mdAem,    @mdRech,  @matRechazar,  1),
        (@mdAem,    @mdCan,   @matCancelar,  1),
        (@mdCa,     @mdDc,    @matAutorizar, 1),
        (@mdCa,     @mdAem,   @matDevolver,  1),
        (@mdCa,     @mdRech,  @matRechazar,  1),
        (@mdCa,     @mdCan,   @matCancelar,  1),
        (@mdDc,     @mdFin,   @matCerrar,    1),
        (@mdDc,     @mdCa,    @matDevolver,  1),
        (@mdDc,     @mdRech,  @matRechazar,  1);

    -- =========================================================================
    -- 5. ESTADOS DE DOMINIO: nomenclatura nueva + backfill de entidades
    --    (se ejecuta DESPUÉS de recrear los workflows para poder re-vincular)
    -- =========================================================================

    -- 5.1 Relajar CHECKs vigentes (aún permiten los valores viejos)
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.selecciones_mensuales') AND name = 'CK_selecciones_mensuales_estado')
        ALTER TABLE educacion_medica.selecciones_mensuales DROP CONSTRAINT CK_selecciones_mensuales_estado;
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.rutas') AND name = 'CK_rutas_estado')
        ALTER TABLE educacion_medica.rutas DROP CONSTRAINT CK_rutas_estado;
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.rutas_versiones') AND name = 'CK_rutas_versiones_estado')
        ALTER TABLE educacion_medica.rutas_versiones DROP CONSTRAINT CK_rutas_versiones_estado;
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.talleres') AND name = 'CK_talleres_estado')
        ALTER TABLE educacion_medica.talleres DROP CONSTRAINT CK_talleres_estado;

    -- 5.2 Renombrar estados de dominio existentes a la nueva nomenclatura
    UPDATE educacion_medica.selecciones_mensuales SET estado = 'Creada'  WHERE estado = 'Borrador';
    UPDATE educacion_medica.selecciones_mensuales SET estado = 'Cerrada' WHERE estado = 'Autorizada';
    UPDATE educacion_medica.rutas             SET estado = 'Creada'  WHERE estado = 'Draft';
    UPDATE educacion_medica.rutas             SET estado = 'Cerrada' WHERE estado = 'Confirmada';
    UPDATE educacion_medica.rutas_versiones   SET estado = 'Creada'  WHERE estado = 'Draft';
    UPDATE educacion_medica.rutas_versiones   SET estado = 'Cerrada' WHERE estado = 'Confirmada';
    UPDATE educacion_medica.talleres          SET estado = 'Creada'  WHERE estado = 'Borrador';
    PRINT 'Estados de dominio renombrados (Borrador->Creada, Autorizada->Cerrada, Draft->Creada, Confirmada->Cerrada, talleres Borrador->Creada).';

    -- 5.3 CHECKs nuevos + defaults
    ALTER TABLE educacion_medica.selecciones_mensuales ADD CONSTRAINT CK_selecciones_mensuales_estado
        CHECK (estado IN ('Creada','EnRevision','Cerrada','Rechazada','Cancelada'));
    ALTER TABLE educacion_medica.rutas ADD CONSTRAINT CK_rutas_estado
        CHECK (estado IN ('Creada','Cerrada','Rechazada','Cancelada','Archivada'));
    ALTER TABLE educacion_medica.rutas_versiones ADD CONSTRAINT CK_rutas_versiones_estado
        CHECK (estado IN ('Creada','Cerrada','Rechazada','Cancelada','Archivada'));
    ALTER TABLE educacion_medica.talleres ADD CONSTRAINT CK_talleres_estado
        CHECK (estado IN ('Creada','Elaborado','Revisado','Autorizado','Programado','EnCurso','Realizado','Cancelado'));

    DECLARE @df sysname;
    SELECT @df = dc.name FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('educacion_medica.selecciones_mensuales') AND c.name = 'estado';
    IF @df IS NOT NULL EXEC('ALTER TABLE educacion_medica.selecciones_mensuales DROP CONSTRAINT [' + @df + ']');
    ALTER TABLE educacion_medica.selecciones_mensuales ADD CONSTRAINT DF_selecciones_mensuales_estado DEFAULT ('Creada') FOR estado;

    SELECT @df = dc.name FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('educacion_medica.rutas_versiones') AND c.name = 'estado';
    IF @df IS NOT NULL EXEC('ALTER TABLE educacion_medica.rutas_versiones DROP CONSTRAINT [' + @df + ']');
    ALTER TABLE educacion_medica.rutas_versiones ADD CONSTRAINT DF_rutas_versiones_estado DEFAULT ('Creada') FOR estado;

    SELECT @df = dc.name FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('educacion_medica.talleres') AND c.name = 'estado';
    IF @df IS NOT NULL EXEC('ALTER TABLE educacion_medica.talleres DROP CONSTRAINT [' + @df + ']');
    ALTER TABLE educacion_medica.talleres ADD CONSTRAINT DF_talleres_estado DEFAULT ('Creada') FOR estado;

    PRINT 'CHECKs y defaults de estado actualizados (selecciones, rutas, rutas_versiones, talleres).';

    -- 5.4 Backfill: re-vincular selecciones huérfanas al paso que corresponde a su estado
    UPDATE educacion_medica.selecciones_mensuales
    SET id_workflow = w.id_workflow,
        id_paso_actual = p.id_paso,
        id_estado = p.id_estado
    FROM educacion_medica.selecciones_mensuales s
    JOIN (VALUES
            (1, 'Selección mensual - IMSS'),
            (2, 'Selección mensual - Descentralizado')
         ) AS g(id_tipo_gerencia, nombre_workflow)
        ON g.id_tipo_gerencia = s.id_tipo_gerencia
    JOIN config.workflows w
        ON w.codigo_proceso = 'EDUCACION_MEDICA_SELECCION'
       AND w.nombre = g.nombre_workflow
    JOIN (VALUES
            ('Creada', 0),
            ('EnRevision', 10),
            ('Cerrada', 30),
            ('Rechazada', 40),
            ('Cancelada', 50)
         ) AS o(estado, orden)
        ON o.estado = s.estado
    JOIN config.workflow_pasos p
        ON p.id_workflow = w.id_workflow
       AND p.orden = o.orden
    WHERE NOT EXISTS (SELECT 1 FROM config.workflows w2 WHERE w2.id_workflow = s.id_workflow);
    PRINT 'Backfill de selecciones: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' fila(s) re-vinculada(s).';

    -- 5.5 Backfill: re-vincular versiones de rutas huérfanas
    UPDATE educacion_medica.rutas_versiones
    SET id_workflow = w.id_workflow,
        id_paso_actual = p.id_paso,
        id_estado = p.id_estado
    FROM educacion_medica.rutas_versiones v
    JOIN (VALUES
            (1, 'Rutas - IMSS'),
            (2, 'Rutas - Descentralizado')
         ) AS g(id_tipo_gerencia, nombre_workflow)
        ON g.id_tipo_gerencia = v.id_tipo_gerencia
    JOIN config.workflows w
        ON w.codigo_proceso = 'EDUCACION_MEDICA_RUTAS'
       AND w.nombre = g.nombre_workflow
    JOIN (VALUES
            ('Creada', 0),
            ('Cerrada', 40),
            ('Rechazada', 50),
            ('Cancelada', 60),
            ('Archivada', 40)
         ) AS o(estado, orden)
        ON o.estado = v.estado
    JOIN config.workflow_pasos p
        ON p.id_workflow = w.id_workflow
       AND p.orden = o.orden
    WHERE NOT EXISTS (SELECT 1 FROM config.workflows w2 WHERE w2.id_workflow = v.id_workflow);
    PRINT 'Backfill de rutas_versiones: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' fila(s) re-vinculada(s).';

    COMMIT TRANSACTION;
    PRINT '0018 completado: 6 flujos EM (selección, rutas, matriz) con patrón Creada + Cerrada/Rechazada/Cancelada.';

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
    --        Matriz:    Creada (0) y Firma GV (10) -> usuario GV de la gerencia;
    --                   Registro de costos - AEM (20) -> usuario AEM;
    --                   Revisión de costos - CA (30) -> usuario CA;
    --                   Autorización - DC (40) -> usuario DC
    -- =========================================================================
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0018: ' + ERROR_MESSAGE();
    THROW;
END CATCH
