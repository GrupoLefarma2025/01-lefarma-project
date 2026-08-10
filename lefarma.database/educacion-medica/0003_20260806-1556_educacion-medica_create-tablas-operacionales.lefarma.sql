-- ============================================================
-- 0003_20260806-1556_educacion-medica_create-tablas-operacionales.lefarma.sql
-- Descripcion: Crea las 11 tablas operacionales del modulo
--              Educacion Medica en el schema educacion_medica.
--              Proceso: Talleres Medicos en Hospitales (ASK-CEM-DDP-001),
--              formularios FOR-002..FOR-008.
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (toda la familia lefarma).
-- Schema requerido: educacion_medica (se crea si no existe, por robustez).
-- Convenciones del repo: snake_case, id_<tabla> IDENTITY PK, activo,
--   fecha_creacion/fecha_modificacion SYSUTCDATETIME(), guardas idempotentes
--   vía sys.tables. Se respeta la decision en la propuesta §4.4: `activo`
--   únicamente en las tablas "madre" (agregados y catalogos); las hijas no
--   hacen soft-delete.
-- NOTA cross-DB: genContactosCat (hospitales), genProductosCat (productos) y
--   app.Usuarios viven en Asokam (db distinta). SQL Server no soporta FKs
--   físicas cross-DB, por lo que hospitales/productos/usuarios son SOLO campos
--   de código (INT/VARCHAR) y su existencia se valida en el servicio.
-- ============================================================
-- Convencion de documentacion (extended properties):
--   Cada tabla, columna y el schema quedan documentados con extended
--   properties MS_Description. Los bloques son idempotentes (guard
--   IF NOT EXISTS sobre sys.extended_properties), por lo que no rompen
--   el pipeline DbUp ni la re-ejecucion.
--   Consulta rapida (tablas y columnas, class = 1):
--     SELECT OBJECT_SCHEMA_NAME(ep.major_id) AS [schema],
--            OBJECT_NAME(ep.major_id) AS [tabla],
--            c.name AS [columna],
--            ep.value AS [descripcion]
--     FROM sys.extended_properties ep
--     LEFT JOIN sys.columns c
--         ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
--     WHERE ep.name = 'MS_Description'
--     ORDER BY [schema], [tabla], [columna];
--   Las entradas a nivel schema usan class = 3 (major_id = SCHEMA_ID).
-- ============================================================

SET NOCOUNT ON;
GO

-- Guarda del schema (agrega por robustez aunque 0002 ya lo crea)
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'educacion_medica')
BEGIN
    EXEC('CREATE SCHEMA educacion_medica');
    PRINT 'Schema [educacion_medica] creado.';
END
ELSE
BEGIN
    PRINT 'Schema [educacion_medica] ya existe. Skip.';
END
GO

-- ============================================================
-- 1) hospital_extension
--    1:1 extiende dbo.genContactosCat (Asokam) con los cálculos fijos de
--    anestesias del ASK-CEM-FOR-002. Las columnas AT/AG/AR/AE/AS/MO/MNO son
--    PERSISTED (decision propuesta §4.4): la BD las calcula y guarda.
--    La PK lógica es el hospital (UNIQUE codigo_hospital), validado en servicio.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'hospital_extension')
BEGIN
    CREATE TABLE educacion_medica.hospital_extension
    (
        id_hospital_extension        INT IDENTITY(1,1) NOT NULL,
        codigo_hospital              INT NOT NULL,          -- FK lógica -> dbo.genContactosCat.codigoContacto (validar en servicio)
        anio                         INT NULL,              -- año de la base de datos (FOR-002)
        tipo_gerencia                VARCHAR(20) NULL,      -- 'IMSS' | 'Descentralizado'
        con_sia                      BIT NULL,              -- 1 = con SIA, 0 = sin SIA
        numero_quirofanos            INT NULL,              -- número de quirófanos del hospital
        anestesias_totales           AS CAST(ROUND(numero_quirofanos * 2.5 * 250, 2) AS DECIMAL(18,2)) PERSISTED,      -- AT = NQ x 2.5 x 250
        anestesias_generales         AS CAST(ROUND(anestesias_totales * 0.30, 2) AS DECIMAL(18,2)) PERSISTED,           -- AG = AT x 30%
        anestesias_regionales        AS CAST(ROUND(anestesias_totales * 0.70, 2) AS DECIMAL(18,2)) PERSISTED,           -- AR = AT x 70%
        anestesias_epidurales        AS CAST(ROUND(anestesias_regionales * 0.35, 2) AS DECIMAL(18,2)) PERSISTED,         -- AE = AR x 35%
        anestesias_subdurales        AS CAST(ROUND(anestesias_regionales * 0.45, 2) AS DECIMAL(18,2)) PERSISTED,         -- AS = AR x 45%
        anestesias_mixtas_obesos     AS CAST(ROUND(anestesias_regionales * 0.02, 2) AS DECIMAL(18,2)) PERSISTED,         -- MO = AR x 2%
        anestesias_mixtas_no_obesos  AS CAST(ROUND(anestesias_regionales * 0.18, 2) AS DECIMAL(18,2)) PERSISTED,         -- MNO = AR x 18%
        activo                       BIT NOT NULL CONSTRAINT DF_hospital_extension_activo DEFAULT 1,
        fecha_creacion               DATETIME2 NOT NULL CONSTRAINT DF_hospital_extension_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion           DATETIME2 NOT NULL CONSTRAINT DF_hospital_extension_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion      INT NULL,              -- FK lógica -> app.Usuarios (Asokam)
        codigo_usuario_modificacion  INT NULL,              -- FK lógica -> app.Usuarios (Asokam)
        CONSTRAINT PK_hospital_extension PRIMARY KEY (id_hospital_extension),
        CONSTRAINT UQ_hospital_extension_codigo_hospital UNIQUE (codigo_hospital)
    );
    PRINT 'Tabla [educacion_medica].[hospital_extension] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[hospital_extension] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [hospital_extension] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Extension 1:1 del hospital (dbo.genContactosCat, Asokam) con los calculos fijos de anestesias del FOR-002; las columnas AT/AG/AR/AE/AS/MO/MNO son PERSISTED.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'id_hospital_extension', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'id_hospital_extension';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'codigo_hospital', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Codigo del hospital; FK logica -> dbo.genContactosCat.codigoContacto (validar en servicio)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'codigo_hospital';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'anio', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Anio de la base de datos (FOR-002)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'anio';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'tipo_gerencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'IMSS | Descentralizado',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'tipo_gerencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'con_sia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'1 = con SIA, 0 = sin SIA',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'con_sia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'numero_quirofanos', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Numero de quirofanos del hospital',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'numero_quirofanos';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'anestesias_totales', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'AT = NQ x 2.5 x 250 (columna PERSISTED, la calcula la BD)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'anestesias_totales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'anestesias_generales', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'AG = AT x 30% (columna PERSISTED, la calcula la BD)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'anestesias_generales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'anestesias_regionales', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'AR = AT x 70% (columna PERSISTED, la calcula la BD)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'anestesias_regionales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'anestesias_epidurales', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'AE = AR x 35% (columna PERSISTED, la calcula la BD)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'anestesias_epidurales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'anestesias_subdurales', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'AS = AR x 45% (columna PERSISTED, la calcula la BD)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'anestesias_subdurales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'anestesias_mixtas_obesos', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'MO = AR x 2% (columna PERSISTED, la calcula la BD)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'anestesias_mixtas_obesos';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'anestesias_mixtas_no_obesos', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'MNO = AR x 18% (columna PERSISTED, la calcula la BD)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'anestesias_mixtas_no_obesos';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'activo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Indica si el registro esta activo',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'activo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.hospital_extension')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.hospital_extension'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'hospital_extension',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

