-- =============================================================================
-- 0001_20261104-1800_configuracion_esquema-base.lefarma.sql
--
-- MÓDULO: Configuración (variables de configuración + API keys de integración)
-- TIPO:   schema (archivo en la raíz de la app; el filtro --tipo no lo selecciona)
-- TARGET: LefarmaDev / Lefarma (familia .lefarma)
--
-- QUÉ CREA (idempotente)
--   1) Esquema config (si no existe).
--   2) config.variables            — tabla maestra de variables.
--   3) config.variables_bitacora   — bitácora append-only de cambios.
--   4) config.integraciones        — registro de API keys para consumidores
--                                    externos (hash SHA-256, nunca la llave).
--   5) Índices de consulta incremental y filtrado.
--   6) config.fn_obtener_variable  — lectura T-SQL de solo lectura.
--
-- QUÉ NO HACE
--   - No crea triggers. La bitácora es append-only por contrato: solo la API
--     escribe en ella. Un trigger de auditoría sobre la tabla maestra
--     duplicaría la bitácora y rompería la idempotencia de las mutaciones
--     (id_operacion) y la notificación SSE.
--   - No crea FKs hacia Asokam.app.Usuarios: los usuarios viven en otra base
--     y una FK cross-database no es posible. La API valida el id_usuario.
--   - No siembra variables ni API keys.
--   - No asigna permisos; eso vive en 0002_..._permisos.lefarma.sql.
--
-- ESCRITURAS DIRECTAS: no soportadas. Toda mutación de config.variables debe
--   pasar por la API del módulo para (a) incrementar version, (b) escribir la
--   bitácora con id_operacion idempotente y (c) emitir el evento SSE. Un UPDATE
--   directo deja la bitácora sin la revisión correspondiente y el frontend sin
--   notificación hasta el polling de 10 minutos.
--
-- ORDEN: ejecutar 0001 y después 0002. Requiere SQL Server 2016 SP1 o superior
--   (OPENJSON, ISJSON y CREATE OR ALTER FUNCTION). El nivel de compatibilidad
--   de la base debe ser 130 o superior para OPENJSON.
--
-- ESTADO: pendiente de aplicar en todos los ambientes. No se ha ejecutado.
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
-- 1. Esquema
-- =============================================================================
IF SCHEMA_ID(N'config') IS NULL
BEGIN
    EXEC(N'CREATE SCHEMA config;');
    PRINT N'Schema [config] creado.';
END
ELSE
    PRINT N'Schema [config] ya existe. Skip.';
GO

