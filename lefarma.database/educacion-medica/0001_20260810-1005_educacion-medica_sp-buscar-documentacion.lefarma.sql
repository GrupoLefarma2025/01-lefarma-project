-- ============================================================
-- 0004_20260810-1005_educacion-medica_sp-buscar-documentacion.lefarma.sql
-- Descripcion: Stored procedure de busqueda y exploracion dinamica
--              sobre la documentacion y metadatos del sistema.
--              Soporta navegacion por tipo de busqueda (BD, SCHEMA,
--              TABLA, COLUMNA, PROCEDIMIENTO, VISTA, FUNCION) o 
--              detalles de componentes especificos.
--              Si @base_de_datos es NULL, busca en TODAS las BDs de usuario.
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (toda la familia lefarma).
-- Convenciones del repo: snake_case, guardas idempotentes, documentacion
--   con extended properties MS_Description.
-- Uso en Report Builder / SSRS:
--   EXEC dbo.sp_buscar_documentacion @tipo_de_busqueda = N'TODOS'; -- Busca en todas las BDs y todos los schemas
--   EXEC dbo.sp_buscar_documentacion @tipo_de_busqueda = N'SCHEMAS', @base_de_datos = N'Lefarma';
--   EXEC dbo.sp_buscar_documentacion @tipo_de_busqueda = N'DETALLE_SCHEMA', @schema = N'educacion_medica', @base_de_datos = N'Lefarma';
--   EXEC dbo.sp_buscar_documentacion @tipo_de_busqueda = N'DETALLE_TABLA', @nombre = N'cat_medicos';
-- Seguridad: Las bases de datos se validan con DB_ID y se me escapa con QUOTENAME.
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.sp_buscar_documentacion
    @tipo_de_busqueda NVARCHAR(30)  = N'TODOS',  -- 'TODOS' | 'SCHEMAS' | 'DETALLE_SCHEMA' | 'TABLAS' | 'DETALLE_TABLA' | 'COLUMNAS' | 'PROCEDIMIENTOS' | 'VISTAS' | 'FUNCIONES'
    @nombre           NVARCHAR(255) = NULL,     -- Busqueda LIKE sobre nombre del objeto / filtro exacto segun contexto (NULL = todos)
    @tipo             NVARCHAR(20)  = NULL,     -- Filtro opcional por tipo en vistas generales (NULL = todos)
    @fecha_creacion   DATE          = NULL,     -- Fecha exacta de creacion del objeto (NULL = todas)
    @schema           NVARCHAR(128) = NULL,     -- Nombre del schema (NULL = todos)
    @base_de_datos    NVARCHAR(128) = NULL      -- Nombre de la BD (NULL / vacio = TODAS las bases de datos de usuario)
