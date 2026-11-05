/* ============================================================
   050 — Permiso de cambio de empresa para Grupo Lefarma
   BD destino: Asokam (192.168.4.2)

   CONTEXTO
   --------
   El permiso orden_compra.puede_cambiar_empresa (IdPermiso 65)
   quedó en el script 046 solo con asignación directa a 1a42,
   después de retirarlo del rol "Usuario Estandar".

   Requerimiento 2026-11-02: todos los usuarios cuya empresa en
   config.usuario_detalle sea "Grupo Lefarma" (id_empresa 12)
   deben poder cambiar de empresa al crear una orden de compra,
   porque una OC no puede quedar emitida con la empresa Grupo
   Lefarma (regla de negocio en CrearOrdenCompra).

   ALCANCE
   -------
   - INSERT idempotente (NOT EXISTS) en app.UsuariosPermisos.
   - Incluye activos e inactivos: una baja no puede loguearse y,
     si se reactiva, ya trae el permiso.
   - No toca roles ni asignaciones existentes.
   - La fuente de usuarios es Lefarma.config.usuario_detalle, que
     vive en la misma instancia que Asokam.

   VERIFICACION
   ------------
   El SELECT final debe devolver 0 en usuarios_sin_permiso.

   ROLLBACK
   --------
   DELETE up
   FROM app.UsuariosPermisos up
   INNER JOIN app.Permisos p ON p.IdPermiso = up.IdPermiso
   WHERE p.CodigoPermiso = 'orden_compra.puede_cambiar_empresa'
     AND up.IdUsuario IN (
         SELECT ud.id_usuario
         FROM Lefarma.config.usuario_detalle ud
         WHERE ud.id_empresa = 12
     )
     AND up.FechaAsignacion >= '2026-11-02';
   (conserva la asignación previa de 1a42 porque no pertenece a
    la empresa Grupo Lefarma)

   DONDE EJECUTAR
   --------------
   Servidor 192.168.4.2, base Asokam, con coreapi o SSMS.
   En desarrollo, sustituir Lefarma por LefarmaDev y ejecutar
   sobre AsokamDev.
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @idPermiso INT = (
    SELECT IdPermiso
    FROM app.Permisos
    WHERE CodigoPermiso = 'orden_compra.puede_cambiar_empresa'
      AND EsActivo = 1
);

IF @idPermiso IS NULL
    THROW 50001, 'No existe el permiso activo orden_compra.puede_cambiar_empresa.', 1;

DECLARE @idEmpresaGrupoLefarma INT = (
    SELECT id_empresa
    FROM Lefarma.catalogos.empresas
    WHERE nombre = 'Grupo Lefarma'
      AND activo = 1
);

IF @idEmpresaGrupoLefarma IS NULL
    THROW 50002, 'No existe la empresa activa Grupo Lefarma.', 1;

DECLARE @asignados TABLE (IdUsuario INT NOT NULL);

BEGIN TRANSACTION;

INSERT INTO app.UsuariosPermisos
    (IdUsuario, IdPermiso, EsConcedido, FechaAsignacion, FechaExpiracion)
OUTPUT inserted.IdUsuario INTO @asignados (IdUsuario)
SELECT ud.id_usuario, @idPermiso, 1, GETUTCDATE(), NULL
FROM Lefarma.config.usuario_detalle ud
INNER JOIN app.Usuarios u ON u.IdUsuario = ud.id_usuario
WHERE ud.id_empresa = @idEmpresaGrupoLefarma
  AND NOT EXISTS (
      SELECT 1
      FROM app.UsuariosPermisos up
      WHERE up.IdUsuario = ud.id_usuario
        AND up.IdPermiso = @idPermiso
  );

COMMIT TRANSACTION;

DECLARE @n INT = (SELECT COUNT(*) FROM @asignados);
PRINT CONCAT('Permisos de cambio de empresa asignados: ', @n);

/* Auditoria: a quien se le dio el permiso en esta corrida */
SELECT u.IdUsuario, u.SamAccountName, u.NombreCompleto, u.EsActivo,
       e.nombre AS empresa, up.FechaAsignacion
FROM @asignados a
JOIN app.Usuarios u ON u.IdUsuario = a.IdUsuario
JOIN Lefarma.config.usuario_detalle ud ON ud.id_usuario = a.IdUsuario
JOIN Lefarma.catalogos.empresas e ON e.id_empresa = ud.id_empresa
JOIN app.UsuariosPermisos up ON up.IdUsuario = a.IdUsuario AND up.IdPermiso = @idPermiso
ORDER BY u.EsActivo DESC, u.SamAccountName;

/* Verificacion: usuarios de Grupo Lefarma sin el permiso (debe dar 0) */
SELECT COUNT(*) AS usuarios_sin_permiso
FROM Lefarma.config.usuario_detalle ud
WHERE ud.id_empresa = @idEmpresaGrupoLefarma
  AND NOT EXISTS (
      SELECT 1
      FROM app.UsuariosPermisos up
      WHERE up.IdUsuario = ud.id_usuario
        AND up.IdPermiso = @idPermiso
        AND up.EsConcedido = 1
        AND (up.FechaExpiracion IS NULL OR up.FechaExpiracion > GETUTCDATE())
  )
  AND NOT EXISTS (
      SELECT 1
      FROM app.UsuariosRoles ur
      INNER JOIN app.Roles r ON r.IdRol = ur.IdRol AND r.EsActivo = 1
      INNER JOIN app.RolesPermisos rp ON rp.IdRol = r.IdRol
      WHERE ur.IdUsuario = ud.id_usuario
        AND rp.IdPermiso = @idPermiso
        AND (ur.FechaExpiracion IS NULL OR ur.FechaExpiracion > GETUTCDATE())
  );
