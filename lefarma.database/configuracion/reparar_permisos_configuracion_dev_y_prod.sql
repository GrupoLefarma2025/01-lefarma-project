-- =============================================================================
-- REPARACIÓN FOCALIZADA: PERMISOS DEL MÓDULO CONFIGURACIÓN
--
-- Contexto:
--   El instalador creó correctamente tablas y función en LefarmaDev y Lefarma,
--   pero el bloque de permisos falló por una subconsulta dentro de PRINT CONCAT.
--   Este script NO toca tablas ni función: solo siembra los seis permisos en
--   AsokamDev y Asokam y verifica el resultado.
--
-- Ejecutar UNA VEZ en el mismo servidor donde existen ambas bases.
-- Es idempotente y NO asigna permisos a roles ni usuarios.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF DB_ID(N'AsokamDev') IS NULL
    THROW 50120, N'No existe AsokamDev. Script abortado.', 1;

IF DB_ID(N'Asokam') IS NULL
    THROW 50121, N'No existe Asokam. Script abortado.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    CREATE TABLE #configuracion_permisos
    (
        codigo      NVARCHAR(256)  NOT NULL PRIMARY KEY,
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

    INSERT INTO [AsokamDev].app.Permisos
        (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion, EsActivo)
    SELECT
        p.codigo,
        p.nombre,
        p.descripcion,
        N'Configuración',
        N'configuracion',
        p.accion,
        1
    FROM #configuracion_permisos AS p
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [AsokamDev].app.Permisos AS x
        WHERE x.CodigoPermiso = p.codigo
    );

    INSERT INTO [Asokam].app.Permisos
        (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion, EsActivo)
    SELECT
        p.codigo,
        p.nombre,
        p.descripcion,
        N'Configuración',
        N'configuracion',
        p.accion,
        1
    FROM #configuracion_permisos AS p
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [Asokam].app.Permisos AS x
        WHERE x.CodigoPermiso = p.codigo
    );

    DECLARE @dev INT = (
        SELECT COUNT(*)
        FROM [AsokamDev].app.Permisos
        WHERE CodigoPermiso IN
        (
            N'configuracion.view', N'configuracion.create', N'configuracion.update',
            N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
        )
    );

    DECLARE @prod INT = (
        SELECT COUNT(*)
        FROM [Asokam].app.Permisos
        WHERE CodigoPermiso IN
        (
            N'configuracion.view', N'configuracion.create', N'configuracion.update',
            N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
        )
    );

    IF @dev <> 6 OR @prod <> 6
    BEGIN
        DECLARE @mensaje NVARCHAR(500) = CONCAT(
            N'Permisos incompletos. AsokamDev=', @dev, N'/6, Asokam=', @prod, N'/6.');
        THROW 50122, @mensaje, 1;
    END

    COMMIT TRANSACTION;

    PRINT N'Permisos configuracion.* instalados correctamente en ambos ambientes.';

    SELECT
        ambiente = N'dev',
        total_permisos = @dev
    UNION ALL
    SELECT
        ambiente = N'prod',
        total_permisos = @prod;

    SELECT
        ambiente = N'dev',
        asignados_roles = (
            SELECT COUNT(*)
            FROM [AsokamDev].app.RolesPermisos AS rp
            JOIN [AsokamDev].app.Permisos AS p ON p.IdPermiso = rp.IdPermiso
            WHERE p.CodigoPermiso LIKE N'configuracion.%'
        ),
        asignados_usuarios = (
            SELECT COUNT(*)
            FROM [AsokamDev].app.UsuariosPermisos AS up
            JOIN [AsokamDev].app.Permisos AS p ON p.IdPermiso = up.IdPermiso
            WHERE p.CodigoPermiso LIKE N'configuracion.%'
        )
    UNION ALL
    SELECT
        ambiente = N'prod',
        asignados_roles = (
            SELECT COUNT(*)
            FROM [Asokam].app.RolesPermisos AS rp
            JOIN [Asokam].app.Permisos AS p ON p.IdPermiso = rp.IdPermiso
            WHERE p.CodigoPermiso LIKE N'configuracion.%'
        ),
        asignados_usuarios = (
            SELECT COUNT(*)
            FROM [Asokam].app.UsuariosPermisos AS up
            JOIN [Asokam].app.Permisos AS p ON p.IdPermiso = up.IdPermiso
            WHERE p.CodigoPermiso LIKE N'configuracion.%'
        );
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    PRINT N'ERROR instalando permisos de Configuración: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- =============================================================================
-- ROLLBACK DE REFERENCIA — NO EJECUTAR
-- =============================================================================
/*
DELETE rp
FROM [AsokamDev].app.RolesPermisos AS rp
JOIN [AsokamDev].app.Permisos AS p ON p.IdPermiso = rp.IdPermiso
WHERE p.CodigoPermiso IN
(
    N'configuracion.view', N'configuracion.create', N'configuracion.update',
    N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
);

DELETE up
FROM [AsokamDev].app.UsuariosPermisos AS up
JOIN [AsokamDev].app.Permisos AS p ON p.IdPermiso = up.IdPermiso
WHERE p.CodigoPermiso IN
(
    N'configuracion.view', N'configuracion.create', N'configuracion.update',
    N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
);

DELETE p
FROM [AsokamDev].app.Permisos AS p
WHERE p.CodigoPermiso IN
(
    N'configuracion.view', N'configuracion.create', N'configuracion.update',
    N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
);

DELETE rp
FROM [Asokam].app.RolesPermisos AS rp
JOIN [Asokam].app.Permisos AS p ON p.IdPermiso = rp.IdPermiso
WHERE p.CodigoPermiso IN
(
    N'configuracion.view', N'configuracion.create', N'configuracion.update',
    N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
);

DELETE up
FROM [Asokam].app.UsuariosPermisos AS up
JOIN [Asokam].app.Permisos AS p ON p.IdPermiso = up.IdPermiso
WHERE p.CodigoPermiso IN
(
    N'configuracion.view', N'configuracion.create', N'configuracion.update',
    N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
);

DELETE p
FROM [Asokam].app.Permisos AS p
WHERE p.CodigoPermiso IN
(
    N'configuracion.view', N'configuracion.create', N'configuracion.update',
    N'configuracion.history', N'configuracion.restore', N'configuracion.api_keys'
);
*/
