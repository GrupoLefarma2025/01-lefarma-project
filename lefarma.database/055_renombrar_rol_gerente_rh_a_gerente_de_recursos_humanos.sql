/* ============================================================
   055 — Renombrar el rol "Gerente de RH" al nombre del PUESTO
         oficial: "Gerente de Recursos Humanos"
   BD destino: Asokam (la usan producción y desarrollo)

   CONTEXTO
   --------
   El 054 creó el rol con el nombre corto "Gerente de RH". La regla
   permanente del usuario (12-oct-2026) es nombrar SIEMPRE el rol con
   el PUESTO de Asistencias.dbo.vwEmpleados, nunca con una abreviatura.
   Para esta persona el padrón dice:

     nombre    ADAN CHAVARRIA FLORES
     correo    2@grupolefarma.com.mx
     nomina    1631235
     puesto    GERENTE DE RECURSOS HUMANOS
     depto     RECURSOS HUMANOS / GRUPO LEFARMA

   Por eso el rol queda como "Gerente de Recursos Humanos".

   ALCANCE
   -------
   Solo cambia app.Roles.NombreRol. Conserva los 3 permisos del rol
   (baseapp.hub.puede_ver_cxp, ordenes.ver_listado, menu.dashboard) y
   su asignación al usuario 39 (SamAccountName '2').
   Idempotente: si ya existe el nombre nuevo, no hace nada.

   ROLLBACK
   --------
   UPDATE app.Roles
   SET NombreRol = N'Gerente de RH'
   WHERE NombreRol = N'Gerente de Recursos Humanos'
     AND NOT EXISTS (SELECT 1 FROM app.Roles WHERE NombreRol = N'Gerente de RH');
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

UPDATE r
SET NombreRol = N'Gerente de Recursos Humanos'
FROM app.Roles r
WHERE r.NombreRol = N'Gerente de RH'
  AND NOT EXISTS (
      SELECT 1
      FROM app.Roles x
      WHERE x.NombreRol = N'Gerente de Recursos Humanos'
  );

-- Verificación: rol (nombre nuevo o viejo) con sus permisos y su usuario.
SELECT r.IdRol, r.NombreRol, r.EsActivo,
       p.CodigoPermiso,
       u.IdUsuario, u.SamAccountName, u.NombreCompleto
FROM app.Roles r
LEFT JOIN app.RolesPermisos rp ON rp.IdRol = r.IdRol
LEFT JOIN app.Permisos p ON p.IdPermiso = rp.IdPermiso
LEFT JOIN app.UsuariosRoles ur ON ur.IdRol = r.IdRol
LEFT JOIN app.Usuarios u ON u.IdUsuario = ur.IdUsuario
WHERE r.NombreRol IN (N'Gerente de Recursos Humanos', N'Gerente de RH')
ORDER BY r.NombreRol, p.CodigoPermiso;
