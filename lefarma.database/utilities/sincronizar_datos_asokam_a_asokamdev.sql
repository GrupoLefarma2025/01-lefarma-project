/* ============================================================================
   Sincronizar datos de Asokam -> AsokamDev
   ----------------------------------------------------------------------------
   Objetivo:
   Dejar AsokamDev con los MISMOS datos que Asokam (producción) en todas las
   tablas que existen en ambas bases, para pruebas.

   Qué hace:
   - Crea en AsokamDev las 8 tablas que faltan (las que ya existen no se tocan):
     app.ConcentradoRespuestaLog, app.ConcentradoRespuestaOCLog,
     app.correo_cuentas, dbo.envioEmailsCopia, dbo.ligasConferencia, dbo.test,
     viaticos.municipios_cat (crea también el schema viaticos) y
     viaticos.municipios_osm_staging.
   - Copia los datos de todas las tablas que existen en AMBAS bases.
   - Fuera de esas 8 tablas NO crea, altera ni elimina nada: ni columnas,
     índices, vistas ni procedimientos. Si otro objeto no existe en AsokamDev,
     se omite.
   - Reemplaza el contenido de cada tabla común (DELETE + INSERT), respetando
     columnas IDENTITY y resembrando el contador.
   - Conserva las filas padre que estén referenciadas por tablas exclusivas de
     AsokamDev (hoy no hay ninguna, pero la lógica queda por seguridad).
   - Deshabilita FKs y triggers durante la carga y los vuelve a habilitar.
   - Al final compara fila por fila el conteo origen vs destino y revisa
     violaciones de FK/CHECK.
   - Respalda AsokamDev antes de modificar datos (opcional).

   Objetos que se omiten a propósito:
   - app.Documentos            -> 7.9 GB; opcional con @OmitirDocumentos
   - app.SchemaVersions        -> journal de migraciones
   - dbo.__EFMigrationsHistory -> journal de EF
   - schema mcp_undo           -> copias de seguridad del MCP de SQL

   ADVERTENCIAS:
   1) Detén el backend y cualquier cliente conectado a AsokamDev antes de
      ejecutar en modo real.
   2) app.Documentos son ~7.9 GB: si lo copias, el archivo de datos de
      AsokamDev crece varios GB y el log necesita espacio libre equivalente.
      Con @OmitirDocumentos = 1 lo saltas (el resto queda idéntico).
   3) Todo el cambio corre en UNA transacción; si algo falla hace ROLLBACK.
   4) Por defecto el script SOLO DIAGNOSTICA. Para ejecutarlo:
         SET @SoloDiagnostico = 0;
         SET @Confirmar = 1;
   5) Si BACKUP DATABASE no está permitido para tu usuario, toma un respaldo
      manual y pon @HacerRespaldo = 0.
   6) Las 8 tablas de la SECCIÓN 0 se crean en AsokamDev antes de copiar sus
      datos (incluye crear el schema viaticos). Con @CrearTablasFaltantes = 0
      no se crean y se siguen reportando como omitidas.
   ============================================================================ */

/* ----------------------------------------------------------------------------
   Limpieza de tablas temporales de corridas anteriores.
   Va en su PROPIO lote (GO) a propósito: si un #Common viejo sigue vivo en la
   sesión, SQL Server compila el resto del script contra su estructura anterior
   y falla con "Invalid column name". Borrándolo antes de compilar el cuerpo,
   el script se puede re-ejecutar en la misma ventana sin errores.
   ---------------------------------------------------------------------------- */
DROP TABLE IF EXISTS #ACrear, #Common, #FKs, #Triggers, #Omitidas, #Trunc,
                     #Verificacion, #Fallidas;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @SourceDb sysname = N'Asokam';
DECLARE @TargetDb sysname = N'AsokamDev';

-- 1 = solo muestra qué haría; 0 = ejecuta
DECLARE @SoloDiagnostico bit = 1;
-- Debe cambiarse a 1 junto con @SoloDiagnostico = 0
DECLARE @Confirmar bit = 0;
-- Respaldo automático de AsokamDev antes de tocar datos
DECLARE @HacerRespaldo bit = 1;
-- Poner la base destino en SIMPLE mientras corre la copia (evita que el log
-- crezca varios GB). Se restaura el modelo original al terminar.
DECLARE @OptimizarLog bit = 1;
-- 1 = no copia app.Documentos (la tabla más pesada, ~7.9 GB)
DECLARE @OmitirDocumentos bit = 0;

DECLARE @BackupDir nvarchar(4000);
DECLARE @BackupFile nvarchar(4000);
DECLARE @recoveryOriginal nvarchar(60);
DECLARE @sql nvarchar(max);
DECLARE @msg nvarchar(2048);
DECLARE @error nvarchar(2048) = NULL;
DECLARE @numCommon int;
DECLARE @numMerge int;
DECLARE @numFKs int;
DECLARE @numTriggers int;
DECLARE @numVerif int;
DECLARE @numDif int;
DECLARE @numOmitidas int;
DECLARE @numACrear int;
DECLARE @sumDestino bigint;

IF DB_ID(@SourceDb) IS NULL
    THROW 50001, 'No existe la base origen (Asokam).', 1;

IF DB_ID(@TargetDb) IS NULL
    THROW 50002, 'No existe la base destino (AsokamDev).', 1;

IF @SourceDb = @TargetDb
    THROW 50003, 'La base origen y destino no pueden ser la misma.', 1;

IF @TargetDb IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 50004, 'El destino no puede ser una base del sistema.', 1;

IF @SoloDiagnostico = 0 AND @Confirmar <> 1
    THROW 50006, 'Cambia @Confirmar = 1 para ejecutar el refresco real.', 1;

USE [AsokamDev];

IF DB_NAME() <> @TargetDb
    THROW 50007, 'No se pudo cambiar el contexto a AsokamDev.', 1;

/* ============================================================================
   SECCIÓN 0: TABLAS QUE FALTAN EN ASOKAMDEV
   ----------------------------------------------------------------------------
   Estas 8 tablas existen en Asokam y no existen en AsokamDev. El script las
   crea con la MISMA definición del origen (columnas, tipos, IDENTITY,
   defaults, PK, UNIQUE e índices) y después copia sus datos como cualquier
   otra tabla.

   Es idempotente: cada CREATE está protegido con IF OBJECT_ID(...) IS NULL,
   así que en una segunda corrida no hace nada.

   Con @CrearTablasFaltantes = 0 se omite esta sección (se reportan como
   omitidas, igual que antes).
   ============================================================================ */