-- ============================================================
-- 2) programas_anuales
--    Aggregate del programa anual (ASK-CEM-FOR-003). Una fila por
--    Definición/modulo de programa (producto a promocionar en un periodo).
--    Todas las columnas del resumen de capacidad son, por ahora, calculadas
--    por el servicio y únicamente auditables aquí.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'programas_anuales')
BEGIN
    CREATE TABLE educacion_medica.programas_anuales
    (
        id_programa_anual                           INT IDENTITY(1,1) NOT NULL,
        anio                                        INT NOT NULL,                -- año del programa
        definicion                                  NVARCHAR(200) NULL,          -- Definición/objetivo del programa (FOR-003)
        periodo_inicio                              TINYINT NULL,                -- mes de inicio del periodo (1-12) de la tabla principal
        periodo_fin                                 TINYINT NULL,                 -- mes de fin del periodo (1-12)
        tipo_gerencia                               VARCHAR(20) NULL,            -- 'IMSS' | 'Descentralizado'
        tipo_hospital                               VARCHAR(20) NULL,            -- 'Con SIA' | 'Sin SIA'
        numero_hospitales                           INT NULL,                    -- número de hospitales objetivo al año
        meta_al_anio                                INT NULL,                    -- Meta anual = nro. hospitales × 1.5 (la calcula el servicio)
        productos_a_promocionar                     NVARCHAR(300) NULL,          -- CSV de claves (R-III, R-II, R-I, B-27G, B-22G, T)
        semanas_trabajo                             DECIMAL(8,2) NULL,           -- resumen de capacidad: semanas laboradas en hospitales
        talleres_semana                             DECIMAL(8,2) NULL,           -- resumen de capacidad: talleres por semana
        talleres_especialista                       DECIMAL(8,2) NULL,           -- resumen de capacidad: talleres por especialista a la semana
        especialistas_necesarios                    INT NULL,                    -- resumen de capacidad
        especialistas_disponibles_imss              INT NULL,                    -- resumen de capacidad: disponibles IMSS
        especialistas_disponibles_descentralizados  INT NULL,                    -- resumen de capacidad: disponibles Descentralizados
        especialistas_a_contratar                   INT NULL,                    -- resumen de capacidad
        activo                                BIT NOT NULL CONSTRAINT DF_programas_anuales_activo DEFAULT 1,
        fecha_creacion                        DATETIME2 NOT NULL CONSTRAINT DF_programas_anuales_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion                    DATETIME2 NOT NULL CONSTRAINT DF_programas_anuales_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion              INT NULL,                           -- FK lógica -> app.Usuarios (Asokam)
        codigo_usuario_modificacion          INT NULL,                           -- FK lógica -> app.Usuarios (Asokam)
        CONSTRAINT PK_programas_anuales PRIMARY KEY (id_programa_anual),
        CONSTRAINT CK_programas_anuales_periodo CHECK (periodo_inicio BETWEEN 1 AND 12 AND periodo_fin BETWEEN 1 AND 12)
    );
    PRINT 'Tabla [educacion_medica].[programas_anuales] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[programas_anuales] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [programas_anuales] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Agregado del programa anual (FOR-003): una fila por definicion/modulo de programa (producto a promocionar en un periodo); el resumen de capacidad lo calcula el servicio.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'id_programa_anual', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'id_programa_anual';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'anio', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Anio del programa',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'anio';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'definicion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Definicion/objetivo del programa (FOR-003)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'definicion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'periodo_inicio', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Mes de inicio del periodo (1-12)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'periodo_inicio';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'periodo_fin', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Mes de fin del periodo (1-12)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'periodo_fin';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'tipo_gerencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'IMSS | Descentralizado',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'tipo_gerencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'tipo_hospital', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Con SIA | Sin SIA',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'tipo_hospital';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'numero_hospitales', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Numero de hospitales objetivo al anio',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'numero_hospitales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'meta_al_anio', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Meta anual = numero de hospitales x 1.5 (la calcula el servicio)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'meta_al_anio';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'productos_a_promocionar', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'CSV de claves de producto (R-III, R-II, R-I, B-27G, B-22G, T)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'productos_a_promocionar';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'semanas_trabajo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Resumen de capacidad: semanas laboradas en hospitales',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'semanas_trabajo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'talleres_semana', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Resumen de capacidad: talleres por semana',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'talleres_semana';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'talleres_especialista', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Resumen de capacidad: talleres por especialista a la semana',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'talleres_especialista';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'especialistas_necesarios', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Resumen de capacidad: especialistas necesarios',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'especialistas_necesarios';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'especialistas_disponibles_imss', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Resumen de capacidad: especialistas disponibles IMSS',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'especialistas_disponibles_imss';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'especialistas_disponibles_descentralizados', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Resumen de capacidad: especialistas disponibles Descentralizados',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'especialistas_disponibles_descentralizados';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'especialistas_a_contratar', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Resumen de capacidad: especialistas a contratar',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'especialistas_a_contratar';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'activo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Indica si el registro esta activo',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'activo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