-- =============================================================================
-- 2. Tablas, constraints e índices (una sola transacción de DDL)
-- =============================================================================
BEGIN TRY
    BEGIN TRANSACTION;

    -- -------------------------------------------------------------------------
    -- 2.1 config.variables — tabla maestra / agregado
    -- -------------------------------------------------------------------------
    IF OBJECT_ID(N'config.variables', N'U') IS NULL
    BEGIN
        CREATE TABLE config.variables
        (
            id_variable             BIGINT IDENTITY(1,1) NOT NULL,
            clave                   NVARCHAR(200)  NOT NULL,
            nombre                  NVARCHAR(200)  NOT NULL,
            descripcion             NVARCHAR(1000) NULL,
            tipo_dato               VARCHAR(30)    NOT NULL,
            valor_json              NVARCHAR(MAX)  NOT NULL,
            esquema_json            NVARCHAR(MAX)  NULL,
            disponible_backend      BIT            NOT NULL
                                        CONSTRAINT DF_variables_disponible_backend      DEFAULT (0),
            disponible_frontend     BIT            NOT NULL
                                        CONSTRAINT DF_variables_disponible_frontend     DEFAULT (0),
            disponible_sql          BIT            NOT NULL
                                        CONSTRAINT DF_variables_disponible_sql          DEFAULT (0),
            disponible_integraciones BIT           NOT NULL
                                        CONSTRAINT DF_variables_disponible_integraciones DEFAULT (0),
            activo                  BIT            NOT NULL
                                        CONSTRAINT DF_variables_activo                  DEFAULT (1),
            fecha_creacion          DATETIME2(3)   NOT NULL
                                        CONSTRAINT DF_variables_fecha_creacion          DEFAULT (SYSUTCDATETIME()),
            fecha_modificacion      DATETIME2(3)   NOT NULL
                                        CONSTRAINT DF_variables_fecha_modificacion      DEFAULT (SYSUTCDATETIME()),
            id_usuario_creacion     INT            NULL,
            id_usuario_modificacion INT            NULL,
            version                 BIGINT         NOT NULL
                                        CONSTRAINT DF_variables_version                 DEFAULT (0),
            row_version             ROWVERSION     NOT NULL,

            CONSTRAINT PK_variables
                PRIMARY KEY CLUSTERED (id_variable),
            CONSTRAINT UQ_variables_clave
                UNIQUE (clave),
            CONSTRAINT CK_variables_tipo_dato
                CHECK (tipo_dato IN
                (
                    'string', 'text', 'integer', 'decimal', 'boolean', 'date',
                    'time', 'datetime', 'enum', 'object', 'array', 'json'
                )),
            CONSTRAINT CK_variables_valor_json
                CHECK (ISJSON(valor_json) = 1),
            CONSTRAINT CK_variables_esquema_json
                CHECK (esquema_json IS NULL OR ISJSON(esquema_json) = 1),
            CONSTRAINT CK_variables_destino
                CHECK
                (
                    disponible_backend = 1
                    OR disponible_frontend = 1
                    OR disponible_sql = 1
                    OR disponible_integraciones = 1
                )
        );

        PRINT N'Tabla [config.variables] creada.';
    END
    ELSE
        PRINT N'Tabla [config.variables] ya existe. Skip.';

    -- -------------------------------------------------------------------------
    -- 2.2 config.variables_bitacora — bitácora append-only
    --
    -- id_bitacora es la revisión global monótona (PK). El frontend hace
    -- polling incremental con id_bitacora > @ultimo y la API notifica por SSE.
    -- id_operacion identifica la mutación completa: reintentar la misma
    -- operación no duplica la fila (UNIQUE) y la API responde idempotente.
    -- id_bitacora_origen enlaza una restauración con la revisión restaurada.
    -- -------------------------------------------------------------------------
    IF OBJECT_ID(N'config.variables_bitacora', N'U') IS NULL
    BEGIN
        CREATE TABLE config.variables_bitacora
        (
            id_bitacora            BIGINT IDENTITY(1,1) NOT NULL,
            id_operacion           UNIQUEIDENTIFIER NOT NULL,
            id_variable            BIGINT           NOT NULL,
            clave                  NVARCHAR(200)    NOT NULL,
            accion                 VARCHAR(30)      NOT NULL,
            datos_anteriores_json  NVARCHAR(MAX)    NULL,
            datos_nuevos_json      NVARCHAR(MAX)    NOT NULL,
            id_bitacora_origen     BIGINT           NULL,
            id_usuario             INT              NULL,
            fecha_creacion         DATETIME2(3)     NOT NULL
                                        CONSTRAINT DF_variables_bitacora_fecha_creacion
                                        DEFAULT (SYSUTCDATETIME()),

            CONSTRAINT PK_variables_bitacora
                PRIMARY KEY CLUSTERED (id_bitacora),
            CONSTRAINT UQ_variables_bitacora_id_operacion
                UNIQUE (id_operacion),
            CONSTRAINT FK_variables_bitacora_variable
                FOREIGN KEY (id_variable)
                REFERENCES config.variables (id_variable),
            CONSTRAINT FK_variables_bitacora_origen
                FOREIGN KEY (id_bitacora_origen)
                REFERENCES config.variables_bitacora (id_bitacora),
            CONSTRAINT CK_variables_bitacora_accion
                CHECK (accion IN ('crear', 'actualizar', 'desactivar', 'reactivar', 'restaurar')),
            CONSTRAINT CK_variables_bitacora_anteriores_json
                CHECK (datos_anteriores_json IS NULL OR ISJSON(datos_anteriores_json) = 1),
            CONSTRAINT CK_variables_bitacora_nuevos_json
                CHECK (ISJSON(datos_nuevos_json) = 1)
        );

        PRINT N'Tabla [config.variables_bitacora] creada.';
    END
    ELSE
        PRINT N'Tabla [config.variables_bitacora] ya existe. Skip.';

    -- -------------------------------------------------------------------------
    -- 2.3 config.integraciones — API keys de consumidores externos
    --
    -- Solo se guarda SHA-256 hexadecimal en hash_llave. La llave en claro se
    -- entrega una vez al consumidor y no se persiste. prefijo_llave permite
    -- localizar la fila sin exponer el hash completo en logs.
    -- -------------------------------------------------------------------------
    IF OBJECT_ID(N'config.integraciones', N'U') IS NULL
    BEGIN
        CREATE TABLE config.integraciones
        (
            id_integracion         INT IDENTITY(1,1) NOT NULL,
            nombre                 NVARCHAR(200)    NOT NULL,
            prefijo_llave          NVARCHAR(24)     NOT NULL,
            hash_llave             CHAR(64)         NOT NULL,
            claves_permitidas_json NVARCHAR(MAX)    NULL,
            activo                 BIT              NOT NULL
                                        CONSTRAINT DF_integraciones_activo             DEFAULT (1),
            fecha_creacion         DATETIME2(3)     NOT NULL
                                        CONSTRAINT DF_integraciones_fecha_creacion     DEFAULT (SYSUTCDATETIME()),
            fecha_expiracion       DATETIME2(3)     NULL,
            ultima_utilizacion     DATETIME2(3)     NULL,

            CONSTRAINT PK_integraciones
                PRIMARY KEY CLUSTERED (id_integracion),
            CONSTRAINT UQ_integraciones_prefijo_llave
                UNIQUE (prefijo_llave),
            CONSTRAINT UQ_integraciones_hash_llave
                UNIQUE (hash_llave),
            CONSTRAINT CK_integraciones_claves_permitidas_json
                CHECK (claves_permitidas_json IS NULL OR ISJSON(claves_permitidas_json) = 1)
        );

        PRINT N'Tabla [config.integraciones] creada.';
    END
    ELSE
        PRINT N'Tabla [config.integraciones] ya existe. Skip.';

    -- -------------------------------------------------------------------------
    -- 2.4 Índices de consulta incremental y filtrado
    --     (id_bitacora ya es la PK clustered; id_operacion ya es UNIQUE)
    -- -------------------------------------------------------------------------
    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE name = N'IX_variables_bitacora_id_variable'
          AND object_id = OBJECT_ID(N'config.variables_bitacora')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_variables_bitacora_id_variable
            ON config.variables_bitacora (id_variable, id_bitacora DESC);
        PRINT N'Índice [IX_variables_bitacora_id_variable] creado.';
    END
    ELSE
        PRINT N'Índice [IX_variables_bitacora_id_variable] ya existe. Skip.';

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE name = N'IX_variables_bitacora_fecha_creacion'
          AND object_id = OBJECT_ID(N'config.variables_bitacora')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_variables_bitacora_fecha_creacion
            ON config.variables_bitacora (fecha_creacion);
        PRINT N'Índice [IX_variables_bitacora_fecha_creacion] creado.';
    END
    ELSE
        PRINT N'Índice [IX_variables_bitacora_fecha_creacion] ya existe. Skip.';

    COMMIT TRANSACTION;
    PRINT N'0001: DDL de tablas e índices confirmado.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    PRINT N'ERROR en 0001 (esquema): ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- =============================================================================
