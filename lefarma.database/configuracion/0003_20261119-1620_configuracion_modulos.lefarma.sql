-- =============================================================================
-- 0003_20261119-1620_configuracion_modulos.lefarma.sql
--
-- MÓDULO: Configuración (módulos dueños de las variables)
-- TIPO:   schema
-- TARGET: LefarmaDev / Lefarma (familia .lefarma)
--
-- QUÉ CREA (idempotente)
--   1) config.modulos            — catálogo de módulos que agrupan variables.
--   2) Módulo「global」sembrado  — destino de las variables compartidas y de
--                                  todas las variables que ya existían.
--   3) config.variables.id_modulo — FK opcional hacia config.modulos con su
--                                  índice de filtrado y backfill a「global」.
--
-- POR QUÉ
--   La clave de una variable nueva pasa a ser modulo.namespace.clave. El
--   módulo es el prefijo estable de la clave y el criterio de filtrado de la
--   pantalla; se guarda como FK para no depender del texto de la clave y para
--   poder desactivar un módulo sin reescribir sus variables.
--
-- QUÉ NO HACE
--   - No elimina variables ni les cambia la clave: las existentes conservan su
--     formato módulo.clave de dos segmentos y quedan ligadas a「global」.
--   - No crea triggers: la bitácora de variables sigue siendo append-only y la
--     escribe únicamente la API.
--   - No asigna permisos: el CRUD de módulos reutiliza los permisos de
--     Configuración (view/create/update) ya existentes en 0002.
--
-- ORDEN: ejecutar después de 0001 y 0002. Requiere SQL Server 2016 SP1 o
--   superior (igual que 0001).
--
-- LOTE ÚNICO: el script no usa GO a propósito, para que lo acepten tanto el
--   panel «Explorador SQL»/SSMS como el migrador DbUp (multiappcli.ps1 sql).
--   Las sentencias que tocan la columna nueva van en SQL dinámico: la columna
--   no existe cuando el lote se compila, pero sí cuando esa sentencia corre.
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

-- =============================================================================
-- 1. Catálogo de módulos
-- =============================================================================
IF OBJECT_ID(N'config.modulos', N'U') IS NULL
BEGIN
    CREATE TABLE config.modulos
    (
        id_modulo                 BIGINT IDENTITY(1,1) NOT NULL,
        clave                     NVARCHAR(50)  NOT NULL,
        nombre                    NVARCHAR(200) NOT NULL,
        descripcion               NVARCHAR(1000) NULL,
        orden                     INT           NOT NULL CONSTRAINT DF_config_modulos_orden DEFAULT (0),
        activo                    BIT           NOT NULL CONSTRAINT DF_config_modulos_activo DEFAULT (1),
        fecha_creacion            DATETIME2(3)  NOT NULL CONSTRAINT DF_config_modulos_fecha_creacion DEFAULT (SYSUTCDATETIME()),
        fecha_modificacion        DATETIME2(3)  NOT NULL CONSTRAINT DF_config_modulos_fecha_modificacion DEFAULT (SYSUTCDATETIME()),
        id_usuario_creacion       INT           NULL,
        id_usuario_modificacion   INT           NULL,
        row_version               ROWVERSION    NOT NULL,
        CONSTRAINT PK_config_modulos PRIMARY KEY CLUSTERED (id_modulo),
        CONSTRAINT UQ_config_modulos_clave UNIQUE (clave),
        -- Slug en minúsculas: letras, números y guion bajo; debe iniciar con letra.
        CONSTRAINT CK_config_modulos_clave_formato
            CHECK (clave LIKE '[a-z]%' AND clave NOT LIKE '%[^a-z0-9_]%' AND LEN(clave) BETWEEN 1 AND 50)
    );

    PRINT 'Creada config.modulos.';
END
ELSE
BEGIN
    PRINT 'config.modulos ya existe; sin cambios.';
END

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_config_modulos_orden'
      AND object_id = OBJECT_ID(N'config.modulos')
)
BEGIN
    CREATE INDEX IX_config_modulos_orden
        ON config.modulos (orden, nombre);
END

-- =============================================================================
-- 2. Módulo global (destino por omisión de las variables existentes)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM config.modulos WHERE clave = N'global')
BEGIN
    INSERT INTO config.modulos (clave, nombre, descripcion, orden, activo)
    VALUES (N'global', N'Global',
            N'Variables compartidas por todas las aplicaciones. Es el módulo por omisión de las variables anteriores a los módulos.',
            0, 1);

    PRINT 'Sembrado el módulo global.';
END

-- =============================================================================
-- 3. Vínculo de la variable con su módulo
-- =============================================================================
IF COL_LENGTH(N'config.variables', N'id_modulo') IS NULL
BEGIN
    ALTER TABLE config.variables
        ADD id_modulo BIGINT NULL;

    PRINT 'Añadida config.variables.id_modulo.';
END

-- Backfill: toda variable sin módulo queda en「global」.
EXEC (N'
UPDATE variables
SET id_modulo = global_modulo.id_modulo
FROM config.variables AS variables
CROSS JOIN config.modulos AS global_modulo
WHERE global_modulo.clave = N''global''
  AND variables.id_modulo IS NULL;
');

IF NOT EXISTS
(
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_config_variables_modulos'
      AND parent_object_id = OBJECT_ID(N'config.variables')
)
BEGIN
    EXEC (N'
ALTER TABLE config.variables WITH CHECK
    ADD CONSTRAINT FK_config_variables_modulos
    FOREIGN KEY (id_modulo) REFERENCES config.modulos (id_modulo);
');

    PRINT 'Creada la FK config.variables.id_modulo -> config.modulos.';
END

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_config_variables_id_modulo'
      AND object_id = OBJECT_ID(N'config.variables')
)
BEGIN
    EXEC (N'
CREATE INDEX IX_config_variables_id_modulo
    ON config.variables (id_modulo, clave);
');
END

-- =============================================================================
-- 4. Comprobación final
-- =============================================================================
EXEC (N'
SELECT
    m.id_modulo,
    m.clave,
    m.nombre,
    m.orden,
    m.activo,
    VariablesDelModulo = COUNT(v.id_variable)
FROM config.modulos AS m
LEFT JOIN config.variables AS v ON v.id_modulo = m.id_modulo
GROUP BY m.id_modulo, m.clave, m.nombre, m.orden, m.activo
ORDER BY m.orden, m.nombre;
');
