-- =============================================================================
-- 0014 — Workflow de autorización: Selección mensual y Rutas (Educación Médica)
-- ADR: lefarma.docs/educacion-medica/decisiones/00006_workflow-seleccion-y-rutas.md
--
-- QUÉ HACE
--   1) Esquema (idempotente): tabla rutas_versiones + columnas de workflow en
--      selecciones_mensuales y rutas. Si ya lo aplicaste manualmente, esta
--      sección no hace nada.
--   2) Catálogo: crea el scope type TIPO_GERENCIA (requisito para crear los
--      mappings por gerencia desde el frontend).
--   3) Seed: CUATRO workflows lineales (sin condiciones), dos por fase, con
--      codigo_proceso base compartido (patrón de la casa) y nombre por variante:
--        EDUCACION_MEDICA_SELECCION
--            - 'Selección mensual - IMSS'           (Borrador -> GG -> GV IMSS -> Autorizada)
--            - 'Selección mensual - Descentralizado'(Borrador -> GG -> GV Desc. -> Autorizada)
--        EDUCACION_MEDICA_RUTAS
--            - 'Rutas - IMSS'                       (Draft -> GV IMSS -> CA -> DC -> Confirmada)
--            - 'Rutas - Descentralizado'            (Draft -> GV Desc. -> CA -> DC -> Confirmada)
--      Usa los estados EXISTENTES del catálogo (misma convención que OC):
--        CREADA            -> paso inicial (Borrador / Draft)
--        REVISION          -> pasos de firma (GG, GV)
--        PREPARACION       -> revisión de costos (Coordinador Administrativo)
--        REVISION_DIRECTOR -> autorización de Dirección Corporativa
--        APROBACION        -> paso final (Autorizada / Confirmada)
--        CANCELADA         -> versión cancelada (final)
--
-- QUÉ NO HACE (se configura en el FRONTEND, admin de workflows)
--   1) MAPPINGS por gerencia (scope TIPO_GERENCIA). El codigo_proceso se toma
--      del workflow, así que solo eliges:
--        EDUCACION_MEDICA_SELECCION + TIPO_GERENCIA = 1 -> 'Selección mensual - IMSS'
--        EDUCACION_MEDICA_SELECCION + TIPO_GERENCIA = 2 -> 'Selección mensual - Descentralizado'
--        EDUCACION_MEDICA_RUTAS     + TIPO_GERENCIA = 1 -> 'Rutas - IMSS'
--        EDUCACION_MEDICA_RUTAS     + TIPO_GERENCIA = 2 -> 'Rutas - Descentralizado'
--   2) Participantes por paso de firma:
--        Selección (ambos workflows): Firma Gerencia General -> usuario GG
--                     Firma GV (IMSS o Descentralizado) -> usuario de esa gerencia
--        Rutas (ambos workflows):     Firma GV / Revisión CA / Autorización DC
--
--   >>> ADVERTENCIA 1: mientras un paso de firma no tenga participantes, el motor
--   >>> permite ejecutar sus acciones a CUALQUIER usuario autenticado.
--   >>> ADVERTENCIA 2: los mappings son OBLIGATORIOS. Sin mapping, el resolver
--   >>> cae al fallback por código compartido y podría elegir la variante
--   >>> equivocada (p. ej. pedir la firma al GV que no corresponde).
--
--   Las selecciones existentes NO requieren backfill: el workflow se asigna al
--   ejecutar "enviar a revisión" (selección) y al generar la propuesta (rutas).
--
-- IDEMPOTENTE: todos los bloques tienen guardas. Aplicar en LefarmaDev y luego
-- en Lefarma (prod).
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1. ESQUEMA educacion_medica (idempotente — no hace nada si ya está)
    -- =========================================================================

    -- 1.1 rutas_versiones (la versión de rutas como entidad autorizable)
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'rutas_versiones')
    BEGIN
        CREATE TABLE educacion_medica.rutas_versiones
        (
            id_ruta_version         INT IDENTITY(1,1) NOT NULL,
            id_seleccion_mensual    INT NOT NULL,
            version                 INT NOT NULL,
            id_tipo_gerencia        INT NULL,           -- denormalizado de la selección
            estado                  VARCHAR(15) NOT NULL CONSTRAINT DF_rutas_versiones_estado DEFAULT 'Draft',
            fecha_confirmacion      DATETIME2 NULL,
            id_workflow             INT NULL,           -- FK lógica -> config.workflows
            id_paso_actual          INT NULL,           -- FK lógica -> config.workflow_pasos
            id_estado               INT NULL,           -- FK lógica -> config.workflow_estados
            fecha_creacion          DATETIME2 NOT NULL CONSTRAINT DF_rutas_versiones_fecha_creacion DEFAULT SYSUTCDATETIME(),
            fecha_modificacion      DATETIME2 NOT NULL CONSTRAINT DF_rutas_versiones_fecha_modificacion DEFAULT SYSUTCDATETIME(),
            id_usuario_creacion     INT NULL,
            id_usuario_modificacion INT NULL,
            CONSTRAINT PK_rutas_versiones PRIMARY KEY (id_ruta_version),
            CONSTRAINT FK_rutas_versiones_seleccion FOREIGN KEY (id_seleccion_mensual)
                REFERENCES educacion_medica.selecciones_mensuales (id_seleccion_mensual) ON DELETE CASCADE,
            CONSTRAINT UQ_rutas_versiones_seleccion_version UNIQUE (id_seleccion_mensual, version),
            CONSTRAINT CK_rutas_versiones_estado CHECK (estado IN ('Draft','Confirmada','Cancelada','Archivada')),
            CONSTRAINT CK_rutas_versiones_version CHECK (version > 0)
        );
        PRINT 'Tabla [educacion_medica].[rutas_versiones] creada.';
    END
    ELSE
    BEGIN
        PRINT 'Tabla [educacion_medica].[rutas_versiones] ya existe. Skip.';
    END

    -- 1.2 selecciones_mensuales: columnas de workflow
    IF COL_LENGTH('educacion_medica.selecciones_mensuales', 'id_workflow') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.selecciones_mensuales ADD id_workflow INT NULL;
        PRINT 'Columna [id_workflow] agregada a selecciones_mensuales.';
    END
    IF COL_LENGTH('educacion_medica.selecciones_mensuales', 'id_paso_actual') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.selecciones_mensuales ADD id_paso_actual INT NULL;
        PRINT 'Columna [id_paso_actual] agregada a selecciones_mensuales.';
    END
    IF COL_LENGTH('educacion_medica.selecciones_mensuales', 'id_estado') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.selecciones_mensuales ADD id_estado INT NULL;
        PRINT 'Columna [id_estado] agregada a selecciones_mensuales.';
    END

    -- 1.3 rutas: enlace a la versión
    IF COL_LENGTH('educacion_medica.rutas', 'id_ruta_version') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.rutas ADD id_ruta_version INT NULL;
        PRINT 'Columna [id_ruta_version] agregada a rutas.';
    END
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('educacion_medica.rutas') AND name = 'FK_rutas_ruta_version')
    BEGIN
        ALTER TABLE educacion_medica.rutas
            ADD CONSTRAINT FK_rutas_ruta_version FOREIGN KEY (id_ruta_version)
                REFERENCES educacion_medica.rutas_versiones (id_ruta_version);
        PRINT 'FK [FK_rutas_ruta_version] creada.';
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.rutas') AND name = 'IX_rutas_id_ruta_version')
    BEGIN
        CREATE INDEX IX_rutas_id_ruta_version ON educacion_medica.rutas (id_ruta_version);
        PRINT 'Indice [IX_rutas_id_ruta_version] creado.';
    END

    -- 1.4 MS_Description (tabla nueva)
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.rutas_versiones') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description',
            N'Version de rutas de una seleccion mensual: es la entidad autorizable del workflow (GV -> CA -> DC). Las filas de rutas apuntan aqui con id_ruta_version (ADR-00006).',
            'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_versiones';

    -- =========================================================================
    -- 2. CATÁLOGO DEL MOTOR
    -- =========================================================================

    -- 2.1 Estados EXISTENTES (misma convención que el workflow de Orden de Compra)
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

    -- 2.2 Scope type TIPO_GERENCIA (para crear los mappings por gerencia en el frontend)
    IF NOT EXISTS (SELECT 1 FROM config.workflow_scope_types WHERE codigo = 'TIPO_GERENCIA')
    BEGIN
        INSERT INTO config.workflow_scope_types (codigo, nombre, nivel_prioridad, descripcion, activo, fecha_creacion)
        VALUES ('TIPO_GERENCIA', 'Tipo de gerencia (Educación Médica)', 20,
                'Rutea EDUCACION_MEDICA_SELECCION y EDUCACION_MEDICA_RUTAS a su variante por gerencia (1 = IMSS, 2 = Descentralizado)', 1, GETDATE());
        PRINT 'Scope type [TIPO_GERENCIA] creado (usa este scope para los mappings en el frontend).';
    END
    ELSE
    BEGIN
        PRINT 'Scope type [TIPO_GERENCIA] ya existe. Skip.';
    END

    -- 2.3 Limpieza: el scope SUBPROCESO quedó OBSOLETO (versión previa de este script;
    --     el ruteo ahora es por TIPO_GERENCIA). Solo se elimina si ningún mapping lo usa.
    DELETE s
    FROM config.workflow_scope_types s
    WHERE s.codigo = 'SUBPROCESO'
      AND NOT EXISTS (SELECT 1 FROM config.workflow_mappings m WHERE m.id_scope_type = s.id_scope_type);
    IF @@ROWCOUNT > 0
        PRINT 'Scope type obsoleto [SUBPROCESO] eliminado (sin mappings que lo usen).';

    -- 2.4 Tipos de acción vigentes
    DECLARE @tipoAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR');
    DECLARE @tipoDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER');
    DECLARE @tipoCancelar  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'CANCELAR');
    DECLARE @tipoEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR');

    -- =========================================================================
    -- 3. WORKFLOWS (4 variantes lineales, sin condiciones)
    -- =========================================================================

    -----------------------------------------------------------------------------
    -- 3.1 EDUCACION_MEDICA_SELECCION · 'Selección mensual - IMSS'
    --     Borrador -> Firma GG -> Firma GV IMSS -> Autorizada
    -----------------------------------------------------------------------------
    DECLARE @wfSelImss INT = (SELECT TOP 1 id_workflow FROM config.workflows WHERE codigo_proceso = 'EDUCACION_MEDICA_SELECCION' AND nombre = 'Selección mensual - IMSS');
    IF @wfSelImss IS NULL
    BEGIN
        INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
        VALUES ('Selección mensual - IMSS', 'Selección mensual de hospitales de IMSS: firma Gerencia General y después el Gerente de Ventas IMSS.', 'EDUCACION_MEDICA_SELECCION', 1, 1, GETDATE());
        SET @wfSelImss = SCOPE_IDENTITY();
        PRINT 'Workflow [Selección mensual - IMSS] creado.';
    END

    IF NOT EXISTS (SELECT 1 FROM config.workflow_pasos WHERE id_workflow = @wfSelImss)
    BEGIN
        INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
        VALUES
            (@wfSelImss,  0, 'Borrador',                       @eCreada,   'Selección capturada; editable hasta enviarse a revisión.',                          1, 0, 0, 0, 0, 1, 1),
            (@wfSelImss, 10, 'Firma Gerencia General',         @eRevision, 'Gerencia General firma y solicita la firma del Gerente de Ventas (IDT-003 5.1.3).', 0, 0, 1, 0, 0, 1, 1),
            (@wfSelImss, 20, 'Firma Gerente de Ventas - IMSS', @eRevision, 'Firma del Gerente de Ventas de la gerencia IMSS.',                                  0, 0, 1, 0, 0, 1, 1),
            (@wfSelImss, 30, 'Autorizada',                     @eAprobacion, 'Selección autorizada; habilita la planificación de rutas.',                       0, 1, 0, 0, 0, 1, 1);
    END

    DECLARE @siInicio INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 0);
    DECLARE @siGg     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 10);
    DECLARE @siGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 20);
    DECLARE @siFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelImss AND orden = 30);

    IF NOT EXISTS (SELECT 1 FROM config.workflow_acciones a JOIN config.workflow_pasos p ON p.id_paso = a.id_paso_origen WHERE p.id_workflow = @wfSelImss)
    BEGIN
        INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
        VALUES
            (@siInicio, @siGg,     @tipoEnviar,    1),
            (@siGg,     @siGv,     @tipoAutorizar, 1),
            (@siGg,     @siInicio, @tipoDevolver,  1),
            (@siGv,     @siFin,    @tipoAutorizar, 1),
            (@siGv,     @siInicio, @tipoDevolver,  1);
    END

    -----------------------------------------------------------------------------
    -- 3.2 EDUCACION_MEDICA_SELECCION · 'Selección mensual - Descentralizado'
    --     Borrador -> Firma GG -> Firma GV Descentralizado -> Autorizada
    -----------------------------------------------------------------------------
    DECLARE @wfSelDesc INT = (SELECT TOP 1 id_workflow FROM config.workflows WHERE codigo_proceso = 'EDUCACION_MEDICA_SELECCION' AND nombre = 'Selección mensual - Descentralizado');
    IF @wfSelDesc IS NULL
    BEGIN
        INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
        VALUES ('Selección mensual - Descentralizado', 'Selección mensual de hospitales Descentralizados: firma Gerencia General y después el Gerente de Ventas Descentralizado.', 'EDUCACION_MEDICA_SELECCION', 1, 1, GETDATE());
        SET @wfSelDesc = SCOPE_IDENTITY();
        PRINT 'Workflow [Selección mensual - Descentralizado] creado.';
    END

    IF NOT EXISTS (SELECT 1 FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc)
    BEGIN
        INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
        VALUES
            (@wfSelDesc,  0, 'Borrador',                              @eCreada,   'Selección capturada; editable hasta enviarse a revisión.',                          1, 0, 0, 0, 0, 1, 1),
            (@wfSelDesc, 10, 'Firma Gerencia General',                @eRevision, 'Gerencia General firma y solicita la firma del Gerente de Ventas (IDT-003 5.1.3).', 0, 0, 1, 0, 0, 1, 1),
            (@wfSelDesc, 20, 'Firma Gerente de Ventas - Descentralizado', @eRevision, 'Firma del Gerente de Ventas de la gerencia Descentralizado.',                   0, 0, 1, 0, 0, 1, 1),
            (@wfSelDesc, 30, 'Autorizada',                            @eAprobacion, 'Selección autorizada; habilita la planificación de rutas.',                       0, 1, 0, 0, 0, 1, 1);
    END

    DECLARE @sdInicio INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 0);
    DECLARE @sdGg     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 10);
    DECLARE @sdGv     INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 20);
    DECLARE @sdFin    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfSelDesc AND orden = 30);

    IF NOT EXISTS (SELECT 1 FROM config.workflow_acciones a JOIN config.workflow_pasos p ON p.id_paso = a.id_paso_origen WHERE p.id_workflow = @wfSelDesc)
    BEGIN
        INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
        VALUES
            (@sdInicio, @sdGg,     @tipoEnviar,    1),
            (@sdGg,     @sdGv,     @tipoAutorizar, 1),
            (@sdGg,     @sdInicio, @tipoDevolver,  1),
            (@sdGv,     @sdFin,    @tipoAutorizar, 1),
            (@sdGv,     @sdInicio, @tipoDevolver,  1);
    END

    -----------------------------------------------------------------------------
    -- 3.3 EDUCACION_MEDICA_RUTAS · 'Rutas - IMSS'
    --     Draft -> Firma GV IMSS -> Revisión CA -> Autorización DC -> Confirmada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfRutImss INT = (SELECT TOP 1 id_workflow FROM config.workflows WHERE codigo_proceso = 'EDUCACION_MEDICA_RUTAS' AND nombre = 'Rutas - IMSS');
    IF @wfRutImss IS NULL
    BEGIN
        INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
        VALUES ('Rutas - IMSS', 'Autorización de la versión de rutas de IMSS: firma GV IMSS, revisión de costos del Coordinador Administrativo y autorización de Dirección Corporativa.', 'EDUCACION_MEDICA_RUTAS', 1, 1, GETDATE());
        SET @wfRutImss = SCOPE_IDENTITY();
        PRINT 'Workflow [Rutas - IMSS] creado.';
    END

    IF NOT EXISTS (SELECT 1 FROM config.workflow_pasos WHERE id_workflow = @wfRutImss)
    BEGIN
        INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
        VALUES
            (@wfRutImss,  0, 'Draft (en captura)',                 @eCreada,           'Propuesta generada; editable hasta enviarse a autorización.',                           1, 0, 0, 0, 0, 1, 1),
            (@wfRutImss, 10, 'Firma Gerente de Ventas - IMSS',     @eRevision,         'Firma del Gerente de Ventas IMSS (concentra y firma, IDT-003 5.2.3).',                  0, 0, 1, 0, 0, 1, 1),
            (@wfRutImss, 20, 'Revisión Coordinador Administrativo', @ePreparacion,     'Revisa costos y firma la matriz (IDT-004 5.2).',                                        0, 0, 1, 0, 0, 1, 1),
            (@wfRutImss, 30, 'Autorización Dirección Corporativa',  @eRevisionDirector, 'Autoriza la planeación (IDT-004 5.2).',                                                 0, 0, 1, 0, 0, 1, 1),
            (@wfRutImss, 40, 'Confirmada',                          @eAprobacion,       'Rutas confirmadas; se publican las asignaciones a los ejecutivos.',                     0, 1, 0, 0, 0, 1, 1),
            (@wfRutImss, 50, 'Cancelada',                           @eCancelada,        'Versión cancelada; habilita regenerar (solo el creador puede cancelar).',               0, 1, 0, 0, 0, 1, 1);
    END

    DECLARE @riDraft INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 0);
    DECLARE @riGv    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 10);
    DECLARE @riCa    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 20);
    DECLARE @riDc    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 30);
    DECLARE @riFin   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 40);
    DECLARE @riCan   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutImss AND orden = 50);

    IF NOT EXISTS (SELECT 1 FROM config.workflow_acciones a JOIN config.workflow_pasos p ON p.id_paso = a.id_paso_origen WHERE p.id_workflow = @wfRutImss)
    BEGIN
        INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
        VALUES
            (@riDraft, @riGv,  @tipoEnviar,    1),
            (@riGv,    @riCa,  @tipoAutorizar, 1),
            (@riCa,    @riDc,  @tipoAutorizar, 1),
            (@riDc,    @riFin, @tipoAutorizar, 1),
            (@riGv,    @riDraft, @tipoDevolver, 1),
            (@riCa,    @riDraft, @tipoDevolver, 1),
            (@riDc,    @riDraft, @tipoDevolver, 1),
            (@riDraft, @riCan, @tipoCancelar,  1),
            (@riGv,    @riCan, @tipoCancelar,  1),
            (@riCa,    @riCan, @tipoCancelar,  1),
            (@riDc,    @riCan, @tipoCancelar,  1);
    END

    -----------------------------------------------------------------------------
    -- 3.4 EDUCACION_MEDICA_RUTAS · 'Rutas - Descentralizado'
    --     Draft -> Firma GV Desc. -> Revisión CA -> Autorización DC -> Confirmada / Cancelada
    -----------------------------------------------------------------------------
    DECLARE @wfRutDesc INT = (SELECT TOP 1 id_workflow FROM config.workflows WHERE codigo_proceso = 'EDUCACION_MEDICA_RUTAS' AND nombre = 'Rutas - Descentralizado');
    IF @wfRutDesc IS NULL
    BEGIN
        INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
        VALUES ('Rutas - Descentralizado', 'Autorización de la versión de rutas Descentralizadas: firma GV Descentralizado, revisión de costos del Coordinador Administrativo y autorización de Dirección Corporativa.', 'EDUCACION_MEDICA_RUTAS', 1, 1, GETDATE());
        SET @wfRutDesc = SCOPE_IDENTITY();
        PRINT 'Workflow [Rutas - Descentralizado] creado.';
    END

    IF NOT EXISTS (SELECT 1 FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc)
    BEGIN
        INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
        VALUES
            (@wfRutDesc,  0, 'Draft (en captura)',                    @eCreada,           'Propuesta generada; editable hasta enviarse a autorización.',                           1, 0, 0, 0, 0, 1, 1),
            (@wfRutDesc, 10, 'Firma Gerente de Ventas - Descentralizado', @eRevision,     'Firma del Gerente de Ventas Descentralizado (concentra y firma, IDT-003 5.2.3).',      0, 0, 1, 0, 0, 1, 1),
            (@wfRutDesc, 20, 'Revisión Coordinador Administrativo',   @ePreparacion,      'Revisa costos y firma la matriz (IDT-004 5.2).',                                        0, 0, 1, 0, 0, 1, 1),
            (@wfRutDesc, 30, 'Autorización Dirección Corporativa',    @eRevisionDirector, 'Autoriza la planeación (IDT-004 5.2).',                                                 0, 0, 1, 0, 0, 1, 1),
            (@wfRutDesc, 40, 'Confirmada',                            @eAprobacion,       'Rutas confirmadas; se publican las asignaciones a los ejecutivos.',                     0, 1, 0, 0, 0, 1, 1),
            (@wfRutDesc, 50, 'Cancelada',                             @eCancelada,        'Versión cancelada; habilita regenerar (solo el creador puede cancelar).',               0, 1, 0, 0, 0, 1, 1);
    END

    DECLARE @rdDraft INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 0);
    DECLARE @rdGv    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 10);
    DECLARE @rdCa    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 20);
    DECLARE @rdDc    INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 30);
    DECLARE @rdFin   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 40);
    DECLARE @rdCan   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfRutDesc AND orden = 50);

    IF NOT EXISTS (SELECT 1 FROM config.workflow_acciones a JOIN config.workflow_pasos p ON p.id_paso = a.id_paso_origen WHERE p.id_workflow = @wfRutDesc)
    BEGIN
        INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
        VALUES
            (@rdDraft, @rdGv,  @tipoEnviar,    1),
            (@rdGv,    @rdCa,  @tipoAutorizar, 1),
            (@rdCa,    @rdDc,  @tipoAutorizar, 1),
            (@rdDc,    @rdFin, @tipoAutorizar, 1),
            (@rdGv,    @rdDraft, @tipoDevolver, 1),
            (@rdCa,    @rdDraft, @tipoDevolver, 1),
            (@rdDc,    @rdDraft, @tipoDevolver, 1),
            (@rdDraft, @rdCan, @tipoCancelar,  1),
            (@rdGv,    @rdCan, @tipoCancelar,  1),
            (@rdCa,    @rdCan, @tipoCancelar,  1),
            (@rdDc,    @rdCan, @tipoCancelar,  1);
    END

    COMMIT TRANSACTION;
    PRINT '0014 completado.';

    -- =========================================================================
    -- VERIFICACIÓN (ejecutar aparte) y PASOS MANUALES EN EL FRONTEND
    -- =========================================================================
    -- SELECT id_workflow, nombre, codigo_proceso FROM config.workflows WHERE codigo_proceso LIKE 'EDUCACION_MEDICA%';
    -- SELECT p.id_workflow, p.orden, p.nombre_paso, e.codigo AS estado, p.es_inicio, p.es_final
    --   FROM config.workflow_pasos p LEFT JOIN config.workflow_estados e ON e.id_estado = p.id_estado
    --   WHERE p.id_workflow IN (SELECT id_workflow FROM config.workflows WHERE codigo_proceso LIKE 'EDUCACION_MEDICA%')
    --   ORDER BY p.id_workflow, p.orden;
    -- SELECT a.id_accion, a.id_paso_origen, a.id_paso_destino, ta.codigo AS tipo
    --   FROM config.workflow_acciones a LEFT JOIN config.workflow_tipos_accion ta ON ta.id_tipo_accion = a.id_tipo_accion
    --   WHERE a.id_paso_origen IN (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow IN (SELECT id_workflow FROM config.workflows WHERE codigo_proceso LIKE 'EDUCACION_MEDICA%'));
    --
    -- FRONTEND (admin de workflows), después de aplicar:
    --   1) MAPPINGS (scope "Tipo de gerencia (Educación Médica)"):
    --        EDUCACION_MEDICA_SELECCION + 1 -> 'Selección mensual - IMSS'
    --        EDUCACION_MEDICA_SELECCION + 2 -> 'Selección mensual - Descentralizado'
    --        EDUCACION_MEDICA_RUTAS     + 1 -> 'Rutas - IMSS'
    --        EDUCACION_MEDICA_RUTAS     + 2 -> 'Rutas - Descentralizado'
    --      (Sin estos mappings el resolver NO puede distinguir la variante; crearlos
    --       antes de usar el flujo.)
    --   2) PARTICIPANTES (por paso):
    --        'Selección mensual - IMSS':           Firma GG -> usuario GG;  Firma GV IMSS -> usuario GV IMSS
    --        'Selección mensual - Descentralizado': Firma GG -> usuario GG;  Firma GV Desc. -> usuario GV Desc.
    --        'Rutas - IMSS':           Firma GV IMSS -> usuario GV IMSS;  Revisión CA -> usuario CA;  Autorización DC -> usuario DC
    --        'Rutas - Descentralizado': Firma GV Desc. -> usuario GV Desc.;  Revisión CA -> usuario CA;  Autorización DC -> usuario DC
    -- =========================================================================
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0014: ' + ERROR_MESSAGE();
    THROW;
END CATCH
