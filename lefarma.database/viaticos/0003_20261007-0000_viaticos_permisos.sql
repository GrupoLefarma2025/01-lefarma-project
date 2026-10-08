-- ============================================================
-- 0003_20261007-0000_viaticos_permisos.sql
-- Descripcion: Siembra los 4 codigos de permiso del modulo Viaticos
--              en Asokam.app.Permisos y asigna la matriz Rol↔Permiso
--              al rol SuperAdministrador, que hoy es el perfil
--              administrador de viaticos (ver seccion 5).
--
-- Crea: 4 filas en Asokam.app.Permisos (idempotente).
--       - viaticos.solicitar
--       - viaticos.ver_todos
--       - viaticos.autorizar
--       - viaticos.ajustar
--       4 filas en Asokam.app.RolesPermisos (idempotente): los 4
--       permisos viaticos.* sobre el rol SuperAdministrador.
--
-- Uso: Ejecutar manualmente contra LefarmaDev y Lefarma despues de
--      0002 (cluster municipios). Reejecutable: si los codigos ya
--      existen, imprime Skip y no duplica.
--
-- Origen: TODO 1 del plan costos/ruta-demo (ADR del feature cerrado
--         en lefarma.docs/viaticos/, todavia no publicado).
-- NO se aplica automaticamente: requiere ejecucion manual.
-- ============================================================

SET NOCOUNT ON;
GO

-- 1) viaticos.solicitar
IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'viaticos.solicitar')
BEGIN
    INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
    VALUES (N'viaticos.solicitar', N'Solicitar viaticos', N'Crear/editar solicitudes de viaticos propias', N'Viaticos', N'viaticos', N'solicitar');
    PRINT 'Permiso [viaticos.solicitar] insertado.';
END
ELSE
    PRINT 'Permiso [viaticos.solicitar] ya existe. Skip.';
GO

-- 2) viaticos.ver_todos
IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'viaticos.ver_todos')
BEGIN
    INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
    VALUES (N'viaticos.ver_todos', N'Ver todas las solicitudes de viaticos', N'Bandeja global: ver solicitudes de cualquier solicitante', N'Viaticos', N'viaticos', N'ver_todos');
    PRINT 'Permiso [viaticos.ver_todos] insertado.';
END
ELSE
    PRINT 'Permiso [viaticos.ver_todos] ya existe. Skip.';
GO

-- 3) viaticos.autorizar
IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'viaticos.autorizar')
BEGIN
    INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
    VALUES (N'viaticos.autorizar', N'Autorizar solicitudes de viaticos', N'Firma Autorizo sobre solicitudes de viaticos', N'Viaticos', N'viaticos', N'autorizar');
    PRINT 'Permiso [viaticos.autorizar] insertado.';
END
ELSE
    PRINT 'Permiso [viaticos.autorizar] ya existe. Skip.';
GO

-- 4) viaticos.ajustar
IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'viaticos.ajustar')
BEGIN
    INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
    VALUES (N'viaticos.ajustar', N'Ajustar montos de viaticos', N'Corregir importes y conceptos antes de autorizar', N'Viaticos', N'viaticos', N'ajustar');
    PRINT 'Permiso [viaticos.ajustar] insertado.';
END
ELSE
    PRINT 'Permiso [viaticos.ajustar] ya existe. Skip.';
GO

-- ============================================================
-- 5) Matriz Rol↔Permiso del modulo Viaticos
-- ------------------------------------------------------------
-- POR QUE SuperAdministrador y no un rol nuevo:
--   - El plan del modulo define que el perfil administrador de
--     viaticos es hoy el superadmin:
--     .omo/plans/viaticos-wizard-ruta-pi-busqueda.md:26
--     ("el perfil administrador (hoy superadmin)").
--   - Decision D10 del borrador: "El usuario dijo superadmin por
--     ahora":
--     .omo/drafts/viaticos-wizard-ruta-pi-busqueda.md:125.
--   - No existe todavia un rol de negocio "administrador de
--     viaticos"; por eso la eleccion es ambigua y se toma el rol
--     mas cercano a administrador (SuperAdministrador). Se deja
--     dicho aqui y en el reporte. NO se inventan roles.
--   - El rol existe y hoy concentra todos los permisos:
--     lefarma.database/legacy/026_rol_super_administrador.sql:26-31
--     (creacion) y :72-80 (matriz Rol↔Permiso).
--
-- Tabla/columnas: Asokam.app.RolesPermisos (IdRol, IdPermiso),
-- patron copiado de
-- lefarma.database/educacion-medica/0003_20260806-1556_educacion-medica_create-tablas-operacionales.lefarma.sql:2563-2580.
-- FechaAsignacion se omite porque tiene DEFAULT GETUTCDATE()
-- (lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Auth/RolPermisoConfiguration.cs).
-- Asokam.app es esquema LEGADO: no se altera ni se le agregan columnas.
--
-- Idempotente: NOT EXISTS por celda; reejecutar no duplica ni falla.
-- ============================================================

-- Guarda: si el rol no existe, fallar ruidosamente en vez de insertar
-- 0 filas en silencio. Patron de
-- lefarma.database/040_grant_rol_usuario_estandar_todos.sql:53-56.
-- El THROW aborta este batch completo, asi que los 4 INSERT de abajo
-- no corren ni imprimen un "asignado" falso cuando falta el rol.
DECLARE @IdRolSuperAdmin INT =
    (SELECT IdRol FROM Asokam.app.Roles
     WHERE NombreRol = N'SuperAdministrador' AND EsActivo = 1);
