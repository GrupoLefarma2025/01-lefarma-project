-- =============================================================================
-- 0015 — Módulo Matriz de Talleres (Educación Médica)
-- ADR: lefarma.docs/educacion-medica/decisiones/00007_modulo-matriz-talleres.md
--
-- QUÉ HACE
--   1) Tipos de acción EM por proceso (cambio de plataforma: workflow_tipos_accion
--      ahora es único por codigo + codigo_proceso): siembra AUTORIZAR, ENVIAR,
--      DEVOLVER y CANCELAR para EDUCACION_MEDICA_SELECCION, EDUCACION_MEDICA_RUTAS
--      y EDUCACION_MEDICA_MATRIZ (guardas por codigo + codigo_proceso).
--   2) Remapeo idempotente: las acciones de workflows EDUCACION_MEDICA% cuyo tipo
--      no pertenezca a su proceso se actualizan al tipo correcto por código
--      (corrige lo sembrado por 0014 sin tocar ese script).
--   3) Esquema (idempotente):
--        - educacion_medica.matrices_individuales (equipo de pareo + mes)
--        - educacion_medica.matrices_generales   (gerencia + mes; entidad del
--          workflow: id_workflow/id_paso_actual/id_estado, SIN estado propio)
--        - ALTER talleres: id_matriz_individual e id_matriz_general
--          (FKs ON DELETE NO ACTION + índices). No se toca la columna estado.
--   4) Seed: DOS workflows lineales EDUCACION_MEDICA_MATRIZ (sin condiciones):
--        'Matriz de talleres - IMSS'            (Concentración -> GV IMSS -> costos AEM -> CA -> DC -> Autorizada)
--        'Matriz de talleres - Descentralizado' (Concentración -> GV Desc. -> costos AEM -> CA -> DC -> Autorizada)
--      Usa los estados EXISTENTES del catálogo (misma convención que OC y 0014):
--        CREADA            -> paso inicial (Concentración; editable aquí)
--        REVISION          -> pasos de firma (Gerente de Ventas, Coordinador Administrativo)
--        PREPARACION       -> registro de costos (Auxiliar Administrativo de Educación Médica)
--        REVISION_DIRECTOR -> autorización de Dirección Corporativa
--        APROBACION        -> paso final (Autorizada)
--
-- QUÉ NO HACE (se configura en el FRONTEND, admin de workflows)
--   1) MAPPINGS por gerencia (scope TIPO_GERENCIA, ya creado en 0014):
--        EDUCACION_MEDICA_MATRIZ + TIPO_GERENCIA = 1 -> 'Matriz de talleres - IMSS'
--        EDUCACION_MEDICA_MATRIZ + TIPO_GERENCIA = 2 -> 'Matriz de talleres - Descentralizado'
--   2) Participantes por paso:
--        Concentración (0) y Firma GV (10)      -> usuario GV de la gerencia
--        Registro de costos - AEM (20)          -> usuario AEM
--        Revisión de costos - CA (30)           -> usuario CA
--        Autorización - DC (40)                 -> usuario DC
--
--   >>> ADVERTENCIA 1: mientras un paso no tenga participantes, el motor permite
--   >>> ejecutar sus acciones a CUALQUIER usuario autenticado.
--   >>> ADVERTENCIA 2: los mappings son OBLIGATORIOS. Sin mapping, el resolver
--   >>> cae al fallback por código compartido y podría elegir la variante
--   >>> equivocada (p. ej. pedir la firma al GV que no corresponde).
--
--   Sin backfill: las tablas de talleres están vacías en operación.
--
-- IDEMPOTENTE: todos los bloques tienen guardas. Aplicar en LefarmaDev y luego
-- en Lefarma (prod).
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

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
    -- 2. REMAPEO IDEMPOTENTE de acciones de workflows EDUCACION_MEDICA%
    --    (el tipo de cada acción debe pertenecer al proceso de su workflow)
    -- =========================================================================

    UPDATE a
    SET a.id_tipo_accion = correcto.id_tipo_accion
    FROM config.workflow_acciones a
    JOIN config.workflow_pasos p        ON p.id_paso = a.id_paso_origen
    JOIN config.workflows w             ON w.id_workflow = p.id_workflow
    JOIN config.workflow_tipos_accion actual   ON actual.id_tipo_accion = a.id_tipo_accion
    JOIN config.workflow_tipos_accion correcto ON correcto.codigo = actual.codigo
                                              AND correcto.codigo_proceso = w.codigo_proceso
    WHERE w.codigo_proceso LIKE 'EDUCACION_MEDICA%'
      AND (actual.codigo_proceso IS NULL OR actual.codigo_proceso <> w.codigo_proceso);
    IF @@ROWCOUNT > 0
        PRINT 'Acciones de workflows EDUCACION_MEDICA% remapeadas al tipo de su proceso.';
    ELSE
        PRINT 'Remapeo de acciones EM: nada que corregir.';

    -- =========================================================================
    -- 3. ESQUEMA educacion_medica (idempotente)
    -- =========================================================================

    -- 3.1 matrices_individuales (matriz por equipo de pareo + mes)
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

    -- 3.2 matrices_generales (matriz por gerencia + mes; entidad del workflow)
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

    -- 3.3 talleres: enlaces a las matrices
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

    -- 3.4 MS_Description (tablas nuevas y columnas nuevas)
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

    -- =========================================================================
    -- 4. WORKFLOWS EDUCACION_MEDICA_MATRIZ (2 variantes lineales)
    -- =========================================================================

    -- 4.1 Estados EXISTENTES del catálogo
    DECLARE @eCreada INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'CREADA');
    DECLARE @eRevision INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'REVISION');
    DECLARE @ePreparacion INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'PREPARACION');
    DECLARE @eRevisionDirector INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'REVISION_DIRECTOR');
    DECLARE @eAprobacion INT = (SELECT id_estado FROM config.workflow_estados WHERE codigo = 'APROBACION');

    IF @eCreada IS NULL OR @eRevision IS NULL OR @ePreparacion IS NULL
       OR @eRevisionDirector IS NULL OR @eAprobacion IS NULL
    BEGIN
        RAISERROR('Faltan estados en config.workflow_estados (se esperan CREADA, REVISION, PREPARACION, REVISION_DIRECTOR, APROBACION).', 16, 1);
    END

    -- 4.2 Tipos de acción del proceso EDUCACION_MEDICA_MATRIZ (sembrados en la sección 1)
    DECLARE @tipoAutorizar INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'AUTORIZAR' AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @tipoDevolver  INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'DEVOLVER'  AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');
    DECLARE @tipoEnviar    INT = (SELECT id_tipo_accion FROM config.workflow_tipos_accion WHERE codigo = 'ENVIAR'    AND codigo_proceso = 'EDUCACION_MEDICA_MATRIZ');

    IF @tipoAutorizar IS NULL OR @tipoDevolver IS NULL OR @tipoEnviar IS NULL
    BEGIN
        RAISERROR('Faltan tipos de acción para EDUCACION_MEDICA_MATRIZ en config.workflow_tipos_accion.', 16, 1);
    END

    -----------------------------------------------------------------------------
    -- 4.3 'Matriz de talleres - IMSS'
    --     Concentración -> Firma GV IMSS -> Costos AEM -> Revisión CA -> Autorización DC -> Autorizada
    -----------------------------------------------------------------------------
    DECLARE @wfMatImss INT = (SELECT TOP 1 id_workflow FROM config.workflows WHERE codigo_proceso = 'EDUCACION_MEDICA_MATRIZ' AND nombre = 'Matriz de talleres - IMSS');
    IF @wfMatImss IS NULL
    BEGIN
        INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
        VALUES ('Matriz de talleres - IMSS', 'Autorización de la matriz general de talleres de IMSS: firma del Gerente de Ventas IMSS, registro de costos del Auxiliar Administrativo de Educación Médica, revisión del Coordinador Administrativo y autorización de Dirección Corporativa.', 'EDUCACION_MEDICA_MATRIZ', 1, 1, GETDATE());
        SET @wfMatImss = SCOPE_IDENTITY();
        PRINT 'Workflow [Matriz de talleres - IMSS] creado.';
    END

    IF NOT EXISTS (SELECT 1 FROM config.workflow_pasos WHERE id_workflow = @wfMatImss)
    BEGIN
        INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
        VALUES
            (@wfMatImss,  0, 'Concentración',                    @eCreada,           'Los equipos de pareo capturan talleres; la matriz es editable solo en este paso.',  1, 0, 0, 0, 0, 1, 1),
            (@wfMatImss, 10, 'Firma Gerente de Ventas - IMSS',   @eRevision,         'El Gerente de Ventas IMSS revisa la concentración por equipo y firma la matriz (IDT-003 5.2.3).', 0, 0, 1, 0, 0, 1, 1),
            (@wfMatImss, 20, 'Registro de costos - AEM',         @ePreparacion,      'El Auxiliar Administrativo de Educación Médica registra los costos (muestras, folletos, envío, box lunch) y envía (IDT-004 5.1).', 0, 0, 0, 0, 0, 1, 1),
            (@wfMatImss, 30, 'Revisión de costos - CA',          @eRevision,         'El Coordinador Administrativo revisa los costos contra políticas y firma (IDT-004 5.2).', 0, 0, 1, 0, 0, 1, 1),
            (@wfMatImss, 40, 'Autorización - DC',                @eRevisionDirector, 'Dirección Corporativa autoriza la matriz (IDT-004 5.2).',                          0, 0, 1, 0, 0, 1, 1),
            (@wfMatImss, 50, 'Autorizada',                       @eAprobacion,       'Matriz autorizada; los talleres pasan a Autorizado.',                              0, 1, 0, 0, 0, 1, 1);
    END

    DECLARE @miConc INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 0);
    DECLARE @miGv   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 10);
    DECLARE @miAem  INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 20);
    DECLARE @miCa   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 30);
    DECLARE @miDc   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 40);
    DECLARE @miFin  INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatImss AND orden = 50);

    IF NOT EXISTS (SELECT 1 FROM config.workflow_acciones a JOIN config.workflow_pasos p ON p.id_paso = a.id_paso_origen WHERE p.id_workflow = @wfMatImss)
    BEGIN
        INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
        VALUES
            (@miConc, @miGv,   @tipoEnviar,    1),
            (@miGv,   @miAem,  @tipoAutorizar, 1),
            (@miGv,   @miConc, @tipoDevolver,  1),
            (@miAem,  @miCa,   @tipoEnviar,    1),
            (@miAem,  @miConc, @tipoDevolver,  1),
            (@miCa,   @miDc,   @tipoAutorizar, 1),
            (@miCa,   @miAem,  @tipoDevolver,  1),
            (@miDc,   @miFin,  @tipoAutorizar, 1),
            (@miDc,   @miCa,   @tipoDevolver,  1);
    END

    -----------------------------------------------------------------------------
    -- 4.4 'Matriz de talleres - Descentralizado'
    --     Concentración -> Firma GV Desc. -> Costos AEM -> Revisión CA -> Autorización DC -> Autorizada
    -----------------------------------------------------------------------------
    DECLARE @wfMatDesc INT = (SELECT TOP 1 id_workflow FROM config.workflows WHERE codigo_proceso = 'EDUCACION_MEDICA_MATRIZ' AND nombre = 'Matriz de talleres - Descentralizado');
    IF @wfMatDesc IS NULL
    BEGIN
        INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
        VALUES ('Matriz de talleres - Descentralizado', 'Autorización de la matriz general de talleres Descentralizados: firma del Gerente de Ventas Descentralizado, registro de costos del Auxiliar Administrativo de Educación Médica, revisión del Coordinador Administrativo y autorización de Dirección Corporativa.', 'EDUCACION_MEDICA_MATRIZ', 1, 1, GETDATE());
        SET @wfMatDesc = SCOPE_IDENTITY();
        PRINT 'Workflow [Matriz de talleres - Descentralizado] creado.';
    END

    IF NOT EXISTS (SELECT 1 FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc)
    BEGIN
        INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, permite_adjunto, activo)
        VALUES
            (@wfMatDesc,  0, 'Concentración',                            @eCreada,           'Los equipos de pareo capturan talleres; la matriz es editable solo en este paso.',  1, 0, 0, 0, 0, 1, 1),
            (@wfMatDesc, 10, 'Firma Gerente de Ventas - Descentralizado', @eRevision,        'El Gerente de Ventas Descentralizado revisa la concentración por equipo y firma la matriz (IDT-003 5.2.3).', 0, 0, 1, 0, 0, 1, 1),
            (@wfMatDesc, 20, 'Registro de costos - AEM',                 @ePreparacion,      'El Auxiliar Administrativo de Educación Médica registra los costos (muestras, folletos, envío, box lunch) y envía (IDT-004 5.1).', 0, 0, 0, 0, 0, 1, 1),
            (@wfMatDesc, 30, 'Revisión de costos - CA',                  @eRevision,         'El Coordinador Administrativo revisa los costos contra políticas y firma (IDT-004 5.2).', 0, 0, 1, 0, 0, 1, 1),
            (@wfMatDesc, 40, 'Autorización - DC',                        @eRevisionDirector, 'Dirección Corporativa autoriza la matriz (IDT-004 5.2).',                          0, 0, 1, 0, 0, 1, 1),
            (@wfMatDesc, 50, 'Autorizada',                               @eAprobacion,       'Matriz autorizada; los talleres pasan a Autorizado.',                              0, 1, 0, 0, 0, 1, 1);
    END

    DECLARE @mdConc INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 0);
    DECLARE @mdGv   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 10);
    DECLARE @mdAem  INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 20);
    DECLARE @mdCa   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 30);
    DECLARE @mdDc   INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 40);
    DECLARE @mdFin  INT = (SELECT id_paso FROM config.workflow_pasos WHERE id_workflow = @wfMatDesc AND orden = 50);

    IF NOT EXISTS (SELECT 1 FROM config.workflow_acciones a JOIN config.workflow_pasos p ON p.id_paso = a.id_paso_origen WHERE p.id_workflow = @wfMatDesc)
    BEGIN
        INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, activo)
        VALUES
            (@mdConc, @mdGv,   @tipoEnviar,    1),
            (@mdGv,   @mdAem,  @tipoAutorizar, 1),
            (@mdGv,   @mdConc, @tipoDevolver,  1),
            (@mdAem,  @mdCa,   @tipoEnviar,    1),
            (@mdAem,  @mdConc, @tipoDevolver,  1),
            (@mdCa,   @mdDc,   @tipoAutorizar, 1),
            (@mdCa,   @mdAem,  @tipoDevolver,  1),
            (@mdDc,   @mdFin,  @tipoAutorizar, 1),
            (@mdDc,   @mdCa,   @tipoDevolver,  1);
    END

    COMMIT TRANSACTION;
    PRINT '0015 completado.';

    -- =========================================================================
    -- VERIFICACIÓN (ejecutar aparte) y PASOS MANUALES EN EL FRONTEND
    -- =========================================================================
    -- SELECT id_tipo_accion, codigo, codigo_proceso FROM config.workflow_tipos_accion
    --   WHERE codigo_proceso LIKE 'EDUCACION_MEDICA%' ORDER BY codigo_proceso, codigo;
    -- SELECT id_workflow, nombre, codigo_proceso FROM config.workflows WHERE codigo_proceso = 'EDUCACION_MEDICA_MATRIZ';
    -- SELECT p.id_workflow, p.orden, p.nombre_paso, e.codigo AS estado, p.es_inicio, p.es_final, p.requiere_firma
    --   FROM config.workflow_pasos p LEFT JOIN config.workflow_estados e ON e.id_estado = p.id_estado
    --   WHERE p.id_workflow IN (SELECT id_workflow FROM config.workflows WHERE codigo_proceso = 'EDUCACION_MEDICA_MATRIZ')
    --   ORDER BY p.id_workflow, p.orden;
    -- SELECT po.orden AS origen, pd.orden AS destino, ta.codigo AS tipo, ta.codigo_proceso
    --   FROM config.workflow_acciones a
    --   JOIN config.workflow_pasos po ON po.id_paso = a.id_paso_origen
    --   JOIN config.workflow_pasos pd ON pd.id_paso = a.id_paso_destino
    --   LEFT JOIN config.workflow_tipos_accion ta ON ta.id_tipo_accion = a.id_tipo_accion
    --   WHERE po.id_workflow IN (SELECT id_workflow FROM config.workflows WHERE codigo_proceso = 'EDUCACION_MEDICA_MATRIZ')
    --   ORDER BY po.id_workflow, po.orden, pd.orden;
    --
    -- FRONTEND (admin de workflows), después de aplicar:
    --   1) MAPPINGS (scope "Tipo de gerencia (Educación Médica)"):
    --        EDUCACION_MEDICA_MATRIZ + 1 -> 'Matriz de talleres - IMSS'
    --        EDUCACION_MEDICA_MATRIZ + 2 -> 'Matriz de talleres - Descentralizado'
    --      (Sin estos mappings el resolver NO puede distinguir la variante; crearlos
    --       antes de usar el flujo.)
    --   2) PARTICIPANTES (por paso, en ambos workflows de matriz):
    --        Concentración (0) y Firma GV (10) -> usuario GV de la gerencia
    --        Registro de costos - AEM (20)     -> usuario AEM
    --        Revisión de costos - CA (30)      -> usuario CA
    --        Autorización - DC (40)            -> usuario DC
    -- =========================================================================
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0015: ' + ERROR_MESSAGE();
    THROW;
END CATCH