-- 3. Función de lectura para SQL
--
-- Va en su propio batch porque CREATE FUNCTION debe ser la primera sentencia
-- del batch. Por eso no se puede envolver en el TRY/CATCH ni en la misma
-- transacción que las tablas; es DDL idempotente y seguro de reejecutar.
-- Si esta parte falla (por ejemplo, compatibilidad menor a 130), las tablas ya
-- quedaron confirmadas: reejecutar el script completo es seguro y no duplica
-- nada.
--
-- CONTRATO
--   - Solo lee variables activo = 1 Y disponible_sql = 1.
--   - Devuelve NULL si la clave no existe o no está disponible para SQL.
--   - object/array/json  -> valor_json completo (texto JSON).
--   - boolean            -> '1' o '0' (acepta true/false o 1/0 en el JSON).
--   - string/text/date/time/datetime/enum -> escalar sin comillas JSON.
--   - integer/decimal    -> token numérico JSON sin comillas, tal como se
--                           almacena (la API valida el tipo al guardar).
--                           El separador decimal es el punto de JSON; si el
--                           llamador convierte a decimal, use una cultura
--                           invariante (PARSE ... USING 'en-US') o TRY_CONVERT
--                           en un contexto de lenguaje fijo.
--   - Un objeto/array guardado bajo un tipo escalar es una inconsistencia:
--     devuelve NULL en lugar de una propiedad arbitraria.
--
-- Sin SCHEMABINDING para que OPENJSON pueda usarse sin restricciones de
--   resolución de objetos en todas las versiones soportadas.
--
-- RENDIMIENTO: cada llamada resuelve la clave por el índice único de
--   config.variables. NO la invoques por fila en consultas masivas
--   (WHERE x = config.fn_obtener_variable(...)): el optimizador no la
--   inlinea de forma fiable. Léela una vez en una variable o resuélvela con
--   un JOIN contra config.variables.
--
-- EJEMPLOS DE USO (comentados, no se ejecutan aquí)
--   SELECT TRY_CONVERT(INT, config.fn_obtener_variable(N'modulo.max_intentos'));
--   SELECT j.[key], j.[value]
--   FROM OPENJSON(config.fn_obtener_variable(N'modulo.objeto')) AS j;
--   SELECT config.fn_obtener_variable(N'clave.inexistente');  -- NULL
-- =============================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

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

    -- Los tipos compuestos se devuelven completos, sin reinterpretarlos.
    IF @tipo_dato IN ('object', 'array', 'json')
        RETURN @valor_json;

    -- Inconsistencia: valor compuesto bajo un tipo escalar. Se usa el primer
    -- carácter (el CHECK ISJSON ya garantizó que el valor es JSON válido) para
    -- no depender de ISJSON con tipo, disponible solo desde SQL Server 2022.
    IF LEFT(LTRIM(@valor_json), 1) IN (N'{', N'[')
        RETURN NULL;

    -- OPENJSON no acepta un escalar JSON en la raíz si no se le indica un
    -- path WITH. Se envuelve temporalmente en {"v": ...} para desescapar
    -- cadenas y conservar NVARCHAR(MAX) sin el límite de 4000 caracteres de
    -- JSON_VALUE.
    SELECT @valor_escalar = j.[value]
    FROM OPENJSON(CONCAT(N'{"v":', @valor_json, N'}'))
        WITH ([value] NVARCHAR(MAX) N'$."v"') AS j;

    IF @tipo_dato = 'boolean'
    BEGIN
        -- LOWER + TRIM evita depender del idioma o de la collation para
        -- reconocer los literales JSON true/false.
        SET @normalizado = LOWER(LTRIM(RTRIM(@valor_escalar)));

        IF @normalizado = N'1' OR @normalizado = N'true'
            RETURN N'1';

        IF @normalizado = N'0' OR @normalizado = N'false'
            RETURN N'0';

        RETURN NULL;
    END

    RETURN @valor_escalar;
END;
GO

-- =============================================================================
-- 4. Verificación (solo lectura; no modifica nada)
-- =============================================================================
SELECT
    esquema   = s.name,
    objeto    = o.name,
    tipo      = o.type_desc
FROM sys.objects AS o
JOIN sys.schemas AS s ON s.schema_id = o.schema_id
WHERE s.name = N'config'
  AND o.name IN (N'variables', N'variables_bitacora', N'integraciones', N'fn_obtener_variable')
ORDER BY o.type_desc, o.name;
GO

-- =============================================================================
-- ROLLBACK DE REFERENCIA — NO EJECUTAR
-- Solo para deshacer el módulo en un ambiente de pruebas. Destruye datos.
-- =============================================================================
/*
DROP FUNCTION IF EXISTS config.fn_obtener_variable;
GO
DROP TABLE IF EXISTS config.variables_bitacora;
GO
DROP TABLE IF EXISTS config.integraciones;
GO
DROP TABLE IF EXISTS config.variables;
GO
-- El schema solo se elimina si no quedan objetos del módulo.
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE schema_id = SCHEMA_ID(N'config'))
    DROP SCHEMA config;
GO
*/
