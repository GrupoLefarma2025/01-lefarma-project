-- =============================================================================
-- 0005_20261120-1200_configuracion_rangos.lefarma.sql
--
-- MÓDULO: Configuración (variables con forma de rango)
-- TIPO:   alter
-- TARGET: LefarmaDev / Lefarma (familia .lefarma)
--
-- QUÉ HACE (idempotente)
--   1) Amplía CK_variables_tipo_dato para aceptar los cuatro tipos de rango:
--      date_range, datetime_range, integer_range y decimal_range.
--   2) Recrea config.fn_obtener_variable para que esos cuatro tipos se
--      devuelvan completos, igual que object, array y json.
--   3) Deja una comprobación final con el CHECK y la función resultantes.
--
-- POR QUÉ
--   El editor ya permite declarar una variable como rango de fechas, de fecha y
--   hora, de enteros o de decimales. El valor se guarda como un objeto JSON
--   {"desde": ..., "hasta": ...}. Sin este script la base rechaza el tipo nuevo
--   y la función de lectura devolvería NULL para sus valores.
--
-- QUÉ NO HACE
--   - No crea tablas, columnas ni variables nuevas.
--   - No cambia claves, destinos ni la bitácora.
--   - No revalida los valores existentes: los tipos anteriores no cambian.
--
-- ORDEN: ejecutar después de 0004. Requiere SQL Server 2016 SP1 o superior.
--
-- GO: se usa solo para separar los tres bloques. CREATE OR ALTER FUNCTION debe
--   abrir su propio lote; DbUp, SSMS y «Explorador SQL» respetan GO.
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

IF OBJECT_ID(N'config.variables', N'U') IS NULL
BEGIN
    DECLARE @mensaje NVARCHAR(200) =
        N'Falta config.variables: aplica primero 0001_configuracion_esquema-base.';
    THROW 50001, @mensaje, 1;
END;

-- =============================================================================
-- 1. Tipos de dato admitidos
-- =============================================================================
IF EXISTS
(
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_variables_tipo_dato'
      AND parent_object_id = OBJECT_ID(N'config.variables')
)
BEGIN
    ALTER TABLE config.variables DROP CONSTRAINT CK_variables_tipo_dato;
    PRINT 'Retirado CK_variables_tipo_dato anterior.';
END

ALTER TABLE config.variables WITH CHECK
    ADD CONSTRAINT CK_variables_tipo_dato
    CHECK
    (
        tipo_dato IN
        (
            'string', 'text', 'integer', 'decimal', 'boolean', 'date',
            'time', 'datetime', 'enum', 'object', 'array', 'json',
            'date_range', 'datetime_range', 'integer_range', 'decimal_range'
        )
    );

PRINT 'Creado CK_variables_tipo_dato con los cuatro tipos de rango.';
GO

-- =============================================================================
-- 2. Lectura SQL de los rangos
-- =============================================================================
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

    -- Los tipos compuestos se devuelven completos, sin reinterpretarlos. Los
    -- rangos viven como objeto {"desde", "hasta"} y también viajan enteros.
    IF @tipo_dato IN
    (
        'object', 'array', 'json',
        'date_range', 'datetime_range', 'integer_range', 'decimal_range'
    )
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
-- 3. Comprobación final
-- =============================================================================
SELECT
    c.name         AS constraint_name,
    OBJECT_DEFINITION(c.object_id) AS definicion
FROM sys.check_constraints AS c
WHERE c.name = N'CK_variables_tipo_dato'
  AND c.parent_object_id = OBJECT_ID(N'config.variables');

SELECT
    OBJECT_NAME(f.object_id) AS funcion,
    f.modify_date
FROM sys.objects AS f
WHERE f.object_id = OBJECT_ID(N'config.fn_obtener_variable');
