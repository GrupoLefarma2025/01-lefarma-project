-- ============================================================================
-- LEFARMA - CARATULA POR CUENTA DE PROVEEDOR (migracion de 1:1 -> 1:N)
-- ============================================================================
-- Fecha: 2026-07-09
-- Cambio SDD: caratulas-por-cuenta-proveedor (Slice A - fundacion de datos)
-- Descripcion:
--   1. Agrega caratula_path a catalogos.proveedor_forma_pago_cuentas (la nueva
--      ubicacion de la caratula, ahora por cuenta bancaria).
--   2. Agrega caratula_path a staging.proveedor_forma_pago_cuentas (espejo).
--   3. Agrega id_cuen a staging.proveedor_forma_pago_cuentas.
--      FIX DE DRIFT: el modelo C# (StagingProveedorFormaPagoCuenta.IdCuen) y su
--      configuracion EF (map -> id_cuen) existen desde la migracion 008, pero el
--      script 008 NUNCA creo la columna fisica en la tabla de staging. Este paso
--      corrige el drift de forma idempotente. NO revertir (bug latente).
--   4. Migra los caratulas legacy (catalogos.proveedores_detalle.caratula_path)
--      a la PRIMERA CUENTA ACTIVA de cada proveedor (MIN(id_cuenta) = orden de
--      insercion). Determinista, sin empates. Proveedores sin cuenta activa
--      conservan su caratula legacy intacta (no se pierde informacion).
--   5. Asegura que catalogos.proveedores_detalle.caratula_path quede nullable
--      (defensivo: 007 ya la creo NULL). La columna NO se elimina para preservar
--      rollback.
--
-- Idempotencia: todos los ALTER usan guard COL_LENGTH(); el UPDATE solo actua
-- donde el destino es NULL, por lo que re-ejecutar el script no duplica ni
-- sobrescribe datos.
--
-- Orden de despliegue (design S10): DB(025) -> backend -> frontend (mismo dia).
-- La columna legacy nunca se elimina (sin perdida de datos).
-- ============================================================================

USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'INICIANDO 025_caratula_por_cuenta.sql';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- PASO 1: catalogos.proveedor_forma_pago_cuentas + caratula_path
-- (nueva ubicacion de la caratula, a nivel de cuenta bancaria)
-- Tipo: NVARCHAR(500) NULL  (igual que catalogos.proveedores_detalle.caratula_path en 007)
-- ============================================================================
IF COL_LENGTH('catalogos.proveedor_forma_pago_cuentas', 'caratula_path') IS NULL
BEGIN
    ALTER TABLE catalogos.proveedor_forma_pago_cuentas
    ADD caratula_path NVARCHAR(500) NULL;

    PRINT 'Columna [catalogos].[proveedor_forma_pago_cuentas].[caratula_path] agregada';
END
ELSE
BEGIN
    PRINT 'Columna [catalogos].[proveedor_forma_pago_cuentas].[caratula_path] ya existe (sin cambios)';
END
GO

-- ============================================================================
-- PASO 2: staging.proveedor_forma_pago_cuentas + caratula_path (espejo)
-- Tipo: NVARCHAR(500) NULL  (consistente con la tabla live del paso 1)
-- ============================================================================
IF COL_LENGTH('staging.proveedor_forma_pago_cuentas', 'caratula_path') IS NULL
BEGIN
    ALTER TABLE staging.proveedor_forma_pago_cuentas
    ADD caratula_path NVARCHAR(500) NULL;

    PRINT 'Columna [staging].[proveedor_forma_pago_cuentas].[caratula_path] agregada';
END
ELSE
BEGIN
    PRINT 'Columna [staging].[proveedor_forma_pago_cuentas].[caratula_path] ya existe (sin cambios)';
END
GO

-- ============================================================================
-- PASO 3: staging.proveedor_forma_pago_cuentas + id_cuen  (FIX DE DRIFT)
-- La entidad C# StagingProveedorFormaPagoCuenta.IdCuen y su mapping EF
-- (-> id_cuen) existen desde 008, pero el script 008 NO creo la columna fisica.
-- Sin esta columna, cualquier escritura de staging que preserve IdCuen falla.
-- ============================================================================
IF COL_LENGTH('staging.proveedor_forma_pago_cuentas', 'id_cuen') IS NULL
BEGIN
    ALTER TABLE staging.proveedor_forma_pago_cuentas
    ADD id_cuen INT NULL;

    PRINT 'Columna [staging].[proveedor_forma_pago_cuentas].[id_cuen] agregada (fix de drift)';
END
ELSE
BEGIN
    PRINT 'Columna [staging].[proveedor_forma_pago_cuentas].[id_cuen] ya existe (sin cambios)';
END
GO

