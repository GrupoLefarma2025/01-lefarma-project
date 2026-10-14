/* ============================================================
   040 — Grant rol 'Usuario Estandar' a TODOS los usuarios
   BD destino: Asokam (192.168.4.2)

   POR QUE EXISTE ESTE SCRIPT
   --------------------------
   Requerimiento 2026-10-05 del usuario: el 100% de app.Usuarios debe
   tener el rol 'Usuario Estandar'. La seccion 8 del 039 ya garantiza
   eso para ACTIVOS no-anonimos no-robot (hoy 0 faltantes), pero quedan
   12 huecos historicos que el SP NUNCA va a cubrir por diseño:

     - 11 INACTIVOS (bajas): 17, 18, 19 (duplicados de carlos.guzman),
       26 (1a31 Vacante CEDIS), 31 (1a44), 35 (38), 41 (r1), 42 (r8),
       76 (39), 192 (3a901), 228 (cc10).
     - 1 ANONIMA activa: 237 (Oswaldo Rojas Galindo, SamAccountName
       NULL; la seccion 5/8 del SP trabaja desde el match RH por sam,
       asi que una anonima nunca recibe rol ni usuario_detalle).

   POR QUE CREAR Y NO MODIFICAR EL SP 039
   --------------------------------------
   Una baja no quita roles y el job no crea anonimas: el grant unico
   basta. Modificar la seccion 8 del 039 para rolear inactivos/anonimos
   en cada corrida ensuciaria la sincronizacion sin beneficio.

   ALCANCE / EFECTO
   ----------------
   - INSERT idempotente (NOT EXISTS): re-ejecutar no duplica nada.
   - No toca asignaciones existentes ni otros roles.
   - Cuentas inactivas con rol siguen sin poder loguearse (EsActivo=0
     domina); el cambio es de completitud, no de acceso.

   VERIFICACION (al final del script; debe dar 0)
   ----------------------------------------------
   SELECT COUNT(*) FROM app.Usuarios u
   WHERE NOT EXISTS (SELECT 1 FROM app.UsuariosRoles ur
                     WHERE ur.IdUsuario = u.IdUsuario AND ur.IdRol = 2);

   ROLLBACK
   --------
   DELETE FROM app.UsuariosRoles
   WHERE IdRol = 2
     AND IdUsuario IN (17, 18, 19, 26, 31, 35, 41, 42, 76, 192, 228, 237)
     AND FechaAsignacion >= '2026-10-05';   -- getutcdate() al insertar

   DONDE EJECUTAR
   --------------
   Servidor 192.168.4.2, base Asokam, con coreapi o SSMS
   (el MCP de SQL es solo lectura; aiorion NO tiene INSERT en Asokam).
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @rol INT = (SELECT IdRol FROM app.Roles
                    WHERE NombreRol = 'Usuario Estandar' AND EsActivo = 1);
IF @rol IS NULL
    THROW 50001, 'No existe el rol activo Usuario Estandar en app.Roles.', 1;

DECLARE @asignados TABLE (IdUsuario INT NOT NULL);

BEGIN TRANSACTION;

INSERT INTO app.UsuariosRoles (IdUsuario, IdRol)
OUTPUT inserted.IdUsuario INTO @asignados (IdUsuario)
SELECT u.IdUsuario, @rol
FROM app.Usuarios u
WHERE NOT EXISTS (SELECT 1 FROM app.UsuariosRoles ur
                  WHERE ur.IdUsuario = u.IdUsuario AND ur.IdRol = @rol);

COMMIT TRANSACTION;

DECLARE @n INT = (SELECT COUNT(*) FROM @asignados);
PRINT CONCAT('Roles Usuario Estandar asignados: ', @n);

/* Auditoria: a quien se le dio el rol en esta corrida */
SELECT u.IdUsuario, u.SamAccountName, u.NombreCompleto, u.Dominio,
       u.EsActivo, u.EsAnonimo, u.EsRobot, ur.FechaAsignacion
FROM @asignados a
JOIN app.Usuarios u ON u.IdUsuario = a.IdUsuario
JOIN app.UsuariosRoles ur ON ur.IdUsuario = a.IdUsuario AND ur.IdRol = @rol
ORDER BY u.IdUsuario;

/* Verificacion: ningun usuario (activo o no, anonimo o no) sin el rol */
SELECT COUNT(*) AS usuarios_sin_rol_estandar
FROM app.Usuarios u
WHERE NOT EXISTS (SELECT 1 FROM app.UsuariosRoles ur
                  WHERE ur.IdUsuario = u.IdUsuario AND ur.IdRol = @rol);