DECLARE @CrearTablasFaltantes bit = 1;

CREATE TABLE #ACrear
(
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    FilasOrigen bigint NULL,
    Creada bit NOT NULL DEFAULT (0),
    PRIMARY KEY (SchemaName, TableName)
);

-- Solo se listan las que de verdad faltan en el destino.
INSERT INTO #ACrear (SchemaName, TableName, FilasOrigen)
SELECT v.SchemaName, v.TableName,
       ISNULL((
           SELECT SUM(p.rows)
           FROM [Asokam].sys.partitions p
           WHERE p.object_id = OBJECT_ID(
                     QUOTENAME(@SourceDb) + N'.' + QUOTENAME(v.SchemaName)
                     + N'.' + QUOTENAME(v.TableName))
             AND p.index_id IN (0, 1)
       ), 0)
FROM (VALUES
    (N'app',      N'ConcentradoRespuestaLog'),
    (N'app',      N'ConcentradoRespuestaOCLog'),
    (N'app',      N'correo_cuentas'),
    (N'dbo',      N'envioEmailsCopia'),
    (N'dbo',      N'ligasConferencia'),
    (N'dbo',      N'test'),
    (N'viaticos', N'municipios_cat'),
    (N'viaticos', N'municipios_osm_staging')
) AS v (SchemaName, TableName)
WHERE OBJECT_ID(
          QUOTENAME(@TargetDb) + N'.' + QUOTENAME(v.SchemaName)
          + N'.' + QUOTENAME(v.TableName)) IS NULL;

