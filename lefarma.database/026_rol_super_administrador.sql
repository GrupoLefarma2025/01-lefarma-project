-- =============================================================================
-- LEFARMA - ROL SUPER ADMINISTRADOR (BYPASS TOTAL)
-- =============================================================================
-- Fecha: 2026-07-27
-- Descripcion: Crea el rol SuperAdministrador (acceso total a todas las apps
--              consolidadas) y lo asigna a los usuarios 6 y 21.
-- Orden de ejecucion: Ejecutar DESPUES de 025_*.sql
-- Idempotente: seguro reejecutar; usa IF NOT EXISTS en cada paso.
-- =============================================================================

USE AsokamDev;
GO

PRINT '';
PRINT '============================================================';
PRINT '026 - ROL SUPER ADMINISTRADOR (BYPASS TOTAL)';
PRINT '============================================================';
PRINT '';
GO

-- -----------------------------------------------------------------------------
-- app.Roles: insertar rol SuperAdministrador
-- -----------------------------------------------------------------------------
PRINT 'Insertando app.Roles SuperAdministrador...';

IF NOT EXISTS (SELECT * FROM app.Roles WHERE NombreRol = 'SuperAdministrador')
    INSERT INTO app.Roles (NombreRol, Descripcion, EsActivo, EsSistema, FechaCreacion)
    VALUES (
        'SuperAdministrador',
        'Acceso total a todas las aplicaciones consolidadas (bypass de permisos)',
        1,
        1,
        GETUTCDATE());
GO

PRINT 'app.Roles: rol SuperAdministrador asegurado';
GO

-- -----------------------------------------------------------------------------
-- app.UsuariosRoles: asignar SuperAdministrador por SamAccountName ('6' y '21')
-- -----------------------------------------------------------------------------
-- Los usuarios se identifican por SamAccountName (no IdUsuario) para evitar
-- confusiones: el SamAccountName es estable, el IdUsuario puede cambiar entre
-- entornos (dev/prod).
PRINT 'Asignando SuperAdministrador a SamAccountName 6 y 21...';

INSERT INTO app.UsuariosRoles (IdUsuario, IdRol, FechaAsignacion)
SELECT u.IdUsuario, r.IdRol, GETUTCDATE()
FROM app.Usuarios u
CROSS JOIN app.Roles r
WHERE r.NombreRol = 'SuperAdministrador'
  AND u.SamAccountName IN ('6', '21')
  AND u.EsActivo = 1
  AND NOT EXISTS (
      SELECT 1 FROM app.UsuariosRoles ur
      WHERE ur.IdUsuario = u.IdUsuario AND ur.IdRol = r.IdRol
  );
GO

PRINT 'app.UsuariosRoles: asignaciones para SamAccountName 6 y 21 aseguradas';
GO

-- -----------------------------------------------------------------------------
-- app.RolesPermisos: asignar TODOS los permisos actuales al SuperAdministrador
-- -----------------------------------------------------------------------------
-- El SuperAdministrador es un rol normal: tiene acceso total porque tiene
-- asignados todos los permisos. No hay bypass especial ni columnas extras.
-- Cuando agregues un permiso nuevo a app.Permisos, corre este bloque otra
-- vez (o un trigger SQL) para que el SuperAdmin lo herede.
PRINT 'Asignando TODOS los permisos actuales a SuperAdministrador...';

INSERT INTO app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
FROM app.Roles r
CROSS JOIN app.Permisos p
WHERE r.NombreRol = 'SuperAdministrador'
  AND p.EsActivo = 1
  AND NOT EXISTS (
      SELECT 1 FROM app.RolesPermisos rp
      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso
  );
GO

PRINT 'app.RolesPermisos: SuperAdministrador con todos los permisos activos';
GO

-- =============================================================================
-- RESUMEN
-- =============================================================================
PRINT '';
PRINT '================================================================';
PRINT '026 - COMPLETADO';
PRINT '================================================================';
PRINT '';
PRINT 'IMPORTANTE:';
PRINT '  - El backend consulta permisos en BD con cache de 1 minuto.';
PRINT '    Los cambios (rol, asignacion de permisos) se reflejan en el';
PRINT '    siguiente request dentro de esa ventana. No requiere restart';
PRINT '    del backend ni relogin del usuario.';
PRINT '  - Cuando agregues un permiso NUEVO a app.Permisos, corre el bloque';
PRINT '    "Asignar TODOS los permisos" otra vez para que el SuperAdmin lo';
PRINT '    herede (o crea un trigger SQL que lo haga automatico).';
PRINT '================================================================';
GO