IF @IdRolSuperAdmin IS NULL
    THROW 50001, 'No existe el rol activo SuperAdministrador en Asokam.app.Roles; matriz de viaticos no asignada.', 1;

-- 5.1) viaticos.solicitar -> SuperAdministrador
IF NOT EXISTS (
    SELECT 1
    FROM Asokam.app.RolesPermisos rp
    JOIN Asokam.app.Roles r ON r.IdRol = rp.IdRol
    JOIN Asokam.app.Permisos p ON p.IdPermiso = rp.IdPermiso
    WHERE r.NombreRol = N'SuperAdministrador'
      AND p.CodigoPermiso = N'viaticos.solicitar')
BEGIN
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso
    FROM Asokam.app.Roles r
    CROSS JOIN Asokam.app.Permisos p
    WHERE r.NombreRol = N'SuperAdministrador'
      AND p.CodigoPermiso = N'viaticos.solicitar'
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);
    PRINT 'Permiso [viaticos.solicitar] asignado a rol [SuperAdministrador].';
END
ELSE
    PRINT 'Permiso [viaticos.solicitar] ya asignado a rol [SuperAdministrador]. Skip.';

-- 5.2) viaticos.ver_todos -> SuperAdministrador
IF NOT EXISTS (
    SELECT 1
    FROM Asokam.app.RolesPermisos rp
    JOIN Asokam.app.Roles r ON r.IdRol = rp.IdRol
    JOIN Asokam.app.Permisos p ON p.IdPermiso = rp.IdPermiso
    WHERE r.NombreRol = N'SuperAdministrador'
      AND p.CodigoPermiso = N'viaticos.ver_todos')
BEGIN
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso
    FROM Asokam.app.Roles r
    CROSS JOIN Asokam.app.Permisos p
    WHERE r.NombreRol = N'SuperAdministrador'
      AND p.CodigoPermiso = N'viaticos.ver_todos'
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);
    PRINT 'Permiso [viaticos.ver_todos] asignado a rol [SuperAdministrador].';
END
ELSE
    PRINT 'Permiso [viaticos.ver_todos] ya asignado a rol [SuperAdministrador]. Skip.';

-- 5.3) viaticos.autorizar -> SuperAdministrador
IF NOT EXISTS (
    SELECT 1
    FROM Asokam.app.RolesPermisos rp
    JOIN Asokam.app.Roles r ON r.IdRol = rp.IdRol
    JOIN Asokam.app.Permisos p ON p.IdPermiso = rp.IdPermiso
    WHERE r.NombreRol = N'SuperAdministrador'
      AND p.CodigoPermiso = N'viaticos.autorizar')
BEGIN
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso
    FROM Asokam.app.Roles r
    CROSS JOIN Asokam.app.Permisos p
    WHERE r.NombreRol = N'SuperAdministrador'
      AND p.CodigoPermiso = N'viaticos.autorizar'
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);
    PRINT 'Permiso [viaticos.autorizar] asignado a rol [SuperAdministrador].';
END
ELSE
    PRINT 'Permiso [viaticos.autorizar] ya asignado a rol [SuperAdministrador]. Skip.';

-- 5.4) viaticos.ajustar -> SuperAdministrador
IF NOT EXISTS (
    SELECT 1
    FROM Asokam.app.RolesPermisos rp
    JOIN Asokam.app.Roles r ON r.IdRol = rp.IdRol
    JOIN Asokam.app.Permisos p ON p.IdPermiso = rp.IdPermiso
    WHERE r.NombreRol = N'SuperAdministrador'
      AND p.CodigoPermiso = N'viaticos.ajustar')
BEGIN
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso
    FROM Asokam.app.Roles r
    CROSS JOIN Asokam.app.Permisos p
    WHERE r.NombreRol = N'SuperAdministrador'
      AND p.CodigoPermiso = N'viaticos.ajustar'
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);
    PRINT 'Permiso [viaticos.ajustar] asignado a rol [SuperAdministrador].';
END
ELSE
    PRINT 'Permiso [viaticos.ajustar] ya asignado a rol [SuperAdministrador]. Skip.';
GO

-- Resumen. Las subconsultas van en DECLARE y no dentro del PRINT:
-- PRINT CONCAT(..., (SELECT ...)) es rechazado por SQL Server con el
-- error 1046 "Subqueries are not allowed in this context".
DECLARE @permisosViaticos INT =
    (SELECT COUNT(*) FROM Asokam.app.Permisos WHERE CodigoPermiso LIKE N'viaticos.%');
DECLARE @asignadosViaticos INT =
    (SELECT COUNT(*)
     FROM Asokam.app.RolesPermisos rp
     JOIN Asokam.app.Roles r ON r.IdRol = rp.IdRol
     JOIN Asokam.app.Permisos p ON p.IdPermiso = rp.IdPermiso
     WHERE r.NombreRol = N'SuperAdministrador' AND p.CodigoPermiso LIKE N'viaticos.%');
PRINT CONCAT('Permisos viaticos en Asokam.app.Permisos: ', @permisosViaticos, ' filas.');
PRINT CONCAT('Asignaciones viaticos.* a SuperAdministrador: ', @asignadosViaticos, ' de 4.');
GO