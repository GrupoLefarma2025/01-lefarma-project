/* ============================================================================
   Sincronizar datos de Lefarma -> LefarmaDev2
   ----------------------------------------------------------------------------
   Qué hace:
   - Copia los datos de todas las tablas que existen en AMBAS bases.
   - NO crea, altera ni elimina tablas, columnas, índices o procedimientos.
   - NO toca las tablas exclusivas de LefarmaDev2 (Educación Médica y Viáticos).
   - Excluye tablas técnicas:
       * app.SchemaVersions       (journal de migraciones DbUp)
       * dbo.__EFMigrationsHistory (journal de EF)
       * schema mcp_undo
   - Conserva las filas padre de Dev2 que están referenciadas por tablas
     exclusivas de Dev2. Esas tablas se actualizan/insertan, pero no se vacían.
   - Conserva el catálogo que hoy solo tiene datos en Dev2 porque en Lefarma la
     tabla está vacía (si no, los módulos exclusivos de Dev2 se quedan sin
     catálogo): educacion_medica.hospital_extension,
     educacion_medica.parametros_anestesias y viaticos.municipios_cat.
     Esas tablas se fusionan (update/insert), nunca se vacían.
   - Conserva los valores de educacion_medica.hospital_extension.id_region,
     columna que no existe en Lefarma.
   - Respalda LefarmaDev2 antes de modificar datos.
   - Todo el cambio corre en una transacción; si algo falla, hace ROLLBACK.

   Importante:
   - Detén el backend y cualquier cliente conectado a LefarmaDev2 antes de
     ejecutar en modo real.
   - Por defecto el script SOLO DIAGNOSTICA. Para ejecutarlo:
       SET @SoloDiagnostico = 0;
       SET @Confirmar = 1;
   - Si BACKUP DATABASE no está permitido para tu usuario, toma un respaldo
     manual y cambia @HacerRespaldo = 0.
   ============================================================================ */

/* ----------------------------------------------------------------------------
   Limpieza de tablas temporales de corridas anteriores.
   Va en su PROPIO lote (GO) a propósito: si un #Common viejo sigue vivo en la
   sesión, SQL Server compila el resto del script contra su estructura anterior
   y falla con "Invalid column name 'MotivoMerge'". Borrándolo antes de compilar
   el cuerpo, el script se puede re-ejecutar en la misma ventana sin errores.
   ---------------------------------------------------------------------------- */
DROP TABLE IF EXISTS #Common, #Conservar, #FKs, #HospitalRegion, #Verificacion;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @SourceDb sysname = N'Lefarma';
DECLARE @TargetDb sysname = N'LefarmaDev2';

-- 1 = solo muestra qué haría; 0 = ejecuta
DECLARE @SoloDiagnostico bit = 1;
-- Debe cambiarse a 1 junto con @SoloDiagnostico = 0
DECLARE @Confirmar bit = 0;
-- Respaldo automático de LefarmaDev2 antes de tocar datos
DECLARE @HacerRespaldo bit = 1;

DECLARE @BackupDir nvarchar(4000);
DECLARE @BackupFile nvarchar(4000);
DECLARE @sql nvarchar(max);
DECLARE @msg nvarchar(2048);
DECLARE @error nvarchar(2048) = NULL;
DECLARE @numCommon int;
DECLARE @numMerge int;
DECLARE @numFKs int;
DECLARE @numVerif int;
DECLARE @sumDestino bigint;

IF DB_ID(@SourceDb) IS NULL
    THROW 50001, 'No existe la base origen Lefarma.', 1;

IF DB_ID(@TargetDb) IS NULL
    THROW 50002, 'No existe la base destino LefarmaDev2.', 1;

IF @SourceDb = @TargetDb
    THROW 50003, 'La base origen y destino no pueden ser la misma.', 1;

IF @TargetDb IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 50004, 'El destino no puede ser una base del sistema.', 1;

IF @TargetDb = @SourceDb
    THROW 50005, 'El destino no puede ser la base de producción.', 1;

IF @SoloDiagnostico = 0 AND @Confirmar <> 1
    THROW 50006, 'Cambia @Confirmar = 1 para ejecutar el refresco real.', 1;

USE [LefarmaDev2];

IF DB_NAME() <> @TargetDb
    THROW 50007, 'No se pudo cambiar el contexto a LefarmaDev2.', 1;

CREATE TABLE #Common
(
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    SourceObjectId int NOT NULL,
    TargetObjectId int NOT NULL,
    EsMerge bit NOT NULL DEFAULT (0),
    MotivoMerge nvarchar(200) NULL,
    TieneIdentity bit NOT NULL DEFAULT (0),
    PRIMARY KEY (SchemaName, TableName)
);

INSERT INTO #Common (SchemaName, TableName, SourceObjectId, TargetObjectId)
SELECT ds.name, dt.name, st.object_id, dt.object_id
FROM sys.tables dt
INNER JOIN sys.schemas ds
    ON ds.schema_id = dt.schema_id
INNER JOIN [Lefarma].sys.schemas ss
    ON ss.name = ds.name