-- ============================================================
-- 3) programas_anuales_detalles
--    N:M programa × hospital × producto. Los productos/hospitales se
--    validan contra Asokam en el servicio (FK lógica, no física).
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'programas_anuales_detalles')
BEGIN
    CREATE TABLE educacion_medica.programas_anuales_detalles
    (
        id_programa_detalle INT IDENTITY(1,1) NOT NULL,
        id_programa_anual   INT NOT NULL,
        codigo_hospital     INT NULL,          -- FK lógica -> dbo.genContactosCat.codigoContacto (validar en servicio)
        codigo_producto     VARCHAR(50) NULL,  -- FK lógica -> dbo.genProductosCat.codigoProducto (validar en servicio)
        fecha_creacion      DATETIME2 NOT NULL CONSTRAINT DF_programa_detalle_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion  DATETIME2 NOT NULL CONSTRAINT DF_programa_detalle_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion     INT NULL,
        codigo_usuario_modificacion INT NULL,
        CONSTRAINT PK_programa_anual_detalle PRIMARY KEY (id_programa_detalle),
        CONSTRAINT FK_programa_detalle_programa FOREIGN KEY (id_programa_anual) REFERENCES educacion_medica.programas_anuales (id_programa_anual) ON DELETE CASCADE,
        CONSTRAINT UQ_programa_detalle_programa_hospital UNIQUE (id_programa_anual, codigo_hospital, codigo_producto)
    );
    PRINT 'Tabla [educacion_medica].[programas_anuales_detalles] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[programas_anuales_detalles] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [programas_anuales_detalles] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales_detalles') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'N:M programa x hospital x producto; los productos/hospitales se validan contra Asokam en el servicio (FK logica, no fisica).',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales_detalles';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales_detalles')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales_detalles'), 'id_programa_detalle', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales_detalles',
        @level2type = N'COLUMN', @level2name = N'id_programa_detalle';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales_detalles')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales_detalles'), 'id_programa_anual', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Programa anual al que pertenece el detalle (FK educacion_medica.programas_anuales)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales_detalles',
        @level2type = N'COLUMN', @level2name = N'id_programa_anual';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales_detalles')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales_detalles'), 'codigo_hospital', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Codigo del hospital; FK logica -> dbo.genContactosCat.codigoContacto (validar en servicio)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales_detalles',
        @level2type = N'COLUMN', @level2name = N'codigo_hospital';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales_detalles')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales_detalles'), 'codigo_producto', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Codigo del producto; FK logica -> dbo.genProductosCat.codigoProducto (validar en servicio)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales_detalles',
        @level2type = N'COLUMN', @level2name = N'codigo_producto';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales_detalles')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales_detalles'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales_detalles',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales_detalles')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales_detalles'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales_detalles',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales_detalles')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales_detalles'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales_detalles',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.programas_anuales_detalles')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.programas_anuales_detalles'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'programas_anuales_detalles',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

