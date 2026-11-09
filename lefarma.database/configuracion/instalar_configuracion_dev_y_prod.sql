-- =============================================================================
-- INSTALACIÓN DEL MÓDULO CONFIGURACIÓN EN DESARROLLO Y PRODUCCIÓN
--
-- Un solo script, ejecutado UNA VEZ sobre el servidor SQL compartido:
--   * LefarmaDev + AsokamDev
--   * Lefarma    + Asokam
--
-- QUÉ CREA (idempotente):
--   1) schema config
--   2) config.variables
--   3) config.variables_bitacora
--   4) config.integraciones
--   5) índices
--   6) config.fn_obtener_variable
--   7) seis permisos configuracion.* en cada Asokam, SIN asignarlos
--
-- ADVERTENCIA:
--   Este script modifica AMBAS bases. Requiere que LefarmaDev, Lefarma,
--   AsokamDev y Asokam existan en la misma instancia. NO se ha ejecutado.
--   Revisar y respaldar antes de correrlo. No crea ni modifica datos de
--   variables; solo estructura y catálogo de permisos.
--
-- IDEMPOTENTE:
--   Se puede volver a ejecutar. No duplica tablas, índices, función ni
--   permisos. No modifica permisos existentes ni crea asignaciones.
--
-- REQUISITOS:
--   * SQL Server 2016 SP1 o superior (OPENJSON, ISJSON, CREATE OR ALTER).
--   * El login debe poder crear objetos en LefarmaDev/Lefarma y leer/insertar
--     en AsokamDev.app.Permisos/Asokam.app.Permisos.
--   * Ambas bases de cada pareja están en la misma instancia (sin MSDTC).
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- =============================================================================
-- 0. Validaciones previas: todo o nada
-- =============================================================================

IF DB_ID(N'LefarmaDev') IS NULL
    THROW 50100, N'No existe LefarmaDev en esta instancia. Script abortado.', 1;

IF DB_ID(N'Lefarma') IS NULL
    THROW 50101, N'No existe Lefarma en esta instancia. Script abortado.', 1;

IF DB_ID(N'AsokamDev') IS NULL
    THROW 50102, N'No existe AsokamDev en esta instancia. Script abortado.', 1;

IF DB_ID(N'Asokam') IS NULL
    THROW 50103, N'No existe Asokam en esta instancia. Script abortado.', 1;

IF OBJECT_ID(N'AsokamDev.app.Permisos', N'U') IS NULL
    THROW 50104, N'No existe AsokamDev.app.Permisos. Script abortado.', 1;

IF OBJECT_ID(N'Asokam.app.Permisos', N'U') IS NULL
    THROW 50105, N'No existe Asokam.app.Permisos. Script abortado.', 1;

PRINT N'Validación de bases completada: LefarmaDev, Lefarma, AsokamDev y Asokam existen.';
GO

-- =============================================================================
-- 1. DDL de tablas e índices
--
-- Se ejecuta dos veces mediante EXEC [Base].sys.sp_executesql, por lo que
-- cada CREATE queda en la base objetivo y no hay USE dinámico.
-- =============================================================================

DECLARE @DdlTablas NVARCHAR(MAX) = N'
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF SCHEMA_ID(N''config'') IS NULL
BEGIN
    EXEC(N''CREATE SCHEMA config;'');
    PRINT N''Schema [config] creado.'';
