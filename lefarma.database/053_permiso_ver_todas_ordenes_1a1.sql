/* ============================================================
   053 — Permiso "ver todas las órdenes" para 1a1
         (Luis Antonio Pozo Urquizo)
   BD destino: Asokam (producción)

   CONTEXTO
   --------
   Requerimiento 2026-11-04: en /cxp/ordenes/autorizaciones (Autorizaciones
   OC) el usuario 1a1 solo veía las órdenes donde participa. Se le da el
   permiso para ver TODAS las órdenes de compra.

   PERMISO QUE AGREGA (directo al usuario, vía app.UsuariosPermisos)
   ----------------------------------------------------------------
   - orden_compra.puede_ver_todas_las_ordenes (IdPermiso 49)
     Habilita el filtro "Todos los creadores" en la bandeja y hace que
     GET /api/ordenes no filtre por participante/rol.

   NO toca roles. No concede ordenes.crear ni orden_compra.crear.
   Es idempotente: re-ejecutar no duplica filas.

   ROLLBACK
   --------
   DELETE up
   FROM app.UsuariosPermisos up
   INNER JOIN app.Usuarios u ON u.IdUsuario = up.IdUsuario
   INNER JOIN app.Permisos p ON p.IdPermiso = up.IdPermiso
   WHERE u.SamAccountName = '1a1'
     AND p.CodigoPermiso = 'orden_compra.puede_ver_todas_las_ordenes';
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @idUsuario INT = (
    SELECT IdUsuario
    FROM app.Usuarios
    WHERE SamAccountName = '1a1'
      AND EsActivo = 1
);

DECLARE @idPermiso INT = (
    SELECT IdPermiso
    FROM app.Permisos
    WHERE CodigoPermiso = 'orden_compra.puede_ver_todas_las_ordenes'
      AND EsActivo = 1
);

IF @idUsuario IS NULL
    THROW 50001, 'No existe el usuario activo 1a1.', 1;

IF @idPermiso IS NULL
    THROW 50002, 'No existe el permiso activo orden_compra.puede_ver_todas_las_ordenes.', 1;

BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1
    FROM app.UsuariosPermisos
    WHERE IdUsuario = @idUsuario
      AND IdPermiso = @idPermiso
)
BEGIN
    INSERT INTO app.UsuariosPermisos
        (IdUsuario, IdPermiso, EsConcedido, FechaAsignacion, FechaExpiracion)
    VALUES
        (@idUsuario, @idPermiso, 1, GETUTCDATE(), NULL);
END

COMMIT TRANSACTION;

-- Verificación
SELECT u.IdUsuario, u.SamAccountName, u.NombreCompleto,
       p.CodigoPermiso, up.EsConcedido
FROM app.UsuariosPermisos up
INNER JOIN app.Usuarios u ON u.IdUsuario = up.IdUsuario
INNER JOIN app.Permisos p ON p.IdPermiso = up.IdPermiso
WHERE u.SamAccountName = '1a1'
  AND p.CodigoPermiso = 'orden_compra.puede_ver_todas_las_ordenes';