-- ============================================================
-- 4) selecciones_mensuales
--    Aggregate de la selección mensual de hospitales (ASK-CEM-FOR-004,
--    reunión del día 15, hospitales visitados en los próximos 45 días).
--    La vigencia de 45 días calendario se representa con
--    fecha_inicio_vigencia / fecha_fin_vigencia.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'selecciones_mensuales')
BEGIN
    CREATE TABLE educacion_medica.selecciones_mensuales
    (
        id_seleccion_mensual INT IDENTITY(1,1) NOT NULL,
        fecha_seleccion      DATE NOT NULL,             -- fecha de la reunión (día 15 del mes)
        tipo_gerencia        VARCHAR(50) NULL,          -- 'IMSS' | 'Descentralizado'
        fecha_inicio_vigencia DATE NULL,                -- primer día del periodo de 45 días
        fecha_fin_vigencia   DATE NULL,                 -- último día del periodo de 45 días
        talleres_objetivo_mes INT NULL,                 -- mínimo de talleres a programar el mes (doc.: ≥64 por gerencia)
        activo                BIT NOT NULL CONSTRAINT DF_selecciones_mensuales_activo DEFAULT 1,
        fecha_creacion       DATETIME2 NOT NULL CONSTRAINT DF_selecciones_mensuales_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion   DATETIME2 NOT NULL CONSTRAINT DF_selecciones_mensuales_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion     INT NULL,
        codigo_usuario_modificacion INT NULL,
        CONSTRAINT PK_seleccion_mensual PRIMARY KEY (id_seleccion_mensual)
    );
    PRINT 'Tabla [educacion_medica].[selecciones_mensuales] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[selecciones_mensuales] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [selecciones_mensuales] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Agregado de la seleccion mensual de hospitales (FOR-004, reunion del dia 15; hospitales visitados en los proximos 45 dias).',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'id_seleccion_mensual', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'id_seleccion_mensual';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'fecha_seleccion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de la reunion (dia 15 del mes)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'fecha_seleccion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'tipo_gerencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'IMSS | Descentralizado',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'tipo_gerencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'fecha_inicio_vigencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Primer dia del periodo de 45 dias',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'fecha_inicio_vigencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'fecha_fin_vigencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Ultimo dia del periodo de 45 dias',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'fecha_fin_vigencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'talleres_objetivo_mes', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Minimo de talleres a programar el mes (documentacion: >=64 por gerencia)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'talleres_objetivo_mes';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'activo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Indica si el registro esta activo',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'activo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