IF @CrearTablasFaltantes = 1 AND @SoloDiagnostico = 0
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        -- El schema viaticos no existe en AsokamDev.
        -- CREATE SCHEMA debe ser la única sentencia del lote -> EXEC dinámico.
        IF SCHEMA_ID(N'viaticos') IS NULL
            EXEC sys.sp_executesql N'CREATE SCHEMA [viaticos] AUTHORIZATION [dbo];';

        -- app.ConcentradoRespuestaLog
        IF OBJECT_ID(N'app.ConcentradoRespuestaLog') IS NULL
        CREATE TABLE [app].[ConcentradoRespuestaLog]
        (
            [id_log]           int IDENTITY(1,1) NOT NULL,
            [fecha_registro]   datetime NOT NULL
                               CONSTRAINT [DF_ConcentradoRespuestaLog_fecha_registro] DEFAULT (getdate()),
            [id_concentrado]   int NOT NULL,
            [id_documento]     uniqueidentifier NULL,
            [documentos_json]  nvarchar(max) NULL,
            [token_seguridad]  varchar(255) NOT NULL,
            [id_usuario]       int NOT NULL,
            [accion]           varchar(20) NOT NULL,
            [comentario]       varchar(max) NULL,
            [json_enviado]     varchar(max) NULL,
            [http_status]      int NULL,
            [response]         varchar(max) NULL,
            [error_detalle]    varchar(2000) NULL,
            [exitoso]          bit NULL,
            CONSTRAINT [PK_ConcentradoRespuestaLog] PRIMARY KEY CLUSTERED ([id_log] ASC)
        );

        -- app.ConcentradoRespuestaOCLog
        IF OBJECT_ID(N'app.ConcentradoRespuestaOCLog') IS NULL
        CREATE TABLE [app].[ConcentradoRespuestaOCLog]
        (
            [id_log]           int IDENTITY(1,1) NOT NULL,
            [fecha_registro]   datetime NOT NULL
                               CONSTRAINT [DF_ConcentradoRespuestaOCLog_fecha_registro] DEFAULT (getdate()),
            [id_concentrado]   int NOT NULL,
            [id_documento]     uniqueidentifier NULL,
            [documentos_json]  nvarchar(max) NULL,
            [token_seguridad]  varchar(255) NOT NULL,
            [id_usuario]       int NOT NULL,
            [accion]           varchar(20) NOT NULL,
            [comentario]       varchar(max) NULL,
            [json_enviado]     varchar(max) NULL,
            [http_status]      int NULL,
            [response]         varchar(max) NULL,
            [error_detalle]    varchar(2000) NULL,
            [exitoso]          bit NULL,
            CONSTRAINT [PK_ConcentradoRespuestaOCLog] PRIMARY KEY CLUSTERED ([id_log] ASC)
        );

        -- app.correo_cuentas
        IF OBJECT_ID(N'app.correo_cuentas') IS NULL
        CREATE TABLE [app].[correo_cuentas]
        (
            [id_cuenta]              int IDENTITY(1,1) NOT NULL,
            [correo]                 varchar(256) NOT NULL,
            [nombre_remitente]       nvarchar(256) NOT NULL
                                     CONSTRAINT [DF_correo_cuentas_nombre] DEFAULT (N'Grupo Lefarma'),
            [smtp_servidor]          varchar(256) NOT NULL
                                     CONSTRAINT [DF_correo_cuentas_host] DEFAULT ('mail.grupolefarma.com.mx'),
            [smtp_puerto]            int NOT NULL
                                     CONSTRAINT [DF_correo_cuentas_puerto] DEFAULT ((587)),
            [usar_ssl]               bit NOT NULL
                                     CONSTRAINT [DF_correo_cuentas_ssl] DEFAULT ((1)),
            [aceptar_cert_invalidos] bit NOT NULL
                                     CONSTRAINT [DF_correo_cuentas_certs] DEFAULT ((1)),
            [timeout_ms]             int NOT NULL
                                     CONSTRAINT [DF_correo_cuentas_timeout] DEFAULT ((30000)),
            [password_cifrada]       varbinary(512) NOT NULL,
            [activo]                 bit NOT NULL
                                     CONSTRAINT [DF_correo_cuentas_activo] DEFAULT ((1)),
            [fecha_creacion]         datetime NOT NULL
                                     CONSTRAINT [DF_correo_cuentas_fc] DEFAULT (getdate()),
            [fecha_modificacion]     datetime NULL,
            CONSTRAINT [PK_correo_cuentas] PRIMARY KEY CLUSTERED ([id_cuenta] ASC),
            CONSTRAINT [UQ_correo_cuentas_correo] UNIQUE ([correo] ASC)
        );

        -- dbo.envioEmailsCopia (en el origen no tiene PK: se replica igual)
        IF OBJECT_ID(N'dbo.envioEmailsCopia') IS NULL
        CREATE TABLE [dbo].[envioEmailsCopia]
        (
            [codigoEmail]     int IDENTITY(1,1) NOT NULL,
            [fechaSolicitud]  datetime NOT NULL,
            [para]            varchar(1024) NOT NULL,
            [conCopiaOculta]  varchar(1024) NOT NULL,
            [subject]         varchar(1024) NOT NULL,
            [body]            varchar(max) NOT NULL,
            [fechaEnvio]      datetime NOT NULL
        );

        -- dbo.ligasConferencia
        IF OBJECT_ID(N'dbo.ligasConferencia') IS NULL
        CREATE TABLE [dbo].[ligasConferencia]
        (
            [nombre]  varchar(50) NOT NULL,
            [liga]    varchar(1024) NULL,
            [id]      varchar(15) NULL,
            [codigo]  varchar(10) NULL,
            CONSTRAINT [PK_ligasConferencia] PRIMARY KEY CLUSTERED ([nombre] ASC)
        );

        -- dbo.test (en el origen no tiene PK: se replica igual)
        IF OBJECT_ID(N'dbo.test') IS NULL
        CREATE TABLE [dbo].[test]
        (
            [id_usuario]                      int NOT NULL,
            [id_empresa]                      int NOT NULL,
            [id_sucursal]                     int NOT NULL,
            [id_area]                         int NULL,
            [id_centro_costo]                 int NULL,
            [puesto]                          varchar(150) NULL,
            [numero_empleado]                 varchar(50) NULL,
            [firma_digital]                   nvarchar(max) NULL,
            [telefono_oficina]                varchar(20) NULL,
            [extension]                       varchar(10) NULL,
            [celular]                         varchar(20) NULL,
            [telegram_chat]                   nvarchar(200) NULL,
            [notificar_email]                 bit NULL,
            [notificar_app]                   bit NULL,
            [notificar_whatsapp]              bit NULL,
            [notificar_sms]                   bit NULL,
            [notificar_telegram]              bit NULL,
            [notificar_solo_urgentes]         bit NULL,
            [notificar_resumen_diario]        bit NULL,
            [notificar_rechazos]              bit NULL,
            [notificar_vencimientos]          bit NULL,
            [id_usuario_delegado]             int NULL,
            [delegacion_hasta]                date NULL,
            [avatar_url]                      nvarchar(255) NULL,
            [tema_interfaz]                   varchar(20) NULL,
            [dashboard_inicio]                varchar(50) NULL,
            [activo]                          bit NULL,
            [fecha_creacion]                  datetime NULL,
            [fecha_modificacion]              datetime NULL,
            [firma_path]                      varchar(500) NULL,
            [firma_documento]                 bit NOT NULL,
            [destinatarios_incidencias_default] nvarchar(max) NULL,
            [firma_control]                   nvarchar(max) NULL
        );

        -- viaticos.municipios_cat
        IF OBJECT_ID(N'viaticos.municipios_cat') IS NULL
        CREATE TABLE [viaticos].[municipios_cat]
        (
            [id_municipio]       int IDENTITY(1,1) NOT NULL,
            [codigo_estado]      int NOT NULL,
            [nombre]             nvarchar(150) NOT NULL,
            [clave_municipio]    nvarchar(30) NULL,
            [latitud]            decimal(9,6) NULL,
            [longitud]           decimal(9,6) NULL,
            [activo]             bit NOT NULL
                                 CONSTRAINT [DF_municipios_cat_activo] DEFAULT ((1)),
            [fecha_creacion]     datetime2(7) NOT NULL
                                 CONSTRAINT [DF_municipios_cat_fecha_creacion] DEFAULT (sysutcdatetime()),
            [fecha_modificacion] datetime2(7) NOT NULL
                                 CONSTRAINT [DF_municipios_cat_fecha_modificacion] DEFAULT (sysutcdatetime()),
            CONSTRAINT [PK_municipios_cat] PRIMARY KEY CLUSTERED ([id_municipio] ASC),
            CONSTRAINT [UQ_municipios_cat_estado_nombre] UNIQUE ([codigo_estado] ASC, [nombre] ASC)
        );

        IF OBJECT_ID(N'viaticos.municipios_cat') IS NOT NULL
           AND NOT EXISTS (
               SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'viaticos.municipios_cat')
                 AND name = N'IX_municipios_cat_codigo_estado')
            CREATE NONCLUSTERED INDEX [IX_municipios_cat_codigo_estado]
                ON [viaticos].[municipios_cat] ([codigo_estado] ASC)
                INCLUDE ([nombre]);

        -- viaticos.municipios_osm_staging
        IF OBJECT_ID(N'viaticos.municipios_osm_staging') IS NULL
        CREATE TABLE [viaticos].[municipios_osm_staging]
        (
            [id_staging]      int IDENTITY(1,1) NOT NULL,
            [clave_municipio] nvarchar(30) NOT NULL,
            [codigo_estado]   int NOT NULL,
            [nombre]          nvarchar(150) NOT NULL,
            [latitud]         decimal(9,6) NULL,
            [longitud]        decimal(9,6) NULL,
            [cargado_en]      datetime2(7) NOT NULL
                              CONSTRAINT [DF_municipios_osm_staging_cargado_en] DEFAULT (sysutcdatetime()),
            CONSTRAINT [PK_municipios_osm_staging] PRIMARY KEY CLUSTERED ([id_staging] ASC)
        );

        COMMIT TRANSACTION;

        UPDATE #ACrear SET Creada = 1;

        SELECT @numACrear = COUNT(*) FROM #ACrear;
        PRINT N'Tablas creadas en ' + @TargetDb + N': '
            + CONVERT(nvarchar(20), @numACrear);
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;

        PRINT N'ERROR al crear las tablas faltantes: ' + ERROR_MESSAGE();
        THROW;
    END CATCH;