END

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N''config.variables'', N''U'') IS NULL
    BEGIN
        CREATE TABLE config.variables
        (
            id_variable              BIGINT IDENTITY(1,1) NOT NULL,
            clave                    NVARCHAR(200)  NOT NULL,
            nombre                   NVARCHAR(200)  NOT NULL,
            descripcion              NVARCHAR(1000) NULL,
            tipo_dato                VARCHAR(30)    NOT NULL,
            valor_json               NVARCHAR(MAX)  NOT NULL,
            esquema_json             NVARCHAR(MAX)  NULL,
            disponible_backend       BIT NOT NULL CONSTRAINT DF_variables_disponible_backend       DEFAULT (0),
            disponible_frontend      BIT NOT NULL CONSTRAINT DF_variables_disponible_frontend      DEFAULT (0),
            disponible_sql           BIT NOT NULL CONSTRAINT DF_variables_disponible_sql           DEFAULT (0),
            disponible_integraciones BIT NOT NULL CONSTRAINT DF_variables_disponible_integraciones DEFAULT (0),
            activo                   BIT NOT NULL CONSTRAINT DF_variables_activo                   DEFAULT (1),
            fecha_creacion           DATETIME2(3) NOT NULL CONSTRAINT DF_variables_fecha_creacion   DEFAULT (SYSUTCDATETIME()),
            fecha_modificacion       DATETIME2(3) NOT NULL CONSTRAINT DF_variables_fecha_modificacion DEFAULT (SYSUTCDATETIME()),
            id_usuario_creacion      INT NULL,
            id_usuario_modificacion  INT NULL,
            version                  BIGINT NOT NULL CONSTRAINT DF_variables_version DEFAULT (0),
            row_version              ROWVERSION NOT NULL,

            CONSTRAINT PK_variables PRIMARY KEY CLUSTERED (id_variable),
            CONSTRAINT UQ_variables_clave UNIQUE (clave),
            CONSTRAINT CK_variables_tipo_dato CHECK
            (
                tipo_dato IN
                (
                    ''string'', ''text'', ''integer'', ''decimal'', ''boolean'', ''date'',
                    ''time'', ''datetime'', ''enum'', ''object'', ''array'', ''json''
                )
            ),
            CONSTRAINT CK_variables_valor_json CHECK (ISJSON(valor_json) = 1),
            CONSTRAINT CK_variables_esquema_json CHECK
            (
                esquema_json IS NULL OR ISJSON(esquema_json) = 1
            ),
            CONSTRAINT CK_variables_destino CHECK
            (
                disponible_backend = 1
                OR disponible_frontend = 1
                OR disponible_sql = 1
                OR disponible_integraciones = 1
            )
        );

        PRINT N''Tabla [config.variables] creada.'';
    END
    ELSE
        PRINT N''Tabla [config.variables] ya existe. Skip.'';

    IF OBJECT_ID(N''config.variables_bitacora'', N''U'') IS NULL
    BEGIN
        CREATE TABLE config.variables_bitacora
        (
            id_bitacora           BIGINT IDENTITY(1,1) NOT NULL,
            id_operacion          UNIQUEIDENTIFIER NOT NULL,
            id_variable           BIGINT NOT NULL,
            clave                 NVARCHAR(200) NOT NULL,
            accion                VARCHAR(30) NOT NULL,
            datos_anteriores_json NVARCHAR(MAX) NULL,
            datos_nuevos_json     NVARCHAR(MAX) NOT NULL,
            id_bitacora_origen    BIGINT NULL,
            id_usuario            INT NULL,
            fecha_creacion        DATETIME2(3) NOT NULL
                                      CONSTRAINT DF_variables_bitacora_fecha_creacion
                                      DEFAULT (SYSUTCDATETIME()),

            CONSTRAINT PK_variables_bitacora PRIMARY KEY CLUSTERED (id_bitacora),
            CONSTRAINT UQ_variables_bitacora_id_operacion UNIQUE (id_operacion),
            CONSTRAINT FK_variables_bitacora_variable
                FOREIGN KEY (id_variable) REFERENCES config.variables (id_variable),
            CONSTRAINT FK_variables_bitacora_origen
                FOREIGN KEY (id_bitacora_origen) REFERENCES config.variables_bitacora (id_bitacora),
            CONSTRAINT CK_variables_bitacora_accion CHECK
            (
                accion IN (''crear'', ''actualizar'', ''desactivar'', ''reactivar'', ''restaurar'')
            ),
            CONSTRAINT CK_variables_bitacora_anteriores_json CHECK
            (
                datos_anteriores_json IS NULL OR ISJSON(datos_anteriores_json) = 1
            ),
            CONSTRAINT CK_variables_bitacora_nuevos_json CHECK
            (
                ISJSON(datos_nuevos_json) = 1
            )
        );

        PRINT N''Tabla [config.variables_bitacora] creada.'';
    END
    ELSE
        PRINT N''Tabla [config.variables_bitacora] ya existe. Skip.'';

    IF OBJECT_ID(N''config.integraciones'', N''U'') IS NULL
    BEGIN
        CREATE TABLE config.integraciones
        (
            id_integracion         INT IDENTITY(1,1) NOT NULL,
            nombre                 NVARCHAR(200) NOT NULL,
            prefijo_llave          NVARCHAR(24) NOT NULL,
            hash_llave             CHAR(64) NOT NULL,
            claves_permitidas_json NVARCHAR(MAX) NULL,
            activo                 BIT NOT NULL CONSTRAINT DF_integraciones_activo DEFAULT (1),
            fecha_creacion         DATETIME2(3) NOT NULL
                                       CONSTRAINT DF_integraciones_fecha_creacion
                                       DEFAULT (SYSUTCDATETIME()),
            fecha_expiracion       DATETIME2(3) NULL,
            ultima_utilizacion     DATETIME2(3) NULL,

            CONSTRAINT PK_integraciones PRIMARY KEY CLUSTERED (id_integracion),
            CONSTRAINT UQ_integraciones_prefijo_llave UNIQUE (prefijo_llave),
            CONSTRAINT UQ_integraciones_hash_llave UNIQUE (hash_llave),
            CONSTRAINT CK_integraciones_claves_permitidas_json CHECK
            (
                claves_permitidas_json IS NULL OR ISJSON(claves_permitidas_json) = 1
            )
        );

        PRINT N''Tabla [config.integraciones] creada.'';
    END
    ELSE
        PRINT N''Tabla [config.integraciones] ya existe. Skip.'';

    IF NOT EXISTS
    (
        SELECT 1 FROM sys.indexes
        WHERE name = N''IX_variables_bitacora_id_variable''
          AND object_id = OBJECT_ID(N''config.variables_bitacora'')
    )
        CREATE NONCLUSTERED INDEX IX_variables_bitacora_id_variable
            ON config.variables_bitacora (id_variable, id_bitacora DESC);

    IF NOT EXISTS
    (
        SELECT 1 FROM sys.indexes
        WHERE name = N''IX_variables_bitacora_fecha_creacion''
          AND object_id = OBJECT_ID(N''config.variables_bitacora'')
    )
        CREATE NONCLUSTERED INDEX IX_variables_bitacora_fecha_creacion
            ON config.variables_bitacora (fecha_creacion);

    COMMIT TRANSACTION;
    PRINT N''DDL de tablas e índices confirmado.'';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    PRINT N''ERROR en DDL de Configuración: '' + ERROR_MESSAGE();
    THROW;