AS
BEGIN
    SET NOCOUNT ON;

    -- Normalizacion del parametro principal
    SET @tipo_de_busqueda = UPPER(ISNULL(@tipo_de_busqueda, N'TODOS'));
    SET @base_de_datos    = NULLIF(LTRIM(RTRIM(@base_de_datos)), N'');
    SET @schema          = NULLIF(LTRIM(RTRIM(@schema)), N'');
    SET @nombre          = NULLIF(LTRIM(RTRIM(@nombre)), N'');
    SET @tipo            = NULLIF(LTRIM(RTRIM(@tipo)), N'');

    ------------------------------------------------------------------
    -- 1. IDENTIFICAR BASES DE DATOS A CONSULTAR
    ------------------------------------------------------------------
    DECLARE @dbs TABLE (
        db_name NVARCHAR(128),
        db_id   INT
    );

    IF @base_de_datos IS NOT NULL
    BEGIN
        IF DB_ID(@base_de_datos) IS NULL
        BEGIN
            RAISERROR('La base de datos especificada no existe: %s', 16, 1, @base_de_datos);
            RETURN;
        END

        INSERT INTO @dbs (db_name, db_id)
        VALUES (@base_de_datos, DB_ID(@base_de_datos));
    END
    ELSE
    BEGIN
        -- Si no se especifica BD, se buscan en TODAS las bases de datos de usuario activas y accesibles
        INSERT INTO @dbs (db_name, db_id)
        SELECT name, database_id
        FROM sys.databases
        WHERE state = 0 -- ONLINE
          AND HAS_DBACCESS(name) = 1
          AND name NOT IN (N'master', N'tempdb', N'model', N'msdb');
    END

    ------------------------------------------------------------------
    -- 2. TABLA TEMPORAL PARA UNIFICAR RESULTADOS
    ------------------------------------------------------------------
    IF OBJECT_ID('tempdb..#ResultadosDocumentacion') IS NOT NULL
        DROP TABLE #ResultadosDocumentacion;

    CREATE TABLE #ResultadosDocumentacion (
        [base_de_datos]  NVARCHAR(128),
        [schema]         NVARCHAR(128),
        [tipo]           NVARCHAR(30),
        [nombre]         NVARCHAR(255),
        [columna]        NVARCHAR(255),
        [tipo_dato]      NVARCHAR(128),
        [fecha_creacion] DATE,
        [descripcion]    NVARCHAR(MAX)
    );

    ------------------------------------------------------------------
    -- 3. ITERAR Y CONSTRUIR CONSULTA DINAMICA POR BASE DE DATOS
    ------------------------------------------------------------------
    DECLARE @curr_db NVARCHAR(128);
    DECLARE @curr_db_id INT;

    DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT db_name, db_id FROM @dbs;

    OPEN db_cursor;
    FETCH NEXT FROM db_cursor INTO @curr_db, @curr_db_id;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- A. SCHEMAS
        DECLARE @sql_schemas NVARCHAR(MAX) = N'
            SELECT  @pdb AS [base_de_datos],
                    s.name AS [schema],
                    N''SCHEMA'' AS [tipo],
                    s.name AS [nombre],
                    NULL AS [columna],
                    NULL AS [tipo_dato],
                    NULL AS [fecha_creacion],
                    CAST(ep.value AS NVARCHAR(MAX)) AS [descripcion]
            FROM ' + QUOTENAME(@curr_db) + N'.sys.schemas s
            LEFT JOIN ' + QUOTENAME(@curr_db) + N'.sys.extended_properties ep
                ON ep.major_id = s.schema_id AND ep.class = 3 AND ep.name = N''MS_Description''
            WHERE (@pschema IS NULL OR s.name = @pschema)
              AND (@pnombre IS NULL OR s.name LIKE N''%'' + @pnombre + N''%'')';

        -- B. TABLAS
        DECLARE @sql_tablas NVARCHAR(MAX) = N'
            SELECT  @pdb AS [base_de_datos],
                    OBJECT_SCHEMA_NAME(t.object_id, @pdb_id) AS [schema],
                    N''TABLA'' AS [tipo],
                    t.name AS [nombre],
                    NULL AS [columna],
                    NULL AS [tipo_dato],
                    CAST(t.create_date AS DATE) AS [fecha_creacion],
                    CAST(ep.value AS NVARCHAR(MAX)) AS [descripcion]
            FROM ' + QUOTENAME(@curr_db) + N'.sys.tables t
            LEFT JOIN ' + QUOTENAME(@curr_db) + N'.sys.extended_properties ep
                ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = N''MS_Description''
            WHERE (@pschema IS NULL OR OBJECT_SCHEMA_NAME(t.object_id, @pdb_id) = @pschema)
              AND (@pfecha IS NULL OR CAST(t.create_date AS DATE) = @pfecha)
              AND (@pnombre IS NULL OR t.name LIKE N''%'' + @pnombre + N''%'')';

        -- C. COLUMNAS / DETALLE_TABLA
        DECLARE @sql_columnas NVARCHAR(MAX) = N'
            SELECT  @pdb AS [base_de_datos],
                    OBJECT_SCHEMA_NAME(t.object_id, @pdb_id) AS [schema],
                    N''COLUMNA'' AS [tipo],
                    t.name AS [nombre],
                    c.name AS [columna],
                    ty.name AS [tipo_dato],
                    CAST(t.create_date AS DATE) AS [fecha_creacion],
                    CAST(ep.value AS NVARCHAR(MAX)) AS [descripcion]
            FROM ' + QUOTENAME(@curr_db) + N'.sys.tables t
            JOIN ' + QUOTENAME(@curr_db) + N'.sys.columns c ON c.object_id = t.object_id
            LEFT JOIN ' + QUOTENAME(@curr_db) + N'.sys.types ty ON ty.user_type_id = c.user_type_id
            LEFT JOIN ' + QUOTENAME(@curr_db) + N'.sys.extended_properties ep
                ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N''MS_Description''
            WHERE (@pschema IS NULL OR OBJECT_SCHEMA_NAME(t.object_id, @pdb_id) = @pschema)
              AND (@pfecha IS NULL OR CAST(t.create_date AS DATE) = @pfecha)
              AND (
                  (@ptipo_busqueda = N''DETALLE_TABLA'' AND t.name = @pnombre)
                  OR (@ptipo_busqueda <> N''DETALLE_TABLA'' AND (@pnombre IS NULL OR t.name LIKE N''%'' + @pnombre + N''%'' OR c.name LIKE N''%'' + @pnombre + N''%''))
              )';

        -- D. PROCEDIMIENTOS ALMACENADOS
        DECLARE @sql_procedimientos NVARCHAR(MAX) = N'
            SELECT  @pdb AS [base_de_datos],
                    OBJECT_SCHEMA_NAME(p.object_id, @pdb_id) AS [schema],
                    N''PROCEDIMIENTO'' AS [tipo],
                    p.name AS [nombre],
                    NULL AS [columna],
                    NULL AS [tipo_dato],
                    CAST(p.create_date AS DATE) AS [fecha_creacion],
                    CAST(ep.value AS NVARCHAR(MAX)) AS [descripcion]
            FROM ' + QUOTENAME(@curr_db) + N'.sys.procedures p
            LEFT JOIN ' + QUOTENAME(@curr_db) + N'.sys.extended_properties ep
                ON ep.major_id = p.object_id AND ep.minor_id = 0 AND ep.name = N''MS_Description''
            WHERE (@pschema IS NULL OR OBJECT_SCHEMA_NAME(p.object_id, @pdb_id) = @pschema)
              AND (@pfecha IS NULL OR CAST(p.create_date AS DATE) = @pfecha)
              AND (@pnombre IS NULL OR p.name LIKE N''%'' + @pnombre + N''%'')';

        -- E. VISTAS
        DECLARE @sql_vistas NVARCHAR(MAX) = N'
            SELECT  @pdb AS [base_de_datos],
                    OBJECT_SCHEMA_NAME(v.object_id, @pdb_id) AS [schema],
                    N''VISTA'' AS [tipo],
                    v.name AS [nombre],
                    NULL AS [columna],
                    NULL AS [tipo_dato],
                    CAST(v.create_date AS DATE) AS [fecha_creacion],
                    CAST(ep.value AS NVARCHAR(MAX)) AS [descripcion]
            FROM ' + QUOTENAME(@curr_db) + N'.sys.views v
            LEFT JOIN ' + QUOTENAME(@curr_db) + N'.sys.extended_properties ep
                ON ep.major_id = v.object_id AND ep.minor_id = 0 AND ep.name = N''MS_Description''
            WHERE (@pschema IS NULL OR OBJECT_SCHEMA_NAME(v.object_id, @pdb_id) = @pschema)
              AND (@pfecha IS NULL OR CAST(v.create_date AS DATE) = @pfecha)
              AND (@pnombre IS NULL OR v.name LIKE N''%'' + @pnombre + N''%'')';

        -- F. FUNCIONES
        DECLARE @sql_funciones NVARCHAR(MAX) = N'
            SELECT  @pdb AS [base_de_datos],
                    OBJECT_SCHEMA_NAME(f.object_id, @pdb_id) AS [schema],
                    N''FUNCION'' AS [tipo],
                    f.name AS [nombre],
                    NULL AS [columna],
                    NULL AS [tipo_dato],
                    CAST(f.create_date AS DATE) AS [fecha_creacion],
                    CAST(ep.value AS NVARCHAR(MAX)) AS [descripcion]
            FROM ' + QUOTENAME(@curr_db) + N'.sys.objects f
            LEFT JOIN ' + QUOTENAME(@curr_db) + N'.sys.extended_properties ep
                ON ep.major_id = f.object_id AND ep.minor_id = 0 AND ep.name = N''MS_Description''
            WHERE f.type IN (N''FN'', N''IF'', N''TF'', N''AF'')
              AND (@pschema IS NULL OR OBJECT_SCHEMA_NAME(f.object_id, @pdb_id) = @pschema)
              AND (@pfecha IS NULL OR CAST(f.create_date AS DATE) = @pfecha)
              AND (@pnombre IS NULL OR f.name LIKE N''%'' + @pnombre + N''%'')';

        -- Ruteo segun @tipo_de_busqueda para la BD actual
        DECLARE @sql_union NVARCHAR(MAX) = N'';

        IF @tipo_de_busqueda = N'SCHEMAS'
            SET @sql_union = @sql_schemas;
        ELSE IF @tipo_de_busqueda = N'TABLAS'
            SET @sql_union = @sql_tablas;
        ELSE IF @tipo_de_busqueda = N'COLUMNAS'
            SET @sql_union = @sql_columnas;
        ELSE IF @tipo_de_busqueda = N'PROCEDIMIENTOS'
            SET @sql_union = @sql_procedimientos;
        ELSE IF @tipo_de_busqueda = N'VISTAS'
            SET @sql_union = @sql_vistas;
        ELSE IF @tipo_de_busqueda = N'FUNCIONES'
            SET @sql_union = @sql_funciones;
        ELSE IF @tipo_de_busqueda = N'DETALLE_TABLA'
            SET @sql_union = @sql_columnas;
        ELSE IF @tipo_de_busqueda = N'DETALLE_SCHEMA'
            SET @sql_union = @sql_tablas + N' UNION ALL ' + 
                             @sql_procedimientos + N' UNION ALL ' + 
                             @sql_vistas + N' UNION ALL ' + 
                             @sql_funciones;
        ELSE -- 'TODOS' o parametro indeterminado
            SET @sql_union = @sql_tablas + N' UNION ALL ' + 
                             @sql_columnas + N' UNION ALL ' + 
                             @sql_procedimientos + N' UNION ALL ' + 
                             @sql_vistas + N' UNION ALL ' + 
                             @sql_funciones;

        -- Insercion en la tabla temporal para la BD actual
        DECLARE @sql_insert NVARCHAR(MAX) = N'
            INSERT INTO #ResultadosDocumentacion (
                [base_de_datos], [schema], [tipo], [nombre], [columna], [tipo_dato], [fecha_creacion], [descripcion]
            )
            SELECT d.[base_de_datos], d.[schema], d.[tipo], d.[nombre], d.[columna], d.[tipo_dato], d.[fecha_creacion], d.[descripcion]
            FROM ( ' + @sql_union + N' ) d
            WHERE (@ptipo IS NULL OR d.[tipo] = @ptipo);';

        EXEC sp_executesql @sql_insert,
            N'@pnombre NVARCHAR(255), @ptipo NVARCHAR(20), @pfecha DATE, @pschema NVARCHAR(128), @pdb NVARCHAR(128), @pdb_id INT, @ptipo_busqueda NVARCHAR(30)',
            @pnombre = @nombre, 
            @ptipo = @tipo, 
            @pfecha = @fecha_creacion,
            @pschema = @schema, 
            @pdb = @curr_db, 
            @pdb_id = @curr_db_id,
            @ptipo_busqueda = @tipo_de_busqueda;

        FETCH NEXT FROM db_cursor INTO @curr_db, @curr_db_id;
    END

    CLOSE db_cursor;
    DEALLOCATE db_cursor;

    ------------------------------------------------------------------
    -- 4. RESULTADO FINAL CONJUNTO
    ------------------------------------------------------------------
    SELECT 
        [base_de_datos], 
        [schema], 
        [tipo], 
        [nombre], 
        [columna], 
        [tipo_dato], 
        [fecha_creacion], 
        [descripcion]
    FROM #ResultadosDocumentacion
    ORDER BY [base_de_datos], [schema], [tipo], [nombre], ISNULL([columna], N'');

END
GO

-- ============================================================
-- Documentacion del procedimiento (extended property MS_Description)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('dbo.sp_buscar_documentacion') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Busqueda dinamica de metadatos/documentacion homologada para Report Builder. Si @base_de_datos o @schema es NULL, realiza la busqueda en todas las BDs y schemas correspondientes.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'sp_buscar_documentacion';
GO