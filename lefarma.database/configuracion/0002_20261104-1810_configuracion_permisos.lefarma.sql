-- =============================================================================
-- 0002_20261104-1810_configuracion_permisos.lefarma.sql
--
-- MÓDULO: Configuración
-- TIPO:   data (archivo en la raíz de la app; el filtro --tipo no lo selecciona)
-- TARGET: LefarmaDev / Lefarma (familia .lefarma)
--
-- QUÉ HACE
--   Siembra 6 permisos del módulo en la base Asokam hermana:
--     configuracion.view       Ver variables y su estado
--     configuracion.create     Crear variables
--     configuracion.update     Editar variables y cambiar disponibilidad
--     configuracion.history    Consultar la bitácora
--     configuracion.restore    Restaurar una revisión anterior
--     configuracion.api_keys   Administrar API keys de integraciones
--
--   NO ASIGNA NINGÚN PERMISO A ROLES NI A USUARIOS. Por decisión del usuario,
--   los permisos quedan ocultos para todos salvo que un administrador los
--   asigne explícitamente. Ojo: en este sistema el rol SuperAdministrador NO
--   tiene un bypass de código; su acceso total proviene de tener todos los
--   permisos asignados en app.RolesPermisos (ver legacy/026). Por lo tanto,
--   tras aplicar este script NADIE verá el módulo, incluido SuperAdministrador,
--   hasta que se haga una asignación explícita fuera de este archivo.
--
-- POR QUÉ LA BASE ASOKAM ES DINÁMICA
--   Los permisos viven en Asokam (dev: AsokamDev; prod: Asokam), no en
--   Lefarma. El script se ejecuta con la conexión de Lefarma, así que resuelve
--   la base hermana por nombre y usa SQL dinámico con QUOTENAME. Mapeo:
--     LefarmaDev, LefarmaDev2 -> AsokamDev
--     Lefarma                 -> Asokam
--   Cualquier otro nombre aborta con error: sembrar permisos en el Asokam
--   equivocado es peor que fallar.
--
-- REQUISITOS DE EJECUCIÓN
--   - El login debe tener SELECT/INSERT sobre <Asokam>.app.Permisos y SELECT
--     sobre <Asokam>.app.RolesPermisos y <Asokam>.app.UsuariosPermisos.
--   - Ambas bases deben estar en la misma instancia (las de migrations.config
--     lo están), para que la transacción no escale a MSDTC.
--   - Asokam.app.Permisos debe existir con sus columnas actuales.
--
-- IDEMPOTENCIA
--   Inserta solo los códigos que faltan (NOT EXISTS por CodigoPermiso). No
--   actualiza ni reactiva filas existentes: si un permiso ya existe con
--   EsActivo = 0, este script lo deja como está; el conteo final puede dar 6 y
--   el permiso seguir inactivo.
--
-- ESTADO: pendiente de aplicar en todos los ambientes. No se ha ejecutado.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    -- -------------------------------------------------------------------------
    -- 1. Resolver la base Asokam hermana
    -- -------------------------------------------------------------------------
    DECLARE @db_actual sysname = DB_NAME();
    DECLARE @db_asokam sysname;
    DECLARE @mensaje   NVARCHAR(2048);

    IF @db_actual = N'Lefarma'
        SET @db_asokam = N'Asokam';
    ELSE IF @db_actual = N'LefarmaDev'
        SET @db_asokam = N'AsokamDev';
    ELSE IF @db_actual = N'LefarmaDev2'
        SET @db_asokam = N'AsokamDev';
    ELSE
    BEGIN
        SET @mensaje = CONCAT(
            N'0002 solo puede ejecutarse sobre Lefarma, LefarmaDev o LefarmaDev2. ',
            N'Base actual: [', @db_actual, N']. Se aborta para no sembrar permisos ',
            N'en una base Asokam equivocada.'
        );
        THROW 50020, @mensaje, 1;
    END

    IF DB_ID(@db_asokam) IS NULL
    BEGIN
        SET @mensaje = CONCAT(
            N'No existe la base Asokam hermana esperada: [', @db_asokam,
            N']. Verifique el mapeo de ambientes antes de ejecutar 0002.'
        );
        THROW 50021, @mensaje, 1;
    END

    IF OBJECT_ID(QUOTENAME(@db_asokam) + N'.app.Permisos', N'U') IS NULL
    BEGIN
        SET @mensaje = CONCAT(
            N'No existe [', @db_asokam, N'].app.Permisos. ',
            N'Verifique que la base Asokam hermana tenga el esquema app.'
        );
        THROW 50022, @mensaje, 1;
    END

    PRINT CONCAT(N'Base actual: [', @db_actual, N'] -> Asokam hermana: [', @db_asokam, N'].');

    -- -------------------------------------------------------------------------
    -- 2. Catálogo de permisos a sembrar
    --    La tabla temporal es visible para el SQL dinámico de esta sesión.
    -- -------------------------------------------------------------------------
    IF OBJECT_ID(N'tempdb..#configuracion_permisos') IS NOT NULL
        DROP TABLE #configuracion_permisos;

    CREATE TABLE #configuracion_permisos
    (
        codigo      NVARCHAR(256)  NOT NULL,
        nombre      NVARCHAR(512)  NOT NULL,
        descripcion NVARCHAR(1024) NULL,
        accion      NVARCHAR(256)  NOT NULL
    );

    INSERT INTO #configuracion_permisos (codigo, nombre, descripcion, accion)
    VALUES
        (N'configuracion.view',
         N'Ver configuración',
         N'Consultar variables de configuración, su valor vigente y su disponibilidad por destino.',
         N'view'),
        (N'configuracion.create',
         N'Crear variables de configuración',
         N'Dar de alta variables nuevas en el catálogo de configuración.',
         N'create'),
        (N'configuracion.update',
         N'Editar variables de configuración',
         N'Cambiar valor, nombre, descripción y destinos de una variable existente.',
         N'update'),
        (N'configuracion.history',
         N'Consultar historial de configuración',
         N'Leer la bitácora de cambios y comparar revisiones de una variable.',
         N'history'),
        (N'configuracion.restore',
         N'Restaurar configuración',
         N'Restaurar una revisión anterior como un cambio nuevo, con su propia entrada de bitácora.',
         N'restore'),
        (N'configuracion.api_keys',
         N'Administrar API keys de integración',
         N'Crear, rotar, desactivar y consultar las llaves de consumidores externos.',
         N'api_keys');

    -- -------------------------------------------------------------------------
    -- 3. Insertar solo los códigos faltantes (sin roles ni usuarios)
    -- -------------------------------------------------------------------------
    DECLARE @sql NVARCHAR(MAX);

    SET @sql = N'
        INSERT INTO ' + QUOTENAME(@db_asokam) + N'.app.Permisos
            (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion, EsActivo)
        SELECT
            p.codigo,
            p.nombre,
            p.descripcion,
            N''Configuración'',
            N''configuracion'',
            p.accion,
            1
        FROM #configuracion_permisos AS p
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM ' + QUOTENAME(@db_asokam) + N'.app.Permisos AS x
            WHERE x.CodigoPermiso = p.codigo
        );';

    EXEC sys.sp_executesql @sql;

    DROP TABLE #configuracion_permisos;

    -- -------------------------------------------------------------------------
    -- 4. Verificación: 6 permisos presentes y 0 asignaciones
    -- -------------------------------------------------------------------------
    DECLARE @total     INT = 0;
    DECLARE @asignados INT = 0;
    DECLARE @asignados_usuario INT = 0;

    SET @sql = N'
        SELECT @total = COUNT(*)
        FROM ' + QUOTENAME(@db_asokam) + N'.app.Permisos
        WHERE CodigoPermiso IN
        (
            N''configuracion.view'', N''configuracion.create'', N''configuracion.update'',
            N''configuracion.history'', N''configuracion.restore'', N''configuracion.api_keys''
        );

        SELECT @asignados = COUNT(*)
        FROM ' + QUOTENAME(@db_asokam) + N'.app.RolesPermisos AS rp
        JOIN ' + QUOTENAME(@db_asokam) + N'.app.Permisos AS p
          ON p.IdPermiso = rp.IdPermiso
        WHERE p.CodigoPermiso IN
        (
            N''configuracion.view'', N''configuracion.create'', N''configuracion.update'',
            N''configuracion.history'', N''configuracion.restore'', N''configuracion.api_keys''
        );

        SELECT @asignados_usuario = COUNT(*)
        FROM ' + QUOTENAME(@db_asokam) + N'.app.UsuariosPermisos AS up
        JOIN ' + QUOTENAME(@db_asokam) + N'.app.Permisos AS p
          ON p.IdPermiso = up.IdPermiso
        WHERE p.CodigoPermiso IN
        (
            N''configuracion.view'', N''configuracion.create'', N''configuracion.update'',
            N''configuracion.history'', N''configuracion.restore'', N''configuracion.api_keys''
        );';

    EXEC sys.sp_executesql
        @sql,
        N'@total INT OUTPUT, @asignados INT OUTPUT, @asignados_usuario INT OUTPUT',
        @total = @total OUTPUT,
        @asignados = @asignados OUTPUT,
        @asignados_usuario = @asignados_usuario OUTPUT;

    PRINT CONCAT(N'Permisos configuracion.* en [', @db_asokam, N'].app.Permisos: ', @total, N' de 6.');

    IF @total < 6
    BEGIN
        SET @mensaje = CONCAT(
            N'Se esperaban 6 permisos configuracion.* en [', @db_asokam,
            N'].app.Permisos y solo hay ', @total, N'. Se revierte el script.'
        );
        THROW 50023, @mensaje, 1;
    END

    IF @asignados > 0 OR @asignados_usuario > 0
        PRINT CONCAT(
            N'AVISO: ya existen asignaciones configuracion.* (roles: ', @asignados,
            N', usuarios: ', @asignados_usuario,
            N'). Este script no las creó ni las modificó; revise si fueron intencionales.'
        );
    ELSE
        PRINT N'OK: los permisos configuracion.* no están asignados a ningún rol ni usuario. Quedan ocultos por diseño.';

    COMMIT TRANSACTION;
    PRINT N'0002 completado: permisos de Configuración sembrados en Asokam (sin asignaciones).';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    PRINT N'ERROR en 0002 (permisos): ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- =============================================================================
-- ROLLBACK DE REFERENCIA — NO EJECUTAR
-- Destruye datos. Reemplace [Asokam] por [AsokamDev] en desarrollo.
-- =============================================================================
/*
-- 1) Quitar asignaciones (solo si este módulo las tuviera; el seed no las crea).
DELETE rp
FROM [Asokam].app.RolesPermisos AS rp
JOIN [Asokam].app.Permisos AS p ON p.IdPermiso = rp.IdPermiso
WHERE p.CodigoPermiso IN
(
    N'configuracion.view',
    N'configuracion.create',
    N'configuracion.update',
    N'configuracion.history',
    N'configuracion.restore',
    N'configuracion.api_keys'
);
GO

-- 2) Quitar las asignaciones directas a usuarios.
DELETE up
FROM [Asokam].app.UsuariosPermisos AS up
JOIN [Asokam].app.Permisos AS p ON p.IdPermiso = up.IdPermiso
WHERE p.CodigoPermiso IN
(
    N'configuracion.view',
    N'configuracion.create',
    N'configuracion.update',
    N'configuracion.history',
    N'configuracion.restore',
    N'configuracion.api_keys'
);
GO

-- 3) Borrar los permisos.
DELETE FROM [Asokam].app.Permisos
WHERE CodigoPermiso IN
(
    N'configuracion.view',
    N'configuracion.create',
    N'configuracion.update',
    N'configuracion.history',
    N'configuracion.restore',
    N'configuracion.api_keys'
);
GO

-- 4) Esquema del módulo (ver también 0001).
DROP FUNCTION IF EXISTS config.fn_obtener_variable;
GO
DROP TABLE IF EXISTS config.variables_bitacora;
GO
DROP TABLE IF EXISTS config.integraciones;
GO
DROP TABLE IF EXISTS config.variables;
GO
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE schema_id = SCHEMA_ID(N'config'))
    DROP SCHEMA config;
GO
*/