INNER JOIN [Lefarma].sys.tables st
    ON st.schema_id = ss.schema_id
   AND st.name = dt.name
WHERE dt.is_ms_shipped = 0
  AND ds.name <> N'mcp_undo'
  AND NOT (ds.name = N'app' AND dt.name = N'SchemaVersions')
  AND NOT (ds.name = N'dbo' AND dt.name = N'__EFMigrationsHistory');

UPDATE c
SET TieneIdentity = 1
FROM #Common c
WHERE EXISTS (
    SELECT 1
    FROM sys.columns col
    WHERE col.object_id = c.TargetObjectId
      AND col.is_identity = 1
);

-- Tablas comunes que son padre de alguna tabla exclusiva de Dev2.
-- Se conservan sus filas actuales para no dejar huérfanas las tablas nuevas.
UPDATE c
SET EsMerge = 1,
    MotivoMerge = N'Conserva filas de Dev2 referenciadas por tablas exclusivas'
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

-- Catálogos que hoy solo tienen datos en Dev2 (en Lefarma la tabla está vacía).
-- Si se vaciaran, los módulos que solo existen en Dev2 se quedan sin catálogo.
-- Se fusionan: si Lefarma trae filas se actualizan/insertan; si viene vacío,
-- Dev2 conserva lo que ya tiene.
CREATE TABLE #Conservar
(
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    PRIMARY KEY (SchemaName, TableName)
);

INSERT INTO #Conservar (SchemaName, TableName) VALUES
    (N'educacion_medica', N'hospital_extension'),
    (N'educacion_medica', N'parametros_anestesias'),
    (N'viaticos', N'municipios_cat');

UPDATE c
SET EsMerge = 1,
    MotivoMerge = N'Catálogo que solo tiene datos en Dev2 (en Lefarma está vacío)'
FROM #Common c
INNER JOIN #Conservar k
    ON k.SchemaName = c.SchemaName
   AND k.TableName = c.TableName;

