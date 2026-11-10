/* ============================================================
   054 — Rol "Gerente de RH" para samaccountname 2
         (2 Adan Chavarria Flores, GERENTE DE RECURSOS HUMANOS)
   BD destino: Asokam (producción) y AsokamDev (desarrollo);
   el script es el mismo en ambos entornos (no referencia el nombre
   de la base) y es idempotente.

   CONTEXTO
   --------
   Requerimiento 2026-11-09: el gerente de Recursos Humanos
   (IdUsuario 39, SamAccountName '2') necesita:
     1. Acceso a CxP desde el hub (/hub → tarjeta CxP).
     2. Bandeja de autorizaciones de órdenes de compra.
     3. Dashboard (contenido; sin tarjetas de presupuesto/actividad).

   Hoy solo tiene el rol "Usuario Estandar" (IdRol 2), compartido por
   todos los usuarios, por lo que NO se modifica ese rol. Se crea el
   rol de puesto "Gerente de RH" con exactamente los tres permisos y
   se le asigna al usuario, conservando el rol Usuario Estandar.

   PERMISOS DEL ROL (por código, no por IdPermiso)
   -----------------------------------------------
   - baseapp.hub.puede_ver_cxp  (141)  tarjeta CxP en el hub
   - ordenes.ver_listado         (60)   menú Bandeja de autorizaciones
                                        (/cxp/ordenes/autorizaciones)
   - menu.dashboard              (68)   contenido del Dashboard
                                        (/cxp/dashboard, /dashboard)

   La bandeja mostrará las órdenes detenidas en los pasos del workflow
   donde el usuario participa (por usuario o por rol vigente); no se
   concede visibilidad de todas las órdenes.

   NO toca roles existentes ni permisos directos del usuario.
   Idempotente: re-ejecutar no duplica rol, matriz rol↔permiso ni
   asignación usuario↔rol.

   ROLLBACK
   --------
   DELETE ur
   FROM app.UsuariosRoles ur
   INNER JOIN app.Usuarios u ON u.IdUsuario = ur.IdUsuario
   INNER JOIN app.Roles r ON r.IdRol = ur.IdRol
   WHERE u.SamAccountName = '2' AND r.NombreRol = 'Gerente de RH';

   DELETE rp
   FROM app.RolesPermisos rp
   INNER JOIN app.Roles r ON r.IdRol = rp.IdRol
   WHERE r.NombreRol = 'Gerente de RH';

   DELETE FROM app.Roles WHERE NombreRol = 'Gerente de RH';

   DONDE EJECUTAR
   --------------
   Producción: base Asokam. Desarrollo: base AsokamDev.
   El backend cachea permisos ~5 minutos; el cambio se refleja solo.
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- 1. Rol de puesto (solo si no existe; NombreRol es UNIQUE).
INSERT INTO app.Roles (NombreRol, Descripcion, EsActivo, EsSistema)
SELECT N'Gerente de RH',
       N'Gerente de Recursos Humanos: acceso a CxP desde el hub, bandeja de autorizaciones de órdenes de compra y dashboard.',
       1,
       0
WHERE NOT EXISTS (
    SELECT 1 FROM app.Roles WHERE NombreRol = N'Gerente de RH'
);

-- 2. Matriz rol↔permiso (idempotente; los permisos deben existir activos).
INSERT INTO app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
FROM app.Roles r
CROSS JOIN app.Permisos p
WHERE r.NombreRol = N'Gerente de RH'
  AND p.CodigoPermiso IN (N'baseapp.hub.puede_ver_cxp',
                          N'ordenes.ver_listado',
                          N'menu.dashboard')
  AND p.EsActivo = 1
  AND NOT EXISTS (
      SELECT 1
      FROM app.RolesPermisos rp
      WHERE rp.IdRol = r.IdRol
        AND rp.IdPermiso = p.IdPermiso
  );

-- 3. Asignación usuario↔rol (idempotente; conserva Usuario Estandar).
INSERT INTO app.UsuariosRoles (IdUsuario, IdRol, FechaAsignacion, FechaExpiracion)
SELECT u.IdUsuario, r.IdRol, GETUTCDATE(), NULL
FROM app.Usuarios u
CROSS JOIN app.Roles r
WHERE u.SamAccountName = N'2'
  AND u.EsActivo = 1
  AND r.NombreRol = N'Gerente de RH'
  AND NOT EXISTS (
      SELECT 1
      FROM app.UsuariosRoles ur
      WHERE ur.IdUsuario = u.IdUsuario
        AND ur.IdRol = r.IdRol
  );

-- Verificación 1: permisos del rol (deben ser exactamente los 3).
SELECT r.IdRol, r.NombreRol, r.EsActivo,
       p.CodigoPermiso, p.NombrePermiso
FROM app.Roles r
INNER JOIN app.RolesPermisos rp ON rp.IdRol = r.IdRol
INNER JOIN app.Permisos p ON p.IdPermiso = rp.IdPermiso
WHERE r.NombreRol = N'Gerente de RH'
ORDER BY p.CodigoPermiso;

-- Verificación 2: roles del usuario (Usuario Estandar + Gerente de RH).
SELECT u.IdUsuario, u.SamAccountName, u.NombreCompleto, u.Puesto,
       r.IdRol, r.NombreRol, ur.FechaAsignacion
FROM app.Usuarios u
INNER JOIN app.UsuariosRoles ur ON ur.IdUsuario = u.IdUsuario
INNER JOIN app.Roles r ON r.IdRol = ur.IdRol
WHERE u.SamAccountName = N'2'
ORDER BY r.NombreRol;
