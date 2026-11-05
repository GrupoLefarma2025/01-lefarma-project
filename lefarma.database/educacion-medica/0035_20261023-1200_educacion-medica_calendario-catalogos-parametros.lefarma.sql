-- =============================================================================
-- 0035 — Calendario: catálogos de tipo de visita/tema y parámetros (ADR-00016)
--
-- QUÉ HACE
--   - Agrega tipo_visita y tema_taller.
--   - rutas_visitas.id_tipo_visita (FK tipo_visita).
--   - talleres.id_tema_taller (FK tema_taller).
--   - parametros_modulo.tipo / valor_texto (numero | booleano | texto | enum).
--   - Siembra los parámetros de capacidad, metas, producto, autorización,
--     candado de matriz, cambios de taller y sugerencia de especialistas.
--   - Siembra los tipos de visita finales (incluye TALLER como
--     "Promoción producto nuevo" y es_taller = 0, según 0041).
--
--   NO aplica el script solo: lo revisa y ejecuta el usuario.
--   Para instalación limpia, 0016 integra las tablas/columnas; 0035 siembra.
--   Este script absorbe los seeds de 0036, 0041, 0044 y 0045, por lo que en
--   una BD nueva NO deben ejecutarse esos incrementales.
--
-- ORDEN DE INSTALACIÓN LIMPIA (solo Educación Médica)
--   1) 0016  esquema completo
--   2) 0030  catálogos base y backfills
--   3) 0035  este script (catálogos de calendario y parámetros)
--   4) 0018  workflows de selección, rutas y matriz
--   5) 0037  limpieza opcional (manual/educacion-medica)
--
-- REQUISITOS
--   - 0016 aplicado.
--
-- IDEMPOTENTE: guards por tabla/columna/índice/FK y seeds con NOT EXISTS.
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

    -- =========================================================================
    -- 1) Catálogos de calendario
    -- =========================================================================

    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'tipo_visita')
    BEGIN
        CREATE TABLE educacion_medica.[tipo_visita] (
            [id_tipo_visita] int IDENTITY(1,1) NOT NULL,
            [clave] varchar(30) NOT NULL,
            [descripcion] nvarchar(100) NOT NULL,
            [es_taller] bit NOT NULL CONSTRAINT [DF_tipo_visita_es_taller] DEFAULT ((0)),
            [activo] bit NOT NULL CONSTRAINT [DF_tipo_visita_activo] DEFAULT ((1)),
            [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_tipo_visita_fecha_creacion] DEFAULT (sysutcdatetime()),
            [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_tipo_visita_fecha_modificacion] DEFAULT (sysutcdatetime()),
            [id_usuario_creacion] int NULL,
            [id_usuario_modificacion] int NULL,
            CONSTRAINT [PK_tipo_visita] PRIMARY KEY ([id_tipo_visita]),
            CONSTRAINT [UQ_tipo_visita_clave] UNIQUE ([clave])
        );
        PRINT 'Tabla [educacion_medica].[tipo_visita] creada.';
    END
    ELSE
        PRINT 'Tabla [educacion_medica].[tipo_visita] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_visita]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Catálogo de tipos de visita del calendario (ADR-00016): Taller, Informativa, Captación de queja, Otro. es_taller decide si genera taller/matriz; los demás no cuentan en los indicadores de talleres.', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_visita';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_visita]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[tipo_visita]'), 'clave', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Clave estable (TALLER, INFORMATIVA, CAPTACION_QUEJA, OTRO)', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_visita', 'COLUMN', N'clave';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tipo_visita]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[tipo_visita]'), 'es_taller', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'1 = el tipo genera taller/matriz; 0 = visita informativa u otro evento', 'SCHEMA', N'educacion_medica', 'TABLE', N'tipo_visita', 'COLUMN', N'es_taller';

    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'tema_taller')
    BEGIN
        CREATE TABLE educacion_medica.[tema_taller] (
            [id_tema_taller] int IDENTITY(1,1) NOT NULL,
            [clave] varchar(50) NOT NULL,
            [descripcion] nvarchar(150) NOT NULL,
            [activo] bit NOT NULL CONSTRAINT [DF_tema_taller_activo] DEFAULT ((1)),
            [fecha_creacion] datetime2(7) NOT NULL CONSTRAINT [DF_tema_taller_fecha_creacion] DEFAULT (sysutcdatetime()),
            [fecha_modificacion] datetime2(7) NOT NULL CONSTRAINT [DF_tema_taller_fecha_modificacion] DEFAULT (sysutcdatetime()),
            [id_usuario_creacion] int NULL,
            [id_usuario_modificacion] int NULL,
            CONSTRAINT [PK_tema_taller] PRIMARY KEY ([id_tema_taller]),
            CONSTRAINT [UQ_tema_taller_clave] UNIQUE ([clave])
        );
        PRINT 'Tabla [educacion_medica].[tema_taller] creada.';
    END
    ELSE
        PRINT 'Tabla [educacion_medica].[tema_taller] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[tema_taller]') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Catálogo opcional del tema/asunto del taller (ADR-00016). Si no se usa, el tema se toma del producto capturado en taller_recursos.', 'SCHEMA', N'educacion_medica', 'TABLE', N'tema_taller';

    -- Semillas de tipo_visita (SQL dinámico: la tabla se acaba de crear)
    EXEC(N'
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.tipo_visita WHERE clave = ''TALLER'')
        INSERT INTO educacion_medica.tipo_visita (clave, descripcion, es_taller, activo)
        VALUES (''TALLER'', N''Promoción producto nuevo'', 0, 1);
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.tipo_visita WHERE clave = ''INFORMATIVA'')
        INSERT INTO educacion_medica.tipo_visita (clave, descripcion, es_taller, activo)
        VALUES (''INFORMATIVA'', N''Informativa'', 0, 1);
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.tipo_visita WHERE clave = ''CAPTACION_QUEJA'')
        INSERT INTO educacion_medica.tipo_visita (clave, descripcion, es_taller, activo)
        VALUES (''CAPTACION_QUEJA'', N''Captación de queja'', 0, 1);
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.tipo_visita WHERE clave = ''OTRO'')
        INSERT INTO educacion_medica.tipo_visita (clave, descripcion, es_taller, activo)
        VALUES (''OTRO'', N''Otro'', 0, 1);

    UPDATE educacion_medica.tipo_visita
       SET descripcion = N''Promoción producto nuevo'',
           es_taller = 0,
           fecha_modificacion = SYSUTCDATETIME()
     WHERE clave = ''TALLER''
       AND descripcion = N''Taller'';');
    PRINT 'Tipos de visita base sembrados/verificados.';

    -- =========================================================================
    -- 2) Columnas en rutas_visitas y talleres
    -- =========================================================================

    IF COL_LENGTH('educacion_medica.rutas_visitas', 'id_tipo_visita') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[rutas_visitas] ADD [id_tipo_visita] int NULL;
        PRINT 'Columna [rutas_visitas].[id_tipo_visita] agregada.';
    END
    ELSE
        PRINT 'Columna [rutas_visitas].[id_tipo_visita] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_rutas_visitas_tipo_visita')
    BEGIN
        EXEC(N'ALTER TABLE educacion_medica.[rutas_visitas] ADD CONSTRAINT [FK_rutas_visitas_tipo_visita]
            FOREIGN KEY ([id_tipo_visita]) REFERENCES educacion_medica.[tipo_visita] ([id_tipo_visita]);');
        PRINT 'FK [FK_rutas_visitas_tipo_visita] creada.';
    END
    ELSE
        PRINT 'FK [FK_rutas_visitas_tipo_visita] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND name = 'IX_rutas_visitas_tipo_visita')
        EXEC(N'CREATE INDEX [IX_rutas_visitas_tipo_visita] ON educacion_medica.[rutas_visitas] ([id_tipo_visita]);');

    IF COL_LENGTH('educacion_medica.talleres', 'id_tema_taller') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[talleres] ADD [id_tema_taller] int NULL;
        PRINT 'Columna [talleres].[id_tema_taller] agregada.';
    END
    ELSE
        PRINT 'Columna [talleres].[id_tema_taller] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_talleres_tema_taller')
    BEGIN
        EXEC(N'ALTER TABLE educacion_medica.[talleres] ADD CONSTRAINT [FK_talleres_tema_taller]
            FOREIGN KEY ([id_tema_taller]) REFERENCES educacion_medica.[tema_taller] ([id_tema_taller]);');
        PRINT 'FK [FK_talleres_tema_taller] creada.';
    END
    ELSE
        PRINT 'FK [FK_talleres_tema_taller] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('educacion_medica.[talleres]') AND name = 'IX_talleres_tema_taller')
        EXEC(N'CREATE INDEX [IX_talleres_tema_taller] ON educacion_medica.[talleres] ([id_tema_taller]);');

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[rutas_visitas]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[rutas_visitas]'), 'id_tipo_visita', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Tipo de visita (FK tipo_visita). NULL = Taller para datos históricos; los nuevos deben capturarlo.', 'SCHEMA', N'educacion_medica', 'TABLE', N'rutas_visitas', 'COLUMN', N'id_tipo_visita';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[talleres]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[talleres]'), 'id_tema_taller', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Tema/asunto del taller (FK tema_taller). Opcional; si está vacío, el tema se toma del producto.', 'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'id_tema_taller';

    -- =========================================================================
    -- 3) parametros_modulo: tipo / valor_texto + parámetros nuevos
    -- =========================================================================

    IF COL_LENGTH('educacion_medica.parametros_modulo', 'tipo') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[parametros_modulo] ADD [tipo] varchar(20) NOT NULL
            CONSTRAINT [DF_parametros_modulo_tipo] DEFAULT ('numero');
        PRINT 'Columna [parametros_modulo].[tipo] agregada.';
    END
    ELSE
        PRINT 'Columna [parametros_modulo].[tipo] ya existe. Skip.';

    IF COL_LENGTH('educacion_medica.parametros_modulo', 'valor_texto') IS NULL
    BEGIN
        ALTER TABLE educacion_medica.[parametros_modulo] ADD [valor_texto] nvarchar(100) NULL;
        PRINT 'Columna [parametros_modulo].[valor_texto] agregada.';
    END
    ELSE
        PRINT 'Columna [parametros_modulo].[valor_texto] ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND name = 'CK_parametros_modulo_tipo')
        EXEC(N'ALTER TABLE educacion_medica.[parametros_modulo] ADD CONSTRAINT [CK_parametros_modulo_tipo]
            CHECK ([tipo] IN (''numero'', ''booleano'', ''texto'', ''enum''));');

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[parametros_modulo]'), 'tipo', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Tipo del parámetro: numero | booleano | texto | enum. Los históricos son numero.', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'tipo';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('educacion_medica.[parametros_modulo]') AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[parametros_modulo]'), 'valor_texto', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'Valor para parámetros texto/enum (p. ej. SELECCION). NULL en los numéricos.', 'SCHEMA', N'educacion_medica', 'TABLE', N'parametros_modulo', 'COLUMN', N'valor_texto';

    -- Seeds con SQL dinámico: la tabla/columnas se acaban de crear.
    EXEC(N'
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''producto_cantidad_default'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''producto_cantidad_default'', 2, ''numero'', NULL, N''Cantidad default del recurso Producto en el alta de taller (editable).'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''alcance_hospital_extraordinario'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''alcance_hospital_extraordinario'', 0, ''enum'', N''SELECCION'', N''Alcance del hospital extraordinario: EJECUTIVO | GERENCIA | SELECCION | CATALOGO.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''matriz_requiere_autorizacion'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''matriz_requiere_autorizacion'', 1, ''booleano'', NULL, N''1 = la matriz pasa por autorización; 0 = solo candado.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''bloqueo_taller_automatico'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''bloqueo_taller_automatico'', 1, ''booleano'', NULL, N''1 = al autorizar la matriz los talleres se bloquean automáticamente.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''min_visitas_ejecutivo_semana'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''min_visitas_ejecutivo_semana'', 0, ''numero'', NULL, N''Mínimo de visitas por ejecutivo por semana; 0 = sin mínimo.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''min_visitas_ejecutivo_mes'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''min_visitas_ejecutivo_mes'', 0, ''numero'', NULL, N''Mínimo de visitas por ejecutivo por mes; 0 = sin mínimo.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''min_hospitales_por_zona'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''min_hospitales_por_zona'', 4, ''numero'', NULL, N''Mínimo recomendado de hospitales por zona en viaje foráneo.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''min_hospitales_especialista_semana'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''min_hospitales_especialista_semana'', 4, ''numero'', NULL, N''Cuota documentada: hospitales por especialista por semana.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''min_talleres_especialista_semana'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''min_talleres_especialista_semana'', 6, ''numero'', NULL, N''Cuota documentada: talleres por especialista por semana.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''meta_talleres_mes_imss'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''meta_talleres_mes_imss'', 64, ''numero'', NULL, N''Meta mensual configurable para IMSS.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''meta_talleres_mes_bienestar'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''meta_talleres_mes_bienestar'', 64, ''numero'', NULL, N''Meta mensual configurable para IMSS Bienestar.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''meta_talleres_mes_descentralizado'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''meta_talleres_mes_descentralizado'', 64, ''numero'', NULL, N''Meta mensual configurable para Descentralizado.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''umbral_cambio_costo_reautorizacion'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''umbral_cambio_costo_reautorizacion'', 0, ''numero'', NULL, N''Delta de costo que obliga a reautorizar la matriz; 0 = sin umbral.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''permite_cambio_hospital'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''permite_cambio_hospital'', 1, ''booleano'', NULL, N''1 = la solicitud de taller puede cambiar el hospital dentro del alcance permitido.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''permite_cambio_producto'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''permite_cambio_producto'', 1, ''booleano'', NULL, N''1 = la solicitud de taller puede cambiar producto/cantidad y recalcular costos.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_misma_ciudad_dia'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_misma_ciudad_dia'', 100, ''numero'', NULL, N''Puntos cuando el especialista ya tiene visita en la misma ciudad el mismo día.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_misma_ciudad_cerca'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_misma_ciudad_cerca'', 50, ''numero'', NULL, N''Puntos cuando el especialista tiene visita en la misma ciudad dentro de la ventana de cercanía.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_misma_institucion'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_misma_institucion'', 25, ''numero'', NULL, N''Puntos cuando el especialista tiene visita en la misma institución dentro de la ventana de cercanía.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_penalizacion_dia_consecutivo'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_penalizacion_dia_consecutivo'', 20, ''numero'', NULL, N''Puntos que se restan cuando el especialista tiene visita el día anterior o siguiente.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_factor_carga_semana'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_factor_carga_semana'', 1, ''numero'', NULL, N''Puntos que se restan por cada visita del especialista en la semana.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_factor_carga_mes'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_factor_carga_mes'', 1, ''numero'', NULL, N''Puntos que se restan por cada visita del especialista en el mes.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_ventana_dias_cercania'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_ventana_dias_cercania'', 1, ''numero'', NULL, N''Días hacia atrás y adelante para considerar misma ciudad o institución cercana.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_historial_hospital'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_historial_hospital'', 5, ''numero'', NULL, N''Puntos por cada visita realizada al mismo hospital; se cuentan hasta 3 visitas.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_historial_institucion'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_historial_institucion'', 5, ''numero'', NULL, N''Puntos una vez cuando el especialista ya visitó otro hospital de la misma institución.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_historial_ciudad'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_historial_ciudad'', 3, ''numero'', NULL, N''Puntos por cada visita realizada en la misma ciudad; se cuentan hasta 3 visitas.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_peso_historial_region'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_peso_historial_region'', 2, ''numero'', NULL, N''Puntos por cada visita realizada en la misma región; se cuentan hasta 3 visitas.'');

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_modulo WHERE clave = ''sugerencia_tope_historial'')
        INSERT INTO educacion_medica.parametros_modulo (clave, valor, tipo, valor_texto, descripcion)
        VALUES (''sugerencia_tope_historial'', 25, ''numero'', NULL, N''Máximo de puntos que puede aportar el historial completo a una sugerencia.'');');
    PRINT 'Parámetros del calendario sembrados/verificados.';

    COMMIT TRANSACTION;
    PRINT '0035 completado: catálogos de calendario y parámetros.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0035: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

-- =============================================================================
-- VERIFICACIÓN (ejecutar aparte)
-- =============================================================================
-- SELECT * FROM educacion_medica.tipo_visita ORDER BY id_tipo_visita;
-- SELECT clave, valor, tipo, valor_texto FROM educacion_medica.parametros_modulo ORDER BY clave;
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'educacion_medica' AND TABLE_NAME = 'parametros_modulo';