END
ELSE IF @CrearTablasFaltantes = 0 AND EXISTS (SELECT 1 FROM #ACrear)
BEGIN
    PRINT N'AVISO: faltan tablas en ' + @TargetDb
        + N' y @CrearTablasFaltantes = 0; se van a omitir.';
END;

/* ============================================================================
   SECCIÓN 1: TABLAS COMUNES
   ============================================================================ */
CREATE TABLE #Common
(
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    SourceObjectId int NOT NULL,
    TargetObjectId int NOT NULL,
    EsMerge bit NOT NULL DEFAULT (0),
    TieneIdentity bit NOT NULL DEFAULT (0),
    PRIMARY KEY (SchemaName, TableName)
);

INSERT INTO #Common (SchemaName, TableName, SourceObjectId, TargetObjectId)
SELECT ds.name, dt.name, st.object_id, dt.object_id
FROM sys.tables dt
INNER JOIN sys.schemas ds
    ON ds.schema_id = dt.schema_id
INNER JOIN [Asokam].sys.schemas ss
    ON ss.name = ds.name
INNER JOIN [Asokam].sys.tables st
    ON st.schema_id = ss.schema_id
   AND st.name = dt.name
WHERE dt.is_ms_shipped = 0
  AND ds.name <> N'mcp_undo'
  AND NOT (ds.name = N'app' AND dt.name = N'SchemaVersions')
  AND NOT (ds.name = N'dbo' AND dt.name = N'__EFMigrationsHistory')
  AND (@OmitirDocumentos = 0 OR NOT (ds.name = N'app' AND dt.name = N'Documentos'));

UPDATE c
SET TieneIdentity = 1
FROM #Common c
WHERE EXISTS (
    SELECT 1
    FROM sys.columns col
    WHERE col.object_id = c.TargetObjectId
      AND col.is_identity = 1
);

-- Tablas comunes que son padre de alguna tabla exclusiva de AsokamDev.
-- Se conservan sus filas actuales para no dejar huérfanas las tablas nuevas.
UPDATE c
SET EsMerge = 1
FROM #Common c
WHERE EXISTS (
    SELECT 1
    FROM sys.foreign_keys fk
    WHERE fk.referenced_object_id = c.TargetObjectId
      AND NOT EXISTS (
          SELECT 1
          FROM #Common child
          WHERE child.TargetObjectId = fk.parent_object_id
      )
);

-- Tablas del origen que no existen en el destino (se omiten y se reportan)
CREATE TABLE #Omitidas
(
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    FilasOrigen bigint NULL,
    Motivo nvarchar(300) NOT NULL
);

INSERT INTO #Omitidas (SchemaName, TableName, FilasOrigen, Motivo)
SELECT ss.name, st.name,
       ISNULL((SELECT SUM(p.rows) FROM [Asokam].sys.partitions p
        WHERE p.object_id = st.object_id AND p.index_id IN (0, 1)), 0),
       N'La tabla no existe en AsokamDev'
FROM [Asokam].sys.tables st
INNER JOIN [Asokam].sys.schemas ss
    ON ss.schema_id = st.schema_id
WHERE st.is_ms_shipped = 0
  AND OBJECT_ID(QUOTENAME(@TargetDb) + N'.' + QUOTENAME(ss.name) + N'.' + QUOTENAME(st.name)) IS NULL
  -- Las que crea la Sección 0 no se reportan como omitidas.
  AND NOT (@CrearTablasFaltantes = 1
           AND EXISTS (SELECT 1 FROM #ACrear a
                       WHERE a.SchemaName = ss.name AND a.TableName = st.name));

IF @OmitirDocumentos = 1
    INSERT INTO #Omitidas (SchemaName, TableName, FilasOrigen, Motivo)
    VALUES (N'app', N'Documentos', NULL, N'Omitida por @OmitirDocumentos = 1');

/* ============================================================================
   SECCIÓN 2: PREFLIGHT (no modifica nada)
   ============================================================================ */

-- 2.1 Columnas NOT NULL del destino que no existen en el origen y no tienen
--     default ni identity: el INSERT fallaría.
IF EXISTS (
    SELECT 1
    FROM #Common c
    INNER JOIN sys.columns dc
        ON dc.object_id = c.TargetObjectId
    LEFT JOIN [Asokam].sys.columns sc
        ON sc.object_id = c.SourceObjectId
       AND sc.name = dc.name
    WHERE dc.is_nullable = 0
      AND dc.is_identity = 0
      AND dc.is_computed = 0
      AND dc.generated_always_type = 0
      AND dc.default_object_id = 0
      AND sc.object_id IS NULL
)
BEGIN
    SELECT @msg = N'Columnas obligatorias del destino sin equivalente en Asokam: '
        + STUFF(
            (
                SELECT N', ' + c.SchemaName + N'.' + c.TableName + N'.' + dc.name
                FROM #Common c
                INNER JOIN sys.columns dc
                    ON dc.object_id = c.TargetObjectId
                LEFT JOIN [Asokam].sys.columns sc
                    ON sc.object_id = c.SourceObjectId
                   AND sc.name = dc.name
                WHERE dc.is_nullable = 0
                  AND dc.is_identity = 0
                  AND dc.is_computed = 0
                  AND dc.generated_always_type = 0
                  AND dc.default_object_id = 0
                  AND sc.object_id IS NULL
                ORDER BY c.SchemaName, c.TableName, dc.name
                FOR XML PATH(N''), TYPE
            ).value(N'.', N'nvarchar(max)'),
            1, 2, N''
        );

    THROW 50010, @msg, 1;
END;

-- 2.2 Columnas de texto donde el destino es más corto que el origen.
--     Si algún dato no cabe, el INSERT fallaría a media copia.
CREATE TABLE #Trunc
(
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    ColumnName sysname NOT NULL,
    TipoOrigen nvarchar(50) NOT NULL,
    TipoDestino nvarchar(50) NOT NULL,
    LargoDestino int NOT NULL,
    OidOrigen int NOT NULL,
    PRIMARY KEY (SchemaName, TableName, ColumnName)
);

INSERT INTO #Trunc
    (SchemaName, TableName, ColumnName, TipoOrigen, TipoDestino, LargoDestino, OidOrigen)
SELECT c.SchemaName, c.TableName, sc.name,
       sty.name + N'(' + CASE WHEN sc.max_length = -1 THEN N'max'
                             ELSE CONVERT(nvarchar(10), sc.max_length / CASE WHEN sty.name IN (N'nvarchar', N'nchar') THEN 2 ELSE 1 END) END + N')',
       st.name + N'(' + CASE WHEN dc.max_length = -1 THEN N'max'
                             ELSE CONVERT(nvarchar(10), dc.max_length / CASE WHEN st.name IN (N'nvarchar', N'nchar') THEN 2 ELSE 1 END) END + N')',
       dc.max_length / CASE WHEN st.name IN (N'nvarchar', N'nchar') THEN 2 ELSE 1 END,
       c.SourceObjectId
FROM #Common c
INNER JOIN sys.columns dc
    ON dc.object_id = c.TargetObjectId
INNER JOIN [Asokam].sys.columns sc
    ON sc.object_id = c.SourceObjectId
   AND sc.name = dc.name
INNER JOIN sys.types st
    ON st.user_type_id = dc.user_type_id
INNER JOIN [Asokam].sys.types sty
    ON sty.user_type_id = sc.user_type_id
WHERE dc.max_length <> -1
  AND sc.max_length > dc.max_length
  AND st.name IN (N'varchar', N'nvarchar', N'char', N'nchar', N'varbinary', N'binary');

DECLARE @tSchema sysname, @tTable sysname, @tCol sysname, @tMax int, @tLen int, @tObj int;

DECLARE curTrunc CURSOR LOCAL FAST_FORWARD FOR
    SELECT SchemaName, TableName, ColumnName, LargoDestino, OidOrigen FROM #Trunc;

OPEN curTrunc;
FETCH NEXT FROM curTrunc INTO @tSchema, @tTable, @tCol, @tLen, @tObj;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'SELECT @m = MAX(LEN(' + QUOTENAME(@tCol) + N')) FROM '
        + QUOTENAME(@SourceDb) + N'.' + QUOTENAME(@tSchema) + N'.' + QUOTENAME(@tTable)
        + N' WHERE ' + QUOTENAME(@tCol) + N' IS NOT NULL;';
    SET @tMax = NULL;
    EXEC sys.sp_executesql @sql, N'@m int OUTPUT', @m = @tMax OUTPUT;

    IF @tMax > @tLen
    BEGIN
        SET @msg = N'El dato más largo de ' + @tSchema + N'.' + @tTable + N'.' + @tCol
            + N' mide ' + CONVERT(nvarchar(20), @tMax) + N' caracteres y el destino solo admite '
            + CONVERT(nvarchar(20), @tLen) + N'. Amplía la columna en AsokamDev antes de copiar.';
        CLOSE curTrunc; DEALLOCATE curTrunc;
        THROW 50011, @msg, 1;
    END;

    FETCH NEXT FROM curTrunc INTO @tSchema, @tTable, @tCol, @tLen, @tObj;
END;

CLOSE curTrunc;
DEALLOCATE curTrunc;

-- 2.3 FKs y triggers que se van a deshabilitar temporalmente
CREATE TABLE #FKs
(
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    FKName sysname NOT NULL,
    EstabaDeshabilitada bit NOT NULL,
    PRIMARY KEY (SchemaName, TableName, FKName)
);

INSERT INTO #FKs (SchemaName, TableName, FKName, EstabaDeshabilitada)
SELECT ps.name, pt.name, fk.name, CONVERT(bit, fk.is_disabled)
FROM sys.foreign_keys fk
INNER JOIN sys.tables pt
    ON pt.object_id = fk.parent_object_id
INNER JOIN sys.schemas ps
    ON ps.schema_id = pt.schema_id
WHERE EXISTS (SELECT 1 FROM #Common c WHERE c.TargetObjectId = fk.parent_object_id)
   OR EXISTS (SELECT 1 FROM #Common c WHERE c.TargetObjectId = fk.referenced_object_id);

CREATE TABLE #Triggers
(
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    TriggerName sysname NOT NULL,
    EstabaDeshabilitado bit NOT NULL,
    PRIMARY KEY (SchemaName, TableName, TriggerName)
);

INSERT INTO #Triggers (SchemaName, TableName, TriggerName, EstabaDeshabilitado)
SELECT s.name, t.name, tr.name, CONVERT(bit, tr.is_disabled)
FROM sys.triggers tr
INNER JOIN sys.tables t
    ON t.object_id = tr.parent_id
INNER JOIN sys.schemas s
    ON s.schema_id = t.schema_id
WHERE tr.parent_class = 1
  AND tr.is_ms_shipped = 0
  AND EXISTS (SELECT 1 FROM #Common c WHERE c.TargetObjectId = tr.parent_id);

SELECT @numCommon = COUNT(*),
       @numMerge = SUM(CASE WHEN EsMerge = 1 THEN 1 ELSE 0 END)
FROM #Common;

SELECT @numFKs = COUNT(*) FROM #FKs WHERE EstabaDeshabilitada = 0;
SELECT @numTriggers = COUNT(*) FROM #Triggers WHERE EstabaDeshabilitado = 0;

/* ============================================================================
   SECCIÓN 3: DIAGNÓSTICO
   ============================================================================ */
PRINT N'=====================================================================';
PRINT N' Origen : ' + @SourceDb + N'   Destino: ' + @TargetDb;
PRINT N' Tablas comunes a sincronizar: ' + CONVERT(nvarchar(20), @numCommon);
SELECT @numACrear = COUNT(*) FROM #ACrear;
PRINT N' Tablas que se crearán primero en el destino: '
    + CONVERT(nvarchar(20), @numACrear)
    + CASE WHEN @CrearTablasFaltantes = 1 THEN N'' ELSE N'  (DESACTIVADO)' END;
SELECT @numOmitidas = COUNT(*) FROM #Omitidas;
PRINT N' Tablas omitidas (no existen en destino): '
    + CONVERT(nvarchar(20), @numOmitidas);
PRINT N' Tablas comunes que se conservan parcialmente: ' + CONVERT(nvarchar(20), @numMerge);
PRINT N' FKs a deshabilitar temporalmente: ' + CONVERT(nvarchar(20), @numFKs);
PRINT N' Triggers a deshabilitar temporalmente: ' + CONVERT(nvarchar(20), @numTriggers);
PRINT N'=====================================================================';

SELECT a.SchemaName, a.TableName, a.FilasOrigen,
       CASE WHEN a.Creada = 1 THEN N'CREADA en esta corrida'
            WHEN @CrearTablasFaltantes = 1 THEN N'Se creará (modo diagnóstico)'
            ELSE N'Falta y @CrearTablasFaltantes = 0' END AS Estado
FROM #ACrear a
ORDER BY a.SchemaName, a.TableName;

SELECT o.SchemaName, o.TableName, o.Motivo
FROM #Omitidas o
ORDER BY o.SchemaName, o.TableName;

SELECT c.SchemaName, c.TableName,
       CASE WHEN c.EsMerge = 1
            THEN N'MERGE: conserva filas de AsokamDev referenciadas por tablas exclusivas'
            ELSE N'REEMPLAZAR: datos de Asokam'
       END AS Estrategia
FROM #Common c
WHERE c.EsMerge = 1
ORDER BY c.SchemaName, c.TableName;

IF @SoloDiagnostico = 1
BEGIN
    PRINT N'Modo diagnóstico: no se modificó ningún dato.';
    PRINT N'Para ejecutar: @SoloDiagnostico = 0 y @Confirmar = 1.';
    RETURN;
END;

/* ============================================================================
   SECCIÓN 4: RESPALDO DEL DESTINO
   ============================================================================ */
IF @HacerRespaldo = 1
BEGIN
    SET @BackupDir = CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultBackupPath'));

    IF @BackupDir IS NULL OR LTRIM(RTRIM(@BackupDir)) = N''
        SET @BackupDir = N'C:\Backup';

    IF RIGHT(@BackupDir, 1) <> N'\'
        SET @BackupDir = @BackupDir + N'\';

    SET @BackupFile = @BackupDir
        + N'AsokamDev_pre_refresh_'
        + FORMAT(SYSDATETIME(), N'yyyyMMdd_HHmmss')
        + N'.bak';

    SET @sql = N'BACKUP DATABASE ' + QUOTENAME(@TargetDb)
        + N' TO DISK = @archivo WITH INIT, COPY_ONLY, COMPRESSION, CHECKSUM, STATS = 10;';

    EXEC sys.sp_executesql @sql, N'@archivo nvarchar(4000)', @archivo = @BackupFile;

    SET @sql = N'RESTORE VERIFYONLY FROM DISK = @archivo WITH CHECKSUM;';
    EXEC sys.sp_executesql @sql, N'@archivo nvarchar(4000)', @archivo = @BackupFile;

    PRINT N'Respaldo verificado: ' + @BackupFile;
END;

/* ============================================================================
   SECCIÓN 5: CARGA
   ============================================================================ */
SELECT @recoveryOriginal = recovery_model_desc
FROM sys.databases
WHERE name = @TargetDb;

IF @OptimizarLog = 1 AND @recoveryOriginal <> N'SIMPLE'
BEGIN
    BEGIN TRY
        SET @sql = N'ALTER DATABASE ' + QUOTENAME(@TargetDb) + N' SET RECOVERY SIMPLE;';
        EXEC sys.sp_executesql @sql;
        PRINT N'Recovery model del destino cambiado a SIMPLE durante la copia.';
    END TRY
    BEGIN CATCH
        PRINT N'AVISO: no se pudo poner ' + @TargetDb + N' en SIMPLE: ' + ERROR_MESSAGE();
    END CATCH;
END;

CREATE TABLE #Verificacion
(
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    FilasOrigen bigint NOT NULL,
    FilasDestino bigint NOT NULL,
    Diferencia bigint NOT NULL,
    EsMerge bit NOT NULL,
    PRIMARY KEY (SchemaName, TableName)
);

CREATE TABLE #Fallidas
(
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    Error nvarchar(2000) NOT NULL
);

DECLARE @fkSchema sysname;
DECLARE @fkTable sysname;
DECLARE @fkName sysname;
DECLARE @estabaDeshabilitada bit;

DECLARE @sch sysname;
DECLARE @tbl sysname;
DECLARE @sourceObj int;
DECLARE @targetObj int;
DECLARE @esMerge bit;
DECLARE @hasIdentity bit;
DECLARE @targetTable nvarchar(300);
DECLARE @sourceTable nvarchar(400);
DECLARE @cols nvarchar(max);
DECLARE @colsUpdate nvarchar(max);
DECLARE @pkJoin nvarchar(max);
DECLARE @sourceCount bigint;
DECLARE @targetCount bigint;
DECLARE @tablaActual int = 0;
DECLARE @t0 datetime2;
DECLARE @ms int;

BEGIN TRY
    BEGIN TRANSACTION;

    -- 5.1 Deshabilitar FKs
    DECLARE curFK CURSOR LOCAL FAST_FORWARD FOR
        SELECT SchemaName, TableName, FKName, EstabaDeshabilitada
        FROM #FKs
        WHERE EstabaDeshabilitada = 0
        ORDER BY SchemaName, TableName, FKName;

    OPEN curFK;
    FETCH NEXT FROM curFK INTO @fkSchema, @fkTable, @fkName, @estabaDeshabilitada;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'ALTER TABLE ' + QUOTENAME(@fkSchema) + N'.' + QUOTENAME(@fkTable)
            + N' NOCHECK CONSTRAINT ' + QUOTENAME(@fkName) + N';';
        EXEC sys.sp_executesql @sql;

        FETCH NEXT FROM curFK INTO @fkSchema, @fkTable, @fkName, @estabaDeshabilitada;
    END;

    CLOSE curFK;
    DEALLOCATE curFK;

    -- 5.2 Deshabilitar triggers
    DECLARE curTrg CURSOR LOCAL FAST_FORWARD FOR
        SELECT SchemaName, TableName, TriggerName, EstabaDeshabilitado
        FROM #Triggers
        WHERE EstabaDeshabilitado = 0;

    OPEN curTrg;
    FETCH NEXT FROM curTrg INTO @fkSchema, @fkTable, @fkName, @estabaDeshabilitada;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'DISABLE TRIGGER ' + QUOTENAME(@fkSchema) + N'.' + QUOTENAME(@fkName)
            + N' ON ' + QUOTENAME(@fkSchema) + N'.' + QUOTENAME(@fkTable) + N';';
        EXEC sys.sp_executesql @sql;

        FETCH NEXT FROM curTrg INTO @fkSchema, @fkTable, @fkName, @estabaDeshabilitada;
    END;

    CLOSE curTrg;
    DEALLOCATE curTrg;

    -- 5.3 Copiar tabla por tabla
    DECLARE curTabla CURSOR LOCAL FAST_FORWARD FOR
        SELECT SchemaName, TableName, SourceObjectId, TargetObjectId, EsMerge, TieneIdentity
        FROM #Common
        ORDER BY SchemaName, TableName;

    OPEN curTabla;
    FETCH NEXT FROM curTabla INTO @sch, @tbl, @sourceObj, @targetObj, @esMerge, @hasIdentity;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @tablaActual = @tablaActual + 1;
        SET @t0 = SYSDATETIME();
        SET @targetTable = QUOTENAME(@sch) + N'.' + QUOTENAME(@tbl);
        SET @sourceTable = QUOTENAME(@SourceDb) + N'.' + QUOTENAME(@sch) + N'.' + QUOTENAME(@tbl);
        SET @cols = NULL;
        SET @colsUpdate = NULL;
        SET @pkJoin = NULL;

        SELECT @cols = STUFF(
            (
                SELECT N',' + QUOTENAME(dc.name)
                FROM sys.columns dc
                INNER JOIN [Asokam].sys.columns sc
                    ON sc.object_id = @sourceObj
                   AND sc.name = dc.name
                WHERE dc.object_id = @targetObj
                  AND dc.is_computed = 0
                  AND dc.is_hidden = 0
                  AND dc.generated_always_type = 0
                  AND dc.system_type_id <> 189 -- timestamp/rowversion
                ORDER BY dc.column_id
                FOR XML PATH(N''), TYPE
            ).value(N'.', N'nvarchar(max)'),
            1, 1, N''
        );

        IF @cols IS NULL
        BEGIN
            SET @msg = N'No hay columnas compatibles para ' + @targetTable + N'.';
            THROW 50020, @msg, 1;
        END;

        IF @esMerge = 1
        BEGIN
            SELECT @pkJoin = STUFF(
                (
                    SELECT N' AND t.' + QUOTENAME(c.name) + N' = s.' + QUOTENAME(c.name)
                    FROM sys.indexes i
                    INNER JOIN sys.index_columns ic
                        ON ic.object_id = i.object_id
                       AND ic.index_id = i.index_id
                    INNER JOIN sys.columns c
                        ON c.object_id = ic.object_id
                       AND c.column_id = ic.column_id
                    WHERE i.object_id = @targetObj
                      AND i.is_primary_key = 1
                    ORDER BY ic.key_ordinal
                    FOR XML PATH(N''), TYPE
                ).value(N'.', N'nvarchar(max)'),
                1, 5, N''
            );

            IF @pkJoin IS NULL
            BEGIN
                SET @msg = N'La tabla ' + @targetTable
                    + N' requiere PK para conservar sus filas por dependencias de AsokamDev.';
                THROW 50021, @msg, 1;
            END;

            SELECT @colsUpdate = STUFF(
                (
                    SELECT N',' + QUOTENAME(dc.name) + N' = s.' + QUOTENAME(dc.name)
                    FROM sys.columns dc
                    INNER JOIN [Asokam].sys.columns sc
                        ON sc.object_id = @sourceObj
                       AND sc.name = dc.name
                    WHERE dc.object_id = @targetObj
                      AND dc.is_identity = 0
                      AND dc.is_computed = 0
                      AND dc.is_hidden = 0
                      AND dc.generated_always_type = 0
                      AND dc.system_type_id <> 189
                      AND NOT EXISTS (
                          SELECT 1
                          FROM sys.indexes i
                          INNER JOIN sys.index_columns ic
                              ON ic.object_id = i.object_id
                             AND ic.index_id = i.index_id
                          WHERE i.object_id = @targetObj
                            AND i.is_primary_key = 1
                            AND ic.column_id = dc.column_id
                      )
                    ORDER BY dc.column_id
                    FOR XML PATH(N''), TYPE
                ).value(N'.', N'nvarchar(max)'),
                1, 1, N''
            );

            IF @colsUpdate IS NOT NULL
            BEGIN
                SET @sql = N'UPDATE t SET ' + @colsUpdate
                    + N' FROM ' + @targetTable + N' AS t'
                    + N' INNER JOIN ' + @sourceTable + N' AS s'
                    + N' ON ' + @pkJoin + N';';
                EXEC sys.sp_executesql @sql;
            END;

            SET @sql = N'INSERT INTO ' + @targetTable + N' (' + @cols + N')'
                + N' SELECT ' + @cols
                + N' FROM ' + @sourceTable + N' AS s'
                + N' WHERE NOT EXISTS (SELECT 1 FROM ' + @targetTable + N' AS t WHERE ' + @pkJoin + N');';
        END
        ELSE
        BEGIN
            SET @sql = N'DELETE FROM ' + @targetTable + N';';
            EXEC sys.sp_executesql @sql;

            SET @sql = N'INSERT INTO ' + @targetTable + N' (' + @cols + N')'
                + N' SELECT ' + @cols + N' FROM ' + @sourceTable + N';';
        END;

        IF @hasIdentity = 1
        BEGIN
            SET @sql = N'SET IDENTITY_INSERT ' + @targetTable + N' ON;'
                + N' BEGIN TRY '
                + @sql
                + N' END TRY BEGIN CATCH'
                + N' SET IDENTITY_INSERT ' + @targetTable + N' OFF; THROW; END CATCH;'
                + N' SET IDENTITY_INSERT ' + @targetTable + N' OFF;';
        END;

        EXEC sys.sp_executesql @sql;

        IF @hasIdentity = 1
        BEGIN
            SET @sql = N'DBCC CHECKIDENT (' + QUOTENAME(@targetTable, '''')
                + N', RESEED) WITH NO_INFOMSGS;';
            EXEC sys.sp_executesql @sql;
        END;

        SET @sql = N'SELECT @n = COUNT_BIG(*) FROM ' + @sourceTable + N';';
        EXEC sys.sp_executesql @sql, N'@n bigint OUTPUT', @n = @sourceCount OUTPUT;

        SET @sql = N'SELECT @n = COUNT_BIG(*) FROM ' + @targetTable + N';';
        EXEC sys.sp_executesql @sql, N'@n bigint OUTPUT', @n = @targetCount OUTPUT;

        INSERT INTO #Verificacion
            (SchemaName, TableName, FilasOrigen, FilasDestino, Diferencia, EsMerge)
        VALUES
            (@sch, @tbl, @sourceCount, @targetCount, @targetCount - @sourceCount, @esMerge);

        IF (@esMerge = 0 AND @sourceCount <> @targetCount)
           OR (@esMerge = 1 AND @targetCount < @sourceCount)
        BEGIN
            SET @error = N'Conteo inesperado en ' + @targetTable
                + N'. Origen=' + CONVERT(nvarchar(20), @sourceCount)
                + N', Destino=' + CONVERT(nvarchar(20), @targetCount)
                + N', Estrategia=' + CASE WHEN @esMerge = 1 THEN N'MERGE' ELSE N'REEMPLAZAR' END;
            BREAK;
        END;

        IF @tablaActual % 10 = 0 OR @sourceCount > 100000
        BEGIN
            SET @ms = DATEDIFF(ms, @t0, SYSDATETIME());
            RAISERROR(N'[%d/%d] %s.%s -> %I64d filas (%d ms)',
                      0, 1, @tablaActual, @numCommon, @sch, @tbl, @targetCount, @ms) WITH NOWAIT;
        END;

        FETCH NEXT FROM curTabla INTO @sch, @tbl, @sourceObj, @targetObj, @esMerge, @hasIdentity;
    END;

    CLOSE curTabla;
    DEALLOCATE curTabla;

    IF @error IS NOT NULL
        THROW 50030, @error, 1;

    -- 5.4 Rehabilitar FKs (con validación; si falla, se deja sin validar y se reporta)
    DECLARE curFKOn CURSOR LOCAL FAST_FORWARD FOR
        SELECT SchemaName, TableName, FKName, EstabaDeshabilitada
        FROM #FKs
        WHERE EstabaDeshabilitada = 0
        ORDER BY SchemaName, TableName, FKName;

    OPEN curFKOn;
    FETCH NEXT FROM curFKOn INTO @fkSchema, @fkTable, @fkName, @estabaDeshabilitada;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = N'ALTER TABLE ' + QUOTENAME(@fkSchema) + N'.' + QUOTENAME(@fkTable)
                + N' WITH CHECK CHECK CONSTRAINT ' + QUOTENAME(@fkName) + N';';
            EXEC sys.sp_executesql @sql;
        END TRY
        BEGIN CATCH
            INSERT INTO #Fallidas VALUES (@fkSchema, @fkTable,
                N'FK ' + @fkName + N': ' + ERROR_MESSAGE());
            SET @sql = N'ALTER TABLE ' + QUOTENAME(@fkSchema) + N'.' + QUOTENAME(@fkTable)
                + N' NOCHECK CONSTRAINT ' + QUOTENAME(@fkName) + N';';
            EXEC sys.sp_executesql @sql;
        END CATCH;

        FETCH NEXT FROM curFKOn INTO @fkSchema, @fkTable, @fkName, @estabaDeshabilitada;
    END;

    CLOSE curFKOn;
    DEALLOCATE curFKOn;

    -- 5.5 Rehabilitar triggers
    DECLARE curTrgOn CURSOR LOCAL FAST_FORWARD FOR
        SELECT SchemaName, TableName, TriggerName, EstabaDeshabilitado
        FROM #Triggers
        WHERE EstabaDeshabilitado = 0;

    OPEN curTrgOn;
    FETCH NEXT FROM curTrgOn INTO @fkSchema, @fkTable, @fkName, @estabaDeshabilitada;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'ENABLE TRIGGER ' + QUOTENAME(@fkSchema) + N'.' + QUOTENAME(@fkName)
            + N' ON ' + QUOTENAME(@fkSchema) + N'.' + QUOTENAME(@fkTable) + N';';
        EXEC sys.sp_executesql @sql;

        FETCH NEXT FROM curTrgOn INTO @fkSchema, @fkTable, @fkName, @estabaDeshabilitada;
    END;

    CLOSE curTrgOn;
    DEALLOCATE curTrgOn;

    COMMIT TRANSACTION;

    SELECT @numVerif = COUNT(*),
           @sumDestino = COALESCE(SUM(FilasDestino), 0)
    FROM #Verificacion;

    SELECT @numDif = COUNT(*) FROM #Verificacion WHERE Diferencia <> 0;

    PRINT N'Sincronización completada correctamente.';
    PRINT N'Tablas procesadas: ' + CONVERT(nvarchar(20), @numVerif);
    PRINT N'Filas copiadas (destino): ' + CONVERT(nvarchar(30), @sumDestino);
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    IF @OptimizarLog = 1 AND @recoveryOriginal <> N'SIMPLE'
    BEGIN
        BEGIN TRY
            SET @sql = N'ALTER DATABASE ' + QUOTENAME(@TargetDb) + N' SET RECOVERY '
                + @recoveryOriginal + N';';
            EXEC sys.sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT N'AVISO: no se pudo restaurar el recovery model a ' + @recoveryOriginal + N'.';
        END CATCH;
    END;

    PRINT N'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

/* ============================================================================
   SECCIÓN 6: VERIFICACIÓN FINAL
   ============================================================================ */
IF @OptimizarLog = 1 AND @recoveryOriginal <> N'SIMPLE'
BEGIN
    BEGIN TRY
        SET @sql = N'ALTER DATABASE ' + QUOTENAME(@TargetDb) + N' SET RECOVERY '
            + @recoveryOriginal + N';';
        EXEC sys.sp_executesql @sql;
        PRINT N'Recovery model del destino restaurado a ' + @recoveryOriginal + N'.';
    END TRY
    BEGIN CATCH
        PRINT N'AVISO: no se pudo restaurar el recovery model a ' + @recoveryOriginal
            + N': ' + ERROR_MESSAGE();
    END CATCH;
END;

PRINT N'Tablas con diferencia de filas: '
    + CONVERT(nvarchar(20), @numDif);

SELECT a.SchemaName, a.TableName, a.FilasOrigen, a.Creada
FROM #ACrear a
ORDER BY a.SchemaName, a.TableName;

SELECT SchemaName, TableName, FilasOrigen, FilasDestino, Diferencia, EsMerge
FROM #Verificacion
WHERE Diferencia <> 0
ORDER BY ABS(Diferencia) DESC, SchemaName, TableName;

SELECT SchemaName, TableName, Motivo
FROM #Omitidas
ORDER BY SchemaName, TableName;

SELECT SchemaName, TableName, Error
FROM #Fallidas;

DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;
