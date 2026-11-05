/* ============================================================
   052 — Permisos de dashboard para 1a1 (Luis Antonio Pozo Urquizo)
   BD destino: Asokam (producción)

   CONTEXTO
   --------
   Requerimiento 2026-11-04: el usuario 1a1 (IdUsuario 23) veía el
   dashboard vacío ("Aún nada para mostrar") porque le faltaba el
   permiso menu.dashboard. Se le dan los permisos para ver el
   dashboard COMPLETO (incluye tarjeta de presupuesto y actividad
   reciente), sin permisos administrativos ni de creación de órdenes.

   PERMISOS QUE AGREGA (directos al usuario, vía app.UsuariosPermisos)
   -------------------------------------------------------------------
   - menu.dashboard                    (IdPermiso 68)  ver el dashboard
   - dashboard.puede_ver_presupuesto   (IdPermiso 50)  tarjeta de presupuesto
   - dashboard.ver_actividad_reciente  (IdPermiso 123) tarjeta de actividad

   NO toca roles (Gerente General / Gerente de Ventas / Usuario
   Estandar siguen igual) y NO concede ordenes.crear ni
   orden_compra.crear. Es idempotente: re-ejecutar no duplica filas.

   ROLLBACK
   --------
   DELETE up
   FROM app.UsuariosPermisos up
   INNER JOIN app.Usuarios u ON u.IdUsuario = up.IdUsuario
   INNER JOIN app.Permisos p ON p.IdPermiso = up.IdPermiso
   WHERE u.SamAccountName = '1a1'
     AND p.CodigoPermiso IN ('menu.dashboard',
                             'dashboard.puede_ver_presupuesto',
                             'dashboard.ver_actividad_reciente');
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @idUsuario INT = (
    SELECT IdUsuario
    FROM app.Usuarios
    WHERE SamAccountName = '1a1'
      AND EsActivo = 1
);

IF @idUsuario IS NULL
    THROW 50001, 'No existe el usuario activo 1a1.', 1;

IF NOT EXISTS (
    SELECT 1
    FROM app.Permisos
    WHERE CodigoPermiso = 'menu.dashboard'
      AND EsActivo = 1
)
    THROW 50002, 'No existe el permiso activo menu.dashboard.', 1;

BEGIN TRANSACTION;

INSERT INTO app.UsuariosPermisos
    (IdUsuario, IdPermiso, EsConcedido, FechaAsignacion, FechaExpiracion)
SELECT @idUsuario, p.IdPermiso, 1, GETUTCDATE(), NULL
FROM app.Permisos p
WHERE p.CodigoPermiso IN
      ('menu.dashboard',
       'dashboard.puede_ver_presupuesto',
       'dashboard.ver_actividad_reciente')
  AND p.EsActivo = 1
  AND NOT EXISTS (
      SELECT 1
      FROM app.UsuariosPermisos up
      WHERE up.IdUsuario = @idUsuario
        AND up.IdPermiso = p.IdPermiso
  );

COMMIT TRANSACTION;

-- Verificación: permisos efectivos de 1a1 relacionados con dashboard.
SELECT u.IdUsuario, u.SamAccountName, u.NombreCompleto,
       p.CodigoPermiso, up.EsConcedido
FROM app.UsuariosPermisos up
INNER JOIN app.Usuarios u ON u.IdUsuario = up.IdUsuario
INNER JOIN app.Permisos p ON p.IdPermiso = up.IdPermiso
WHERE u.SamAccountName = '1a1'
  AND p.CodigoPermiso IN
      ('menu.dashboard',
       'dashboard.puede_ver_presupuesto',
       'dashboard.ver_actividad_reciente')
ORDER BY p.CodigoPermiso;