-- Preflight: columnas NOT NULL del destino que no existen en el origen y no
-- tienen default/identity. Si hubiera alguna, el INSERT fallaría.
IF EXISTS (
    SELECT 1
    FROM #Common c
    INNER JOIN sys.columns dc
        ON dc.object_id = c.TargetObjectId
    LEFT JOIN [Lefarma].sys.columns sc
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
    SELECT @msg = N'Columnas obligatorias del destino sin equivalente en Lefarma: '
        + STUFF(
            (
                SELECT N', ' + c.SchemaName + N'.' + c.TableName + N'.' + dc.name
                FROM #Common c
                INNER JOIN sys.columns dc
                    ON dc.object_id = c.TargetObjectId
                LEFT JOIN [Lefarma].sys.columns sc
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
WHERE EXISTS (
    SELECT 1 FROM #Common c
    WHERE c.TargetObjectId = fk.parent_object_id
)
AND EXISTS (
    SELECT 1 FROM #Common c
    WHERE c.TargetObjectId = fk.referenced_object_id
);

SELECT @numCommon = COUNT(*),
       @numMerge = SUM(CASE WHEN EsMerge = 1 THEN 1 ELSE 0 END)
FROM #Common;

SELECT @numFKs = COUNT(*)
FROM #FKs
WHERE EstabaDeshabilitada = 0;

PRINT N'Tablas comunes a sincronizar: ' + CONVERT(nvarchar(20), @numCommon);
PRINT N'Tablas comunes que se conservan parcialmente (merge): '
    + CONVERT(nvarchar(20), @numMerge);
PRINT N'FKs comunes que se deshabilitarán temporalmente: '
    + CONVERT(nvarchar(20), @numFKs);

SELECT SchemaName, TableName,
       CASE WHEN EsMerge = 1
            THEN N'MERGE: ' + MotivoMerge
            ELSE N'REEMPLAZAR: datos de Lefarma'
       END AS Estrategia
FROM #Common
WHERE EsMerge = 1
ORDER BY SchemaName, TableName;

IF @SoloDiagnostico = 1
BEGIN
    PRINT N'Modo diagnóstico: no se modificó ningún dato.';
    PRINT N'Para ejecutar: @SoloDiagnostico = 0 y @Confirmar = 1.';
    RETURN;
END;

IF @HacerRespaldo = 1
BEGIN
    SET @BackupDir = CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultBackupPath'));

    IF @BackupDir IS NULL OR LTRIM(RTRIM(@BackupDir)) = N''
        SET @BackupDir = N'C:\Backup';

    IF RIGHT(@BackupDir, 1) <> N'\'
        SET @BackupDir = @BackupDir + N'\';

    SET @BackupFile = @BackupDir
        + N'LefarmaDev2_pre_refresh_'
        + FORMAT(SYSDATETIME(), N'yyyyMMdd_HHmmss')
        + N'.bak';

    SET @sql = N'BACKUP DATABASE ' + QUOTENAME(@TargetDb)
        + N' TO DISK = @archivo WITH INIT, COPY_ONLY, COMPRESSION, CHECKSUM, STATS = 10;';

    EXEC sys.sp_executesql @sql, N'@archivo nvarchar(4000)', @archivo = @BackupFile;

    SET @sql = N'RESTORE VERIFYONLY FROM DISK = @archivo WITH CHECKSUM;';
    EXEC sys.sp_executesql @sql, N'@archivo nvarchar(4000)', @archivo = @BackupFile;

    PRINT N'Respaldo verificado: ' + @BackupFile;
END;

-- Mapa para conservar id_region de hospital_extension, columna que no existe
-- en Lefarma.
CREATE TABLE #HospitalRegion
(
    id_hospital int NOT NULL PRIMARY KEY,
    id_region int NULL
);

IF COL_LENGTH(N'educacion_medica.hospital_extension', N'id_region') IS NOT NULL
BEGIN
    SET @sql = N'
        INSERT INTO #HospitalRegion (id_hospital, id_region)
        SELECT id_hospital, id_region
        FROM educacion_medica.hospital_extension
        WHERE id_region IS NOT NULL;';
    EXEC sys.sp_executesql @sql;
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

BEGIN TRY
    BEGIN TRANSACTION;

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

    DECLARE curTabla CURSOR LOCAL FAST_FORWARD FOR
        SELECT SchemaName, TableName, SourceObjectId, TargetObjectId, EsMerge, TieneIdentity
        FROM #Common
        ORDER BY SchemaName, TableName;

    OPEN curTabla;
    FETCH NEXT FROM curTabla INTO @sch, @tbl, @sourceObj, @targetObj, @esMerge, @hasIdentity;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @targetTable = QUOTENAME(@sch) + N'.' + QUOTENAME(@tbl);
        SET @sourceTable = QUOTENAME(@SourceDb) + N'.' + QUOTENAME(@sch) + N'.' + QUOTENAME(@tbl);
        SET @cols = NULL;
        SET @colsUpdate = NULL;
        SET @pkJoin = NULL;

        SELECT @cols = STUFF(
            (
                SELECT N',' + QUOTENAME(dc.name)
                FROM sys.columns dc
                INNER JOIN [Lefarma].sys.columns sc
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
                    + N' requiere PK para conservar sus filas por dependencias de Dev2.';
                THROW 50021, @msg, 1;
            END;

            SELECT @colsUpdate = STUFF(
                (
                    SELECT N',' + QUOTENAME(dc.name) + N' = s.' + QUOTENAME(dc.name)
                    FROM sys.columns dc
                    INNER JOIN [Lefarma].sys.columns sc
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

        FETCH NEXT FROM curTabla INTO @sch, @tbl, @sourceObj, @targetObj, @esMerge, @hasIdentity;
    END;

    CLOSE curTabla;
    DEALLOCATE curTabla;

    IF @error IS NOT NULL
        THROW 50030, @error, 1;

    -- Restaurar las regiones de Educación Médica que no existen en Lefarma.
    IF COL_LENGTH(N'educacion_medica.hospital_extension', N'id_region') IS NOT NULL
    BEGIN
        SET @sql = N'
            UPDATE h
               SET h.id_region = m.id_region
            FROM educacion_medica.hospital_extension AS h
            INNER JOIN #HospitalRegion AS m
                ON m.id_hospital = h.id_hospital
            WHERE h.id_region IS NULL
               OR h.id_region <> m.id_region;';
        EXEC sys.sp_executesql @sql;
    END;

    DECLARE curFKOn CURSOR LOCAL FAST_FORWARD FOR
        SELECT SchemaName, TableName, FKName, EstabaDeshabilitada
        FROM #FKs
        WHERE EstabaDeshabilitada = 0
        ORDER BY SchemaName, TableName, FKName;

    OPEN curFKOn;
    FETCH NEXT FROM curFKOn INTO @fkSchema, @fkTable, @fkName, @estabaDeshabilitada;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'ALTER TABLE ' + QUOTENAME(@fkSchema) + N'.' + QUOTENAME(@fkTable)
            + N' WITH CHECK CHECK CONSTRAINT ' + QUOTENAME(@fkName) + N';';
        EXEC sys.sp_executesql @sql;

        FETCH NEXT FROM curFKOn INTO @fkSchema, @fkTable, @fkName, @estabaDeshabilitada;
    END;

    CLOSE curFKOn;
    DEALLOCATE curFKOn;

    COMMIT TRANSACTION;

    SELECT @numVerif = COUNT(*),
           @sumDestino = COALESCE(SUM(FilasDestino), 0)
    FROM #Verificacion;

    PRINT N'Sincronización completada correctamente.';
    PRINT N'Tablas procesadas: ' + CONVERT(nvarchar(20), @numVerif);
    PRINT N'Filas copiadas (destino): ' + CONVERT(nvarchar(30), @sumDestino);
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    PRINT N'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

SELECT SchemaName, TableName, FilasOrigen, FilasDestino, Diferencia, EsMerge
FROM #Verificacion
WHERE Diferencia <> 0
ORDER BY Diferencia DESC, SchemaName, TableName;
