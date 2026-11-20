-- =============================================================================
-- 0001_20261120-2015_telemetria_esquema-sql-server.lefarma.sql
--
-- MÓDULO: Telemetría (errores del navegador, clics, mapa de calor y visitas)
-- TIPO:   create
-- TARGET: LefarmaDev / Lefarma (familia .lefarma)
--
-- QUÉ HACE (idempotente)
--   1) Crea el esquema `telemetria` si no existe.
--   2) Crea seis tablas:
--      - telemetria.lote_procesado  → control de lotes ya aplicados (idempotencia)
--      - telemetria.evento_error    → errores del navegador
--      - telemetria.evento_clic     → clics por botón
--      - telemetria.mapa_calor      → rejilla de puntero por vista de página
--      - telemetria.visita          → una fila por visita (entrada y duración)
--      - telemetria.parametro        → clave/valor (guarda la sal del hash de usuario)
--   3) Crea los índices de consulta (fecha, huella, ruta, elemento).
--   4) Deja una comprobación final con el conteo de filas de cada tabla.
--
-- POR QUÉ
--   El almacén definitivo de la telemetría es la base de Lefarma (SQL Server),
--   no un archivo aparte: así entra en el respaldo normal, se consulta con las
--   mismas credenciales y no hay un segundo motor del que depender. El navegador
--   solo guarda un búfer local temporal (IndexedDB) para reenviar si se corta la
--   red; el servidor escribe por lotes en segundo plano.
--
--   `celdas` del mapa de calor se guarda como varbinary: un arreglo de enteros
--   de 32 bits little-endian, un valor por celda (columnas * filas). Es compacto
--   (1 800 celdas ≈ 7 KB) y el API lo agrega al consultar, con un tope de filas
--   por periodo para no crecer sin control.
--
-- QUÉ NO HACE
--   - No crea ni modifica usuarios, roles ni permisos (ya existen
--     `telemetria.ver` y `telemetria.administrar`).
--   - No borra información: solo crea lo que falta.
--   - No toca `ErrorLogs` (los errores del servidor siguen en su tabla actual).
--
-- ORDEN: independiente. Requiere SQL Server 2016 o superior (usa DATETIME2,
--   OFFSET/FETCH y `DROP TABLE IF EXISTS` no; se usan comprobaciones OBJECT_ID).
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

-- =============================================================================
-- 0. Esquema
-- =============================================================================
IF SCHEMA_ID(N'telemetria') IS NULL
    EXEC(N'CREATE SCHEMA telemetria;');
GO

-- =============================================================================
-- 1. Control de lotes ya aplicados
-- =============================================================================
IF OBJECT_ID(N'telemetria.lote_procesado', N'U') IS NULL
BEGIN
    CREATE TABLE telemetria.lote_procesado
    (
        lote_id     VARCHAR(64)    NOT NULL,
        recibido_en DATETIME2(3)   NOT NULL
            CONSTRAINT DF_telemetria_lote_procesado_recibido DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_telemetria_lote_procesado PRIMARY KEY CLUSTERED (lote_id)
    );
END;
GO