-- ============================================================
-- 5) selecciones_mensuales_hospitales
--    N:M selección × hospital con la info capturada por el Ejecutivo de
--    Ventas en el formulario FOR-004 (Anexo 1).
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'selecciones_mensuales_hospitales')
BEGIN
    CREATE TABLE educacion_medica.selecciones_mensuales_hospitales
    (
        id_seleccion_hospital INT IDENTITY(1,1) NOT NULL,
        id_seleccion_mensual  INT NOT NULL,
        codigo_hospital       INT NULL,          -- FK lógica -> dbo.genContactosCat.codigoContacto (validar en servicio)
        region                VARCHAR(60)  NULL, -- Región del hospital
        entidad_federativa    VARCHAR(60) NULL, -- Estado (entidad federativa)
        ciudad_municipio      NVARCHAR(120) NULL,
        codigo_ejecutivo      INT NULL,          -- FK lógica -> app.Usuarios (Asokam)
        producto_a_promocionar NVARCHAR(150) NULL,
        observaciones         NVARCHAR(300) NULL,
        fecha_creacion        DATETIME2 NOT NULL CONSTRAINT DF_sel_hospital_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion    DATETIME2 NOT NULL CONSTRAINT DF_sel_hospital_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion     INT NULL,
        codigo_usuario_modificacion INT NULL,
        CONSTRAINT PK_seleccion_hospital PRIMARY KEY (id_seleccion_hospital),
        CONSTRAINT FK_seleccion_hospital_seleccion FOREIGN KEY (id_seleccion_mensual) REFERENCES educacion_medica.selecciones_mensuales (id_seleccion_mensual) ON DELETE CASCADE
    );
    PRINT 'Tabla [educacion_medica].[selecciones_mensuales_hospitales] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[selecciones_mensuales_hospitales] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [selecciones_mensuales_hospitales] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'N:M seleccion x hospital con la informacion capturada por el Ejecutivo de Ventas en el formulario FOR-004 (Anexo 1).',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'id_seleccion_hospital', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'id_seleccion_hospital';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'id_seleccion_mensual', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Seleccion mensual a la que pertenece (FK educacion_medica.selecciones_mensuales)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'id_seleccion_mensual';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'codigo_hospital', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Codigo del hospital; FK logica -> dbo.genContactosCat.codigoContacto (validar en servicio)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'codigo_hospital';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'region', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Region del hospital',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'region';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'entidad_federativa', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Estado (entidad federativa)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'entidad_federativa';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'ciudad_municipio', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Ciudad o municipio del hospital',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'ciudad_municipio';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'codigo_ejecutivo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Codigo del Ejecutivo de Ventas; FK logica -> app.Usuarios (Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'codigo_ejecutivo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'producto_a_promocionar', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Producto a promocionar en el hospital',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'producto_a_promocionar';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'observaciones', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Observaciones de la captura',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'observaciones';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.selecciones_mensuales_hospitales'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'selecciones_mensuales_hospitales',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

-- ============================================================
-- 6) talleres  (AGGREGATE ROOT)
--    La "Matriz del Taller" (ASK-CEM-FOR-005). El state machine del taller
--    se valida en servicio (propuesta §4.3) y lo refleja `estado`.
--    `id_seleccion_hospital` vincula al taller con la selección mensual que
--    le dio origen (ON DELETE NO ACTION: no se limpia la selección que
--    ya generó talleres).
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'talleres')
BEGIN
    CREATE TABLE educacion_medica.talleres
    (
        id_taller                       INT IDENTITY(1,1) NOT NULL,
        id_seleccion_hospital           INT NULL, -- FK: origen en la selección mensual del hospital
        codigo_hospital                 INT NULL, -- FK lógica -> genContactosCat.codigoContacto
        region                          VARCHAR(60) NULL,
        entidad_federativa              VARCHAR(60) NULL, -- Estado (entidad federativa) del formulario
        ciudad_municipio               NVARCHAR(160) NULL,
        numero_participantes            INT NULL,  -- No. de participantes estimados
        codigo_ejecutivo                INT NULL,   -- FK lógica -> app.Usuarios (Ejecutivo de Ventas)
        codigo_especialista             INT NULL,   -- FK lógica -> app.Usuarios (Especialista de producto, FOR-006)
        unidad_medica                  NVARCHAR(160) NULL, -- Unidad médica / hospital (FOR-008)
        lugar                          NVARCHAR(200) NULL,  -- Lugar donde se imparte el taller
        fecha_taller                   DATE NULL,   -- fecha programada (dd/mm/aaaa)
        hora_taller                    TIME(0) NULL,
        requiere_equipo_proyeccion     BIT NULL,    -- ¿Se requiere llevar uno?
        tipo_equipo_proyeccion         VARCHAR(10) NULL, -- 'Propio' | 'Rentado' (aplica si requiere)
        estado                         VARCHAR(15) NOT NULL CONSTRAINT DF_talleres_estado DEFAULT 'Borrador',
        observaciones                  NVARCHAR(500) NULL,
        activo                      BIT NOT NULL CONSTRAINT DF_talleres_activo DEFAULT 1,
        fecha_creacion              DATETIME2 NOT NULL CONSTRAINT DF_talleres_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion          DATETIME2 NOT NULL CONSTRAINT DF_talleres_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion     INT NULL,
        codigo_usuario_modificacion INT NULL,
        CONSTRAINT PK_taller PRIMARY KEY (id_taller),
        CONSTRAINT FK_talleres_seleccion_hospital FOREIGN KEY (id_seleccion_hospital) REFERENCES educacion_medica.selecciones_mensuales_hospitales (id_seleccion_hospital) ON DELETE NO ACTION,
        CONSTRAINT CK_talleres_estado CHECK (estado IN ('Borrador','Elaborado','Revisado','Autorizado','Programado','EnCurso','Realizado','Cancelado'))
    );
    PRINT 'Tabla [educacion_medica].[talleres] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[talleres] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [talleres] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Aggregate root "Matriz del Taller" (FOR-005); el state machine se valida en servicio y se refleja en estado; vincula con la seleccion mensual que le dio origen.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'id_taller', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'id_taller';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'id_seleccion_hospital', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Origen del taller en la seleccion mensual del hospital (FK educacion_medica.selecciones_mensuales_hospitales, ON DELETE NO ACTION)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'id_seleccion_hospital';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'codigo_hospital', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Codigo del hospital; FK logica -> genContactosCat.codigoContacto (validar en servicio)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'codigo_hospital';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'region', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Region del hospital',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'region';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'entidad_federativa', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Estado (entidad federativa) del formulario',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'entidad_federativa';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'ciudad_municipio', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Ciudad o municipio del hospital',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'ciudad_municipio';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'numero_participantes', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Numero de participantes estimados',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'numero_participantes';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'codigo_ejecutivo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Codigo del Ejecutivo de Ventas; FK logica -> app.Usuarios (Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'codigo_ejecutivo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'codigo_especialista', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Codigo del Especialista de producto (FOR-006); FK logica -> app.Usuarios (Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'codigo_especialista';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'unidad_medica', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Unidad medica / hospital (FOR-008)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'unidad_medica';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'lugar', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Lugar donde se imparte el taller',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'lugar';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'fecha_taller', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha programada del taller (dd/mm/aaaa)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'fecha_taller';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'hora_taller', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Hora programada del taller',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'hora_taller';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'requiere_equipo_proyeccion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Indica si se requiere llevar equipo de proyeccion',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'requiere_equipo_proyeccion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'tipo_equipo_proyeccion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Propio | Rentado (aplica si se requiere equipo)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'tipo_equipo_proyeccion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'estado', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Estado del taller: Borrador/Elaborado/Revisado/Autorizado/Programado/EnCurso/Realizado/Cancelado',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'estado';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'observaciones', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Observaciones generales del taller',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'observaciones';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'activo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Indica si el registro esta activo',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'activo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.talleres')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.talleres'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'talleres',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

