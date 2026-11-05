/* ============================================================
   046 — Permiso de cambio de empresa para 1a42
   BD destino: Asokam

   PERMISO
   -------
   orden_compra.puede_cambiar_empresa (IdPermiso 65)
   ya existe. Este script:
     1. lo retira del rol "Usuario Estandar" (hoy lo tienen 226
        usuarios y por eso no restringe nada);
     2. lo asigna directamente al usuario 1a42 (IdUsuario 98).

   Conserva las asignaciones de Administrador, Gerente de Finanzas
   y SuperAdministrador. Es idempotente.

   ROLLBACK
   --------
   - Borrar la fila directa de 1a42 en app.UsuariosPermisos.
   - Reinsertar el permiso 65 para el rol Usuario Estandar si se
     necesita restaurar el comportamiento anterior.
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @idPermiso INT = (
    SELECT IdPermiso
    FROM app.Permisos
    WHERE CodigoPermiso = 'orden_compra.puede_cambiar_empresa'
      AND EsActivo = 1
);

DECLARE @idUsuario INT = (
    SELECT IdUsuario
    FROM app.Usuarios
    WHERE SamAccountName = '1a42'
      AND EsActivo = 1
);

DECLARE @idRolEstandar INT = (
    SELECT IdRol
    FROM app.Roles
    WHERE NombreRol = 'Usuario Estandar'
      AND EsActivo = 1
);

IF @idPermiso IS NULL
    THROW 50001, 'No existe el permiso activo orden_compra.puede_cambiar_empresa.', 1;

IF @idUsuario IS NULL
    THROW 50002, 'No existe el usuario activo 1a42.', 1;

IF @idRolEstandar IS NULL
    THROW 50003, 'No existe el rol activo Usuario Estandar.', 1;

BEGIN TRANSACTION;

-- El permiso deja de ser global para todos los usuarios estandar.
DELETE FROM app.RolesPermisos
WHERE IdRol = @idRolEstandar
  AND IdPermiso = @idPermiso;

-- Asignacion directa y vigente para 1a42.
IF EXISTS (
    SELECT 1
    FROM app.UsuariosPermisos
    WHERE IdUsuario = @idUsuario
      AND IdPermiso = @idPermiso
)
BEGIN
    UPDATE app.UsuariosPermisos
    SET EsConcedido = 1,
        FechaAsignacion = GETDATE(),
        FechaExpiracion = NULL
    WHERE IdUsuario = @idUsuario
      AND IdPermiso = @idPermiso;
END
ELSE
BEGIN
    INSERT INTO app.UsuariosPermisos
        (IdUsuario, IdPermiso, EsConcedido, FechaAsignacion, FechaExpiracion)
    VALUES
        (@idUsuario, @idPermiso, 1, GETDATE(), NULL);
END;

COMMIT TRANSACTION;

-- Verificacion: 1a42 debe tener la asignacion directa y el rol estandar ya no.
SELECT u.IdUsuario, u.SamAccountName, u.NombreCompleto,
       p.CodigoPermiso, up.EsConcedido, up.FechaExpiracion
FROM app.UsuariosPermisos up
INNER JOIN app.Usuarios u ON u.IdUsuario = up.IdUsuario
INNER JOIN app.Permisos p ON p.IdPermiso = up.IdPermiso
WHERE up.IdUsuario = @idUsuario
  AND up.IdPermiso = @idPermiso;

SELECT COUNT(*) AS rol_estandar_con_permiso
FROM app.RolesPermisos
WHERE IdRol = @idRolEstandar
  AND IdPermiso = @idPermiso;