-- ============================================================================
-- PASO 4: Migracion de datos legacy
-- Copia catalogos.proveedores_detalle.caratula_path hacia la PRIMERA CUENTA
-- ACTIVA de cada proveedor (MIN(id_cuenta) = orden de insercion, sin empates).
-- - Determinista: ROW_NUMBER() PARTITION BY id_proveedor ORDER BY id_cuenta ASC
--   con rn = 1 equivale a MIN(id_cuenta) por proveedor.
-- - Idempotente: solo actualiza donde el destino (c.caratula_path) es NULL.
-- - Sin perdida: proveedores sin cuenta activa no aparecen en el CTE, por lo
--   que su caratula legacy en proveedores_detalle se conserva intacta.
-- ============================================================================
;WITH PrimerCuentaActiva AS (
    SELECT
        c.id_cuenta,
        c.id_proveedor,
        c.caratula_path,
        ROW_NUMBER() OVER (
            PARTITION BY c.id_proveedor
            ORDER BY c.id_cuenta ASC
        ) AS rn
    FROM catalogos.proveedor_forma_pago_cuentas c
    WHERE c.activo = 1
)
UPDATE pca
SET pca.caratula_path = d.caratula_path
FROM PrimerCuentaActiva pca
INNER JOIN catalogos.proveedores_detalle d
    ON d.id_proveedor = pca.id_proveedor
WHERE pca.rn = 1
    AND d.caratula_path IS NOT NULL
    AND pca.caratula_path IS NULL;

PRINT 'Migracion de caratulas legacy -> primera cuenta activa completada';
GO

-- ============================================================================
-- PASO 5: Asegurar que catalogos.proveedores_detalle.caratula_path sea nullable
-- (defensivo: 007 ya la creo NVARCHAR(500) NULL). La columna NO se elimina para
-- preservar el rollback. Re-declarar el tipo/nullability es idempotente.
-- ============================================================================
IF COL_LENGTH('catalogos.proveedores_detalle', 'caratula_path') IS NOT NULL
BEGIN
    ALTER TABLE catalogos.proveedores_detalle
    ALTER COLUMN caratula_path NVARCHAR(500) NULL;

    PRINT 'Columna [catalogos].[proveedores_detalle].[caratula_path] confirmada como nullable (legacy preservada)';
END
GO

-- ============================================================================
-- PASO 6: Verificacion
-- ============================================================================
PRINT '';
PRINT 'Verificando estructura despues de la migracion...';
SELECT
    'catalogos.proveedor_forma_pago_cuentas.caratula_path' AS columna,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'catalogos'
    AND TABLE_NAME = 'proveedor_forma_pago_cuentas'
    AND COLUMN_NAME = 'caratula_path'

UNION ALL

SELECT
    'staging.proveedor_forma_pago_cuentas.caratula_path' AS columna,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'staging'
    AND TABLE_NAME = 'proveedor_forma_pago_cuentas'
    AND COLUMN_NAME = 'caratula_path'

UNION ALL

SELECT
    'staging.proveedor_forma_pago_cuentas.id_cuen' AS columna,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'staging'
    AND TABLE_NAME = 'proveedor_forma_pago_cuentas'
    AND COLUMN_NAME = 'id_cuen';

PRINT '';
PRINT 'Conteo de cuentas que ahora tienen caratula migrada:';
SELECT
    COUNT(*) AS cuentas_con_caratula
FROM catalogos.proveedor_forma_pago_cuentas
WHERE caratula_path IS NOT NULL;
GO

PRINT '';
PRINT '============================================================';
PRINT '025_caratula_por_cuenta.sql COMPLETADO';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- ROLLBACK (notas - NO se ejecuta automaticamente)
-- ============================================================================
-- El cambio es deliberadamente reversible y sin perdida de datos:
--
-- 1. La columna legacy catalogos.proveedores_detalle.caratula_path NUNCA se
--    elimino (paso 5 solo asegura nullability). Un rollback de la aplicacion
--    que aun lea la columna legacy seguira funcionando.
--
-- 2. Para revertir SOLO la nueva ubicacion por cuenta (manteniendo el fix de
--    drift id_cuen, que corrige un bug y NO debe revertirse):
--
--    -- Opcional: limpiar caratulas migradas a cuentas (solo si se descarta
--    -- toda la feature). No es necesario para rollback de comportamiento.
--    -- UPDATE catalogos.proveedor_forma_pago_cuentas SET caratula_path = NULL;
--
--    -- Eliminar las columnas caratula_path agregadas (si se desea):
--    -- IF COL_LENGTH('staging.proveedor_forma_pago_cuentas','caratula_path') IS NOT NULL
--    --     ALTER TABLE staging.proveedor_forma_pago_cuentas DROP COLUMN caratula_path;
--    -- IF COL_LENGTH('catalogos.proveedor_forma_pago_cuentas','caratula_path') IS NOT NULL
--    --     ALTER TABLE catalogos.proveedor_forma_pago_cuentas DROP COLUMN caratula_path;
--
-- 3. NUNCA revertir el paso 3 (id_cuen en staging): corrige un drift real que
--    hacia fallar las escrituras de staging que preservaban IdCuen.
-- ============================================================================