-- ============================================================
-- 7) taller_recursos
--    Recursos polimórficos del taller (FOR-005 "Costo por Recurso"):
--    muestras/producto, folletos, envío y box lunch (una fila por tipo).
--    Columna polimórfica `tipo_recurso` + columnas de cantidad/valor.
--    `subtotal` lo calcula el servicio (no computed; propuesta §4.4).
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_recursos')
BEGIN
    CREATE TABLE educacion_medica.taller_recursos
    (
        id_taller_recurso  INT IDENTITY(1,1) NOT NULL,
        id_taller          INT NOT NULL,
        tipo_recurso       VARCHAR(15) NOT NULL,  -- 'Producto' (muestras) | 'Folleto' | 'Envio' | 'BoxLunch'
        codigo_producto    VARCHAR(50) NULL,      -- FK lógica -> genProductosCat (solo 'Producto')
        descripcion        NVARCHAR(200) NULL,    -- texto libre (proveedor/notas)
        tipo_envio         VARCHAR(10) NULL,      -- para 'Envio': 'Interno' | 'Externo'
        cantidad           INT NULL,              -- piezas (producto/folleto) o no. de servicios (box lunch)
        costo_unitario     DECIMAL(18,2) NULL,    -- costo unitario $MXN (folleto/envío/box) o costo del producto
        subtotal           DECIMAL(18,2) NULL,    -- cantidad × costo_unitario; lo calcula el servicio
        observaciones      NVARCHAR(300) NULL,
        fecha_creacion     DATETIME2 NOT NULL CONSTRAINT DF_taller_recursos_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion DATETIME2 NOT NULL CONSTRAINT DF_taller_recursos_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion     INT NULL,
        codigo_usuario_modificacion INT NULL,
        CONSTRAINT PK_taller_recurso PRIMARY KEY (id_taller_recurso),
        CONSTRAINT FK_taller_recurso_taller FOREIGN KEY (id_taller) REFERENCES educacion_medica.talleres (id_taller) ON DELETE CASCADE,
        CONSTRAINT CK_taller_recurso_tipo CHECK (tipo_recurso IN ('Producto','Folleto','Envio','BoxLunch'))
    );
    PRINT 'Tabla [educacion_medica].[taller_recursos] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[taller_recursos] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [taller_recursos] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Recursos polimorficos del taller (FOR-005 "Costo por Recurso"): muestras/producto, folletos, envio y box lunch; una fila por tipo.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'id_taller_recurso', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'id_taller_recurso';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'id_taller', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Taller al que pertenece el recurso (FK educacion_medica.talleres)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'id_taller';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'tipo_recurso', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Producto (muestras) | Folleto | Envio | BoxLunch',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'tipo_recurso';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'codigo_producto', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Codigo del producto; FK logica -> genProductosCat (solo para tipo Producto)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'codigo_producto';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'descripcion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Texto libre (proveedor/notas)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'descripcion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'tipo_envio', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Para tipo Envio: Interno | Externo',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'tipo_envio';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'cantidad', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Piezas (producto/folleto) o numero de servicios (box lunch)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'cantidad';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'costo_unitario', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Costo unitario $MXN (folleto/envio/box) o costo del producto',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'costo_unitario';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'subtotal', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Cantidad x costo_unitario; lo calcula el servicio',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'subtotal';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'observaciones', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Observaciones del recurso',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'observaciones';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_recursos')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_recursos'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_recursos',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

-- ============================================================
-- 8) taller_materiales
--    Solicitud y entrega de material (ASK-CEM-FOR-007). 1:1 con `talleres`
--    garantizada por UNIQUE (id_taller). Guarda el paquete de material:
--    lista de asistencia, flayers, computadora, proyector, dulces, modelo.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_materiales')
BEGIN
    CREATE TABLE educacion_medica.taller_materiales
    (
        id_taller_material            INT IDENTITY(1,1) NOT NULL,
        id_taller                     INT NOT NULL,
        fecha_entrega                 DATE NULL,                -- fecha del formato FOR-007
        cargo_puesto                  NVARCHAR(120) NULL,       -- cargo/puesto del ejecutivo que entrega
        nombre_producto               NVARCHAR(160) NULL,       -- nombre del producto solicitado
        cantidad_producto             INT NULL,                 -- cantidad de producto
        incluye_lista_asistencia      BIT NULL,                 -- lista de asistencia (SI/NO)
        incluye_flayers               BIT NULL,                 -- flyers/folletos (SI/NO)
        incluye_equipo_computo        BIT NULL,                 -- equipo de cómputo (SI/NO)
        incluye_proyector             BIT NULL,                 -- proyector (SI/NO)
        incluye_dulces                BIT NULL,                 -- dulces (SI/NO)
        incluye_modelo_anatomico      BIT NULL,                 -- modelo anatómico (SI/NO)
        nombre_ejecutivo_recepcion    NVARCHAR(200) NULL,       -- nombre y firma del ejecutivo que recibe
        observaciones                 NVARCHAR(500) NULL,
        fecha_creacion                DATETIME2 NOT NULL CONSTRAINT DF_taller_materiales_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion            DATETIME2 NOT NULL CONSTRAINT DF_taller_materiales_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion       INT NULL,
        codigo_usuario_modificacion   INT NULL,
        CONSTRAINT PK_taller_material PRIMARY KEY (id_taller_material),
        CONSTRAINT FK_taller_material_taller FOREIGN KEY (id_taller) REFERENCES educacion_medica.talleres (id_taller) ON DELETE CASCADE,
        CONSTRAINT UQ_taller_material_id_taller UNIQUE (id_taller)
    );
    PRINT 'Tabla [educacion_medica].[taller_materiales] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[taller_materiales] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [taller_materiales] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Solicitud y entrega de material (FOR-007); 1:1 con talleres garantizada por UNIQUE (id_taller): paquete de material del taller.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'id_taller_material', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'id_taller_material';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'id_taller', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Taller al que pertenece (FK educacion_medica.talleres; UNIQUE, relacion 1:1)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'id_taller';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'fecha_entrega', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha del formato FOR-007',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'fecha_entrega';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'cargo_puesto', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Cargo/puesto del ejecutivo que entrega',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'cargo_puesto';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'nombre_producto', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Nombre del producto solicitado',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'nombre_producto';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'cantidad_producto', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Cantidad de producto',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'cantidad_producto';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'incluye_lista_asistencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Incluye lista de asistencia (SI/NO)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'incluye_lista_asistencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'incluye_flayers', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Incluye flyers/folletos (SI/NO)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'incluye_flayers';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'incluye_equipo_computo', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Incluye equipo de computo (SI/NO)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'incluye_equipo_computo';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'incluye_proyector', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Incluye proyector (SI/NO)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'incluye_proyector';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'incluye_dulces', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Incluye dulces (SI/NO)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'incluye_dulces';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'incluye_modelo_anatomico', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Incluye modelo anatomico (SI/NO)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'incluye_modelo_anatomico';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'nombre_ejecutivo_recepcion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Nombre y firma del ejecutivo que recibe',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'nombre_ejecutivo_recepcion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'observaciones', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Observaciones de la solicitud/entrega',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'observaciones';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_materiales')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_materiales'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_materiales',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