END CATCH;
';

-- =============================================================================
-- 2. Función escalar de lectura
--
-- Cada EXEC de sp_executesql crea un batch propio. CREATE OR ALTER FUNCTION
-- es la primera sentencia de ese batch. Sin SCHEMABINDING para permitir
-- OPENJSON en todas las versiones soportadas.
-- =============================================================================

DECLARE @DdlFuncion NVARCHAR(MAX) = N'
CREATE OR ALTER FUNCTION config.fn_obtener_variable
(
    @clave NVARCHAR(200)
)
RETURNS NVARCHAR(MAX)
AS
BEGIN
    DECLARE @tipo_dato     VARCHAR(30);
    DECLARE @valor_json    NVARCHAR(MAX);
    DECLARE @valor_escalar NVARCHAR(MAX);
    DECLARE @normalizado   NVARCHAR(MAX);

    SELECT
        @tipo_dato  = v.tipo_dato,
        @valor_json = v.valor_json
    FROM config.variables AS v
    WHERE v.clave = @clave
      AND v.activo = 1
      AND v.disponible_sql = 1;

    IF @tipo_dato IS NULL
        RETURN NULL;

    IF @tipo_dato IN (''object'', ''array'', ''json'')
        RETURN @valor_json;

    IF LEFT(LTRIM(@valor_json), 1) IN (N''{'', N''['')
        RETURN NULL;

    SELECT @valor_escalar = j.[value]
    FROM OPENJSON(CONCAT(N''{"v":'', @valor_json, N''}''))
        WITH ([value] NVARCHAR(MAX) N''$."v"'') AS j;

    IF @tipo_dato = ''boolean''
    BEGIN
        SET @normalizado = LOWER(LTRIM(RTRIM(@valor_escalar)));

        IF @normalizado = N''1'' OR @normalizado = N''true''
            RETURN N''1'';

        IF @normalizado = N''0'' OR @normalizado = N''false''
            RETURN N''0'';

        RETURN NULL;
    END

    RETURN @valor_escalar;
END;
';

-- =============================================================================
-- 3. Ejecutar DDL en ambas bases
-- =============================================================================

PRINT N'============================================================';
PRINT N'Instalando estructura en LefarmaDev...';
PRINT N'============================================================';
EXEC [LefarmaDev].sys.sp_executesql @DdlTablas;
EXEC [LefarmaDev].sys.sp_executesql @DdlFuncion;
PRINT N'Estructura instalada en LefarmaDev.';

PRINT N'============================================================';
PRINT N'Instalando estructura en Lefarma (PRODUCCIÓN)...';
PRINT N'============================================================';
EXEC [Lefarma].sys.sp_executesql @DdlTablas;
EXEC [Lefarma].sys.sp_executesql @DdlFuncion;
PRINT N'Estructura instalada en Lefarma.';
GO

-- =============================================================================
-- 4. Permisos en AsokamDev y Asokam (SIN ASIGNACIONES)
--
-- Los permisos viven en la base Asokam de cada ambiente. El mismo bloque se
-- ejecuta contra cada catálogo; no toca RolesPermisos ni UsuariosPermisos.
-- =============================================================================

DECLARE @Permisos NVARCHAR(MAX) = N'
BEGIN TRY
    BEGIN TRANSACTION;

    INSERT INTO {ASOKAM}.app.Permisos
        (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion, EsActivo)
    SELECT
        p.codigo, p.nombre, p.descripcion,
        N''Configuración'', N''configuracion'', p.accion, 1
    FROM
    (
        VALUES
            (N''configuracion.view'',     N''Ver configuración'',              N''Consultar variables de configuración, su valor vigente y su disponibilidad por destino.'', N''view''),
            (N''configuracion.create'',   N''Crear variables de configuración'', N''Dar de alta variables nuevas en el catálogo de configuración.'', N''create''),
            (N''configuracion.update'',   N''Editar variables de configuración'', N''Cambiar valor, nombre, descripción y destinos de una variable existente.'', N''update''),
            (N''configuracion.history'',  N''Consultar historial de configuración'', N''Leer la bitácora de cambios y comparar revisiones de una variable.'', N''history''),
            (N''configuracion.restore'',  N''Restaurar configuración'',          N''Restaurar una revisión anterior como un cambio nuevo, con su propia entrada de bitácora.'', N''restore''),
            (N''configuracion.api_keys'', N''Administrar API keys de integración'', N''Crear, rotar, desactivar y consultar las llaves de consumidores externos.'', N''api_keys'')
    ) AS p (codigo, nombre, descripcion, accion)
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM {ASOKAM}.app.Permisos AS x
        WHERE x.CodigoPermiso = p.codigo
    );

    DECLARE @total_permisos INT;

    SELECT @total_permisos = COUNT(*)
    FROM {ASOKAM}.app.Permisos
    WHERE CodigoPermiso IN
    (
        N''configuracion.view'',
        N''configuracion.create'',
        N''configuracion.update'',
        N''configuracion.history'',
        N''configuracion.restore'',
        N''configuracion.api_keys''
    );

    IF @total_permisos < 6
        THROW 50110, N''No quedaron instalados los seis permisos configuracion.* esperados.'', 1;

    COMMIT TRANSACTION;

    PRINT CONCAT(
        N''Permisos configuracion.* disponibles en {ASOKAM}: '',
        @total_permisos,
        N'' de 6. Sin asignar a roles ni usuarios.'');

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    PRINT N''ERROR sembrando permisos en {ASOKAM}: '' + ERROR_MESSAGE();
    THROW;
END CATCH;
';

DECLARE @PermisosDev NVARCHAR(MAX) = REPLACE(@Permisos, N'{ASOKAM}', N'[AsokamDev]');
DECLARE @PermisosProd NVARCHAR(MAX) = REPLACE(@Permisos, N'{ASOKAM}', N'[Asokam]');

PRINT N'Sembrando permisos en AsokamDev...';
EXEC sys.sp_executesql @PermisosDev;

PRINT N'Sembrando permisos en Asokam (PRODUCCIÓN)...';
EXEC sys.sp_executesql @PermisosProd;

PRINT N'Permisos instalados en ambos ambientes, sin asignaciones.';
GO

-- =============================================================================
-- 5. Verificación final
-- =============================================================================

PRINT N'Verificación LefarmaDev:';
EXEC [LefarmaDev].sys.sp_executesql N'
SELECT
    DB_NAME() AS base,
    schema_name = s.name,
    object_name = o.name,
    object_type = o.type_desc
FROM sys.objects AS o
JOIN sys.schemas AS s ON s.schema_id = o.schema_id
WHERE s.name = N''config''
  AND o.name IN (N''variables'', N''variables_bitacora'', N''integraciones'', N''fn_obtener_variable'')
ORDER BY o.type_desc, o.name;
';

PRINT N'Verificación Lefarma (PRODUCCIÓN):';
EXEC [Lefarma].sys.sp_executesql N'
SELECT
    DB_NAME() AS base,
    schema_name = s.name,
    object_name = o.name,
    object_type = o.type_desc
FROM sys.objects AS o
JOIN sys.schemas AS s ON s.schema_id = o.schema_id
WHERE s.name = N''config''
  AND o.name IN (N''variables'', N''variables_bitacora'', N''integraciones'', N''fn_obtener_variable'')
ORDER BY o.type_desc, o.name;
';

PRINT N'Verificación de los seis permisos del módulo (debe devolver 6 y 6):';
SELECT
    ambiente = N'dev',
    total_permisos = (
        SELECT COUNT(*) FROM [AsokamDev].app.Permisos
        WHERE CodigoPermiso IN
        (
            N'configuracion.view', N'configuracion.create', N'configuracion.update',
            N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
        )
    )
UNION ALL
SELECT
    ambiente = N'prod',
    total_permisos = (
        SELECT COUNT(*) FROM [Asokam].app.Permisos
        WHERE CodigoPermiso IN
        (
            N'configuracion.view', N'configuracion.create', N'configuracion.update',
            N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
        )
    );

PRINT N'Instalación finalizada. No se creó ninguna asignación de permisos.';
GO

-- =============================================================================
-- ROLLBACK DE REFERENCIA — NO EJECUTAR
--
-- Destruye tablas y permisos en AMBOS ambientes. Separado por ambiente.
-- =============================================================================
/*
-- DEV
DELETE p
FROM [AsokamDev].app.Permisos AS p
WHERE p.CodigoPermiso IN
(
    N'configuracion.view', N'configuracion.create', N'configuracion.update',
    N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
);

EXEC [LefarmaDev].sys.sp_executesql N'
DROP FUNCTION IF EXISTS config.fn_obtener_variable;
DROP TABLE IF EXISTS config.variables_bitacora;
DROP TABLE IF EXISTS config.integraciones;
DROP TABLE IF EXISTS config.variables;
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE schema_id = SCHEMA_ID(N''config''))
    DROP SCHEMA config;
';
GO

-- PRODUCCIÓN
DELETE p
FROM [Asokam].app.Permisos AS p
WHERE p.CodigoPermiso IN
(
    N'configuracion.view', N'configuracion.create', N'configuracion.update',
    N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
);

EXEC [Lefarma].sys.sp_executesql N'
DROP FUNCTION IF EXISTS config.fn_obtener_variable;
DROP TABLE IF EXISTS config.variables_bitacora;
DROP TABLE IF EXISTS config.integraciones;
DROP TABLE IF EXISTS config.variables;
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE schema_id = SCHEMA_ID(N''config''))
    DROP SCHEMA config;
';
*/