-- =============================================================================
-- 2. Errores del navegador
-- =============================================================================
IF OBJECT_ID(N'telemetria.evento_error', N'U') IS NULL
BEGIN
    CREATE TABLE telemetria.evento_error
    (
        id_error       BIGINT IDENTITY(1, 1) NOT NULL,
        recibido_en    DATETIME2(3)  NOT NULL,
        ocurrido_en    DATETIME2(3)  NOT NULL,
        lote_id        VARCHAR(64)   NOT NULL,
        visita_id      VARCHAR(64)   NULL,
        huella         CHAR(16)      NOT NULL,
        tipo_error     VARCHAR(20)   NOT NULL,
        mensaje        NVARCHAR(2048) NOT NULL,
        stack          NVARCHAR(MAX) NULL,
        url            NVARCHAR(2048) NULL,
        ruta           NVARCHAR(512) NOT NULL,
        metodo_http    VARCHAR(10)   NULL,
        estado_http    SMALLINT      NULL,
        request_id     VARCHAR(100)  NULL,
        navegador      NVARCHAR(256) NULL,
        version_app    VARCHAR(40)   NULL,
        usuario_hash   CHAR(32)      NULL,
        rol            NVARCHAR(100) NULL,
        contexto       NVARCHAR(MAX) NULL,
        entorno        VARCHAR(20)   NOT NULL,
        servidor       NVARCHAR(100) NULL,
        CONSTRAINT PK_telemetria_evento_error PRIMARY KEY CLUSTERED (id_error)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_telemetria_evento_error_recibido' AND object_id = OBJECT_ID(N'telemetria.evento_error'))
    CREATE INDEX IX_telemetria_evento_error_recibido
        ON telemetria.evento_error (recibido_en DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_telemetria_evento_error_huella' AND object_id = OBJECT_ID(N'telemetria.evento_error'))
    CREATE INDEX IX_telemetria_evento_error_huella
        ON telemetria.evento_error (huella, recibido_en DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_telemetria_evento_error_ruta' AND object_id = OBJECT_ID(N'telemetria.evento_error'))
    CREATE INDEX IX_telemetria_evento_error_ruta
        ON telemetria.evento_error (ruta, recibido_en DESC);
GO

-- =============================================================================
-- 3. Clics por botón
-- =============================================================================
IF OBJECT_ID(N'telemetria.evento_clic', N'U') IS NULL
BEGIN
    CREATE TABLE telemetria.evento_clic
    (
        id_clic        BIGINT IDENTITY(1, 1) NOT NULL,
        recibido_en    DATETIME2(3)  NOT NULL,
        ocurrido_en    DATETIME2(3)  NOT NULL,
        lote_id        VARCHAR(64)   NOT NULL,
        visita_id      VARCHAR(64)   NULL,
        ruta           NVARCHAR(512) NOT NULL,
        elemento       NVARCHAR(200) NULL,
        etiqueta       NVARCHAR(120) NULL,
        tipo_elemento  VARCHAR(30)   NULL,
        x              INT           NULL,
        y              INT           NULL,
        viewport_ancho SMALLINT      NULL,
        viewport_alto  SMALLINT      NULL,
        version_app    VARCHAR(40)   NULL,
        usuario_hash   CHAR(32)      NULL,
        rol            NVARCHAR(100) NULL,
        entorno        VARCHAR(20)   NOT NULL,
        servidor       NVARCHAR(100) NULL,
        CONSTRAINT PK_telemetria_evento_clic PRIMARY KEY CLUSTERED (id_clic)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_telemetria_evento_clic_recibido' AND object_id = OBJECT_ID(N'telemetria.evento_clic'))
    CREATE INDEX IX_telemetria_evento_clic_recibido
        ON telemetria.evento_clic (recibido_en DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_telemetria_evento_clic_ruta' AND object_id = OBJECT_ID(N'telemetria.evento_clic'))
    CREATE INDEX IX_telemetria_evento_clic_ruta
        ON telemetria.evento_clic (ruta, recibido_en DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_telemetria_evento_clic_elemento' AND object_id = OBJECT_ID(N'telemetria.evento_clic'))
    CREATE INDEX IX_telemetria_evento_clic_elemento
        ON telemetria.evento_clic (elemento);
GO

-- =============================================================================
-- 4. Mapa de calor (una fila por vista de página)
-- =============================================================================
IF OBJECT_ID(N'telemetria.mapa_calor', N'U') IS NULL
BEGIN
    CREATE TABLE telemetria.mapa_calor
    (
        id_mapa          BIGINT IDENTITY(1, 1) NOT NULL,
        recibido_en      DATETIME2(3)  NOT NULL,
        ocurrido_en      DATETIME2(3)  NOT NULL,
        lote_id          VARCHAR(64)   NOT NULL,
        visita_id        VARCHAR(64)   NULL,
        ruta             NVARCHAR(512) NOT NULL,
        columnas         SMALLINT      NOT NULL,
        filas            SMALLINT      NOT NULL,
        tamano_celda     TINYINT       NOT NULL,
        celdas           VARBINARY(MAX) NOT NULL,
        movimientos      INT           NOT NULL,
        scroll_max       INT           NULL,
        segundos_visibles INT          NULL,
        viewport_ancho   SMALLINT      NULL,
        viewport_alto    SMALLINT      NULL,
        version_app      VARCHAR(40)   NULL,
        usuario_hash     CHAR(32)      NULL,
        rol              NVARCHAR(100) NULL,
        entorno          VARCHAR(20)   NOT NULL,
        servidor         NVARCHAR(100) NULL,
        CONSTRAINT PK_telemetria_mapa_calor PRIMARY KEY CLUSTERED (id_mapa)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_telemetria_mapa_calor_ruta' AND object_id = OBJECT_ID(N'telemetria.mapa_calor'))
    CREATE INDEX IX_telemetria_mapa_calor_ruta
        ON telemetria.mapa_calor (ruta, recibido_en DESC);
GO

-- =============================================================================
-- 5. Visitas
-- =============================================================================
IF OBJECT_ID(N'telemetria.visita', N'U') IS NULL
BEGIN
    CREATE TABLE telemetria.visita
    (
        id_visita      BIGINT IDENTITY(1, 1) NOT NULL,
        recibido_en    DATETIME2(3)  NOT NULL,
        lote_id        VARCHAR(64)   NOT NULL,
        visita_id      VARCHAR(64)   NULL,
        ruta_entrada   NVARCHAR(512) NOT NULL,
        inicio         DATETIME2(3)  NULL,
        fin            DATETIME2(3)  NULL,
        segundos       INT           NULL,
        scroll_max     INT           NULL,
        navegador      NVARCHAR(256) NULL,
        sistema        VARCHAR(50)   NULL,
        viewport_ancho SMALLINT      NULL,
        viewport_alto  SMALLINT      NULL,
        version_app    VARCHAR(40)   NULL,
        usuario_hash   CHAR(32)      NULL,
        rol            NVARCHAR(100) NULL,
        entorno        VARCHAR(20)   NOT NULL,
        servidor       NVARCHAR(100) NULL,
        CONSTRAINT PK_telemetria_visita PRIMARY KEY CLUSTERED (id_visita)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_telemetria_visita_recibido' AND object_id = OBJECT_ID(N'telemetria.visita'))
    CREATE INDEX IX_telemetria_visita_recibido
        ON telemetria.visita (recibido_en DESC);
GO

-- =============================================================================
-- 6. Parámetros internos (sal de la huella del usuario)
-- =============================================================================
IF OBJECT_ID(N'telemetria.parametro', N'U') IS NULL
BEGIN
    CREATE TABLE telemetria.parametro
    (
        clave         VARCHAR(50)   NOT NULL,
        valor         NVARCHAR(500) NOT NULL,
        actualizado_en DATETIME2(3) NOT NULL
            CONSTRAINT DF_telemetria_parametro_actualizado DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_telemetria_parametro PRIMARY KEY CLUSTERED (clave)
    );
END;
GO

-- =============================================================================
-- 7. Comprobación final
-- =============================================================================
SELECT
    t.name                    AS tabla,
    SUM(p.rows)               AS filas
FROM sys.tables AS t
JOIN sys.partitions AS p
    ON p.object_id = t.object_id
   AND p.index_id IN (0, 1)
WHERE t.schema_id = SCHEMA_ID(N'telemetria')
GROUP BY t.name
ORDER BY t.name;