-- ============================================================
-- 9) taller_asistencias
--    Lista de médicos asistentes (hasta 20; FOR-008). `numero` 1..20.
--    `firma_url` guarda la foto/scan de la firma; la observación del
--    médico líder (positivo/negativo) se deja en `observaciones`.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_asistencias')
BEGIN
    CREATE TABLE educacion_medica.taller_asistencias
    (
        id_asistencia           INT IDENTITY(1,1) NOT NULL,
        id_taller               INT NOT NULL,
        numero                  TINYINT NOT NULL,             -- No. en lista (1-20)
        nombre_medico           NVARCHAR(150) NOT NULL,       -- nombre del médico
        cedula_profesional      VARCHAR(30) NULL,             -- cédula profesional
        puesto_medico           NVARCHAR(120) NULL,           -- puesto del médico (p.ej. jefe de anestesiología)
        telefono_celular        VARCHAR(30) NULL,             -- teléfono celular de contacto
        correo_electronico      VARCHAR(150) NULL,            -- correo del médico
        firma_url               NVARCHAR(500) NULL,           -- foto/scan de la firma registrada
        observaciones           NVARCHAR(300) NULL,           -- médico líder (+/-) y otras observaciones
        fecha_creacion          DATETIME2 NOT NULL CONSTRAINT DF_taller_asistencias_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion      DATETIME2 NOT NULL CONSTRAINT DF_taller_asistencias_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion     INT NULL,
        codigo_usuario_modificacion INT NULL,
        CONSTRAINT PK_taller_asistencia PRIMARY KEY (id_asistencia),
        CONSTRAINT FK_taller_asistencia_taller FOREIGN KEY (id_taller) REFERENCES educacion_medica.talleres (id_taller) ON DELETE CASCADE,
        CONSTRAINT CK_taller_asistencia_numero CHECK (numero BETWEEN 1 AND 20),
        CONSTRAINT UQ_taller_asistencia_numero UNIQUE (id_taller, numero)
    );
    PRINT 'Tabla [educacion_medica].[taller_asistencias] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[taller_asistencias] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [taller_asistencias] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Lista de medicos asistentes al taller (hasta 20, FOR-008).',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'id_asistencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'id_asistencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'id_taller', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Taller al que pertenece (FK educacion_medica.talleres)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'id_taller';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'numero', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Numero en lista (1-20)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'numero';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'nombre_medico', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Nombre del medico',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'nombre_medico';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'cedula_profesional', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Cedula profesional',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'cedula_profesional';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'puesto_medico', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Puesto del medico (p.ej. jefe de anestesiologia)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'puesto_medico';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'telefono_celular', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Telefono celular de contacto',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'telefono_celular';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'correo_electronico', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Correo del medico',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'correo_electronico';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'firma_url', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Foto/scan de la firma registrada',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'firma_url';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'observaciones', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Medico lider (+/-) y otras observaciones',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'observaciones';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_asistencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_asistencias'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_asistencias',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

-- ============================================================
-- 10) taller_aprobaciones
--    Log de aprobaciones del taller: Elaboró/Revisó/Autorizó. Cada firma
--    registra estado (Pendiente/Firmado/Rechazado) y fecha_firma.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_aprobaciones')
BEGIN
    CREATE TABLE educacion_medica.taller_aprobaciones
    (
        id_aprobacion       INT IDENTITY(1,1) NOT NULL,
        id_taller           INT NOT NULL,
        rol_firma           VARCHAR(10) NOT NULL,          -- 'Elaboro' | 'Reviso' | 'Autorizo'
        descripcion_rol     NVARCHAR(80) NULL,            -- etiqueta legible (Elaboró/Revisó/Autorizó); el servicio la lee
        codigo_usuario      INT NULL,                      -- FK lógica -> app.Usuarios (quién firma)
        puesto              NVARCHAR(150) NULL,            -- puesto del firmante (FOR-005)
        estado              VARCHAR(15) NOT NULL DEFAULT 'Pendiente',
        comentario          NVARCHAR(500) NULL,           -- comentario de la aprobacion/rechazo
        fecha_firma         DATETIME2 NULL,               -- cuando se firmó (null mientras Pendiente)
        fecha_creacion      DATETIME2 NOT NULL CONSTRAINT DF_taller_aprobaciones_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion  DATETIME2 NOT NULL CONSTRAINT DF_taller_aprobaciones_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion     INT NULL,
        codigo_usuario_modificacion INT NULL,
        CONSTRAINT PK_taller_aprobacion PRIMARY KEY (id_aprobacion),
        CONSTRAINT FK_taller_aprobacion_taller FOREIGN KEY (id_taller) REFERENCES educacion_medica.talleres (id_taller) ON DELETE CASCADE,
        CONSTRAINT UQ_taller_aprobacion_rol UNIQUE (id_taller, rol_firma),
        CONSTRAINT CK_taller_aprobacion_rol CHECK (rol_firma IN ('Elaboro','Reviso','Autorizo')),
        CONSTRAINT CK_taller_aprobacion_estado CHECK (estado IN ('Pendiente','Firmado','Rechazado'))
    );
    PRINT 'Tabla [educacion_medica].[taller_aprobaciones] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[taller_aprobaciones] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [taller_aprobaciones] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Log de aprobaciones del taller: Elaboro/Reviso/Autorizo con estado (Pendiente/Firmado/Rechazado) y fecha de firma.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'id_aprobacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'id_aprobacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'id_taller', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Taller al que pertenece (FK educacion_medica.talleres)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'id_taller';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'rol_firma', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Elaboro | Reviso | Autorizo',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'rol_firma';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'descripcion_rol', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Etiqueta legible del rol (Elaboro/Reviso/Autorizo); el servicio la lee',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'descripcion_rol';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'codigo_usuario', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Codigo del usuario que firma; FK logica -> app.Usuarios (Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'puesto', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Puesto del firmante (FOR-005)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'puesto';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'estado', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Estado de la firma: Pendiente/Firmado/Rechazado',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'estado';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'comentario', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Comentario de la aprobacion/rechazo',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'comentario';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'fecha_firma', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha en que se firmo (null mientras Pendiente)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'fecha_firma';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_aprobaciones')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_aprobaciones'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_aprobaciones',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

-- ============================================================
-- 11) taller_evidencias
--     Fotos/video/documentos post-taller (1:N). archivo_url es la ruta
--     al recurso estático (wwwroot/media/...).
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'taller_evidencias')
BEGIN
    CREATE TABLE educacion_medica.taller_evidencias
    (
        id_evidencia        INT IDENTITY(1,1) NOT NULL,
        id_taller           INT NOT NULL,
        tipo_evidencia      VARCHAR(10) NOT NULL,        -- 'foto' | 'video' | 'documento'
        archivo_url         NVARCHAR(500) NOT NULL,
        descripcion         NVARCHAR(300) NULL,
        fecha_evidencia     DATE NULL,                   -- fecha en que se tomó/capturó la evidencia
        fecha_creacion      DATETIME2 NOT NULL CONSTRAINT DF_taller_evidencias_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion  DATETIME2 NOT NULL CONSTRAINT DF_taller_evidencias_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        codigo_usuario_creacion     INT NULL,
        codigo_usuario_modificacion INT NULL,
        CONSTRAINT PK_taller_evidencia PRIMARY KEY (id_evidencia),
        CONSTRAINT FK_taller_evidencia_taller FOREIGN KEY (id_taller) REFERENCES educacion_medica.talleres (id_taller) ON DELETE CASCADE,
        CONSTRAINT CK_taller_evidencia_tipo CHECK (tipo_evidencia IN ('foto','video','documento'))
    );
    PRINT 'Tabla [educacion_medica].[taller_evidencias] creada.';
END
ELSE
BEGIN
    PRINT 'Tabla [educacion_medica].[taller_evidencias] ya existe. Skip.';
END

-- ============================================================
-- Documentacion [taller_evidencias] (extended properties MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Fotos/video/documentos post-taller (1:N); archivo_url apunta al recurso estatico (wwwroot/media/...).',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_evidencias'), 'id_evidencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Identificador interno',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias',
        @level2type = N'COLUMN', @level2name = N'id_evidencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_evidencias'), 'id_taller', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Taller al que pertenece (FK educacion_medica.talleres)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias',
        @level2type = N'COLUMN', @level2name = N'id_taller';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_evidencias'), 'tipo_evidencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'foto | video | documento',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias',
        @level2type = N'COLUMN', @level2name = N'tipo_evidencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_evidencias'), 'archivo_url', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Ruta al recurso estatico (wwwroot/media/...)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias',
        @level2type = N'COLUMN', @level2name = N'archivo_url';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_evidencias'), 'descripcion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Descripcion de la evidencia',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias',
        @level2type = N'COLUMN', @level2name = N'descripcion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_evidencias'), 'fecha_evidencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha en que se tomo/capturo la evidencia',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias',
        @level2type = N'COLUMN', @level2name = N'fecha_evidencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_evidencias'), 'fecha_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de creacion del registro (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias',
        @level2type = N'COLUMN', @level2name = N'fecha_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_evidencias'), 'fecha_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Fecha de ultima modificacion (UTC)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias',
        @level2type = N'COLUMN', @level2name = N'fecha_modificacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_evidencias'), 'codigo_usuario_creacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que creo el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_creacion';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.taller_evidencias')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.taller_evidencias'), 'codigo_usuario_modificacion', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Usuario que modifico el registro (FK logica app.Usuarios, Asokam)',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'taller_evidencias',
        @level2type = N'COLUMN', @level2name = N'codigo_usuario_modificacion';
GO

PRINT 'Resumen 0003 (tablas operacionales educacion_medica):';
PRINT '- hospital_extension: 1:1 genContactosCat; cálculos PERSISTED AT/AG/AR/AE/AS/MO/MNO.';
PRINT '- programas_anuales: agregado del programa anual (una fila por definición/modulo).';
PRINT '- programas_anuales_detalles: N:M programa x hospital x producto.';
PRINT '- selecciones_mensuales: agregado de la selección del día 15 (periodo de 45 días).';
PRINT '- selecciones_mensuales_hospitales: N:M selección x hospital+Ejecutivo';
PRINT '- talleres: aggregate root, la Matriz del taller (estado propuesto).';
PRINT '- taller_recursos: 1:N recursos polimórficos (Producto/Folleto/Envío/BoxLunch).';
PRINT '- taller_materiales: 1:1 solicitud y entrega de material (UNIQUE id_taller).';
PRINT '- taller_asistencias: 1:N lista de médicos (max. 20).';
PRINT '- taller_aprobaciones: 1:N Elaboró/Revisó/Autorizó (log auditable).';
PRINT '- taller_evidencias: 1:N fotos/videos/documentos post-taller.';
PRINT 'FIN script 0003.';
GO