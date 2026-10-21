-- =============================================================================
-- 0032 — Reparar la matriz rol↔permiso de Educación Médica (Asokam)
--
-- QUÉ HACE (cross-DB, idempotente por celda, transacción única)
--   1) educacion_medica.talleres.puede_ver            → + CEM
--      (hoy CEM no puede abrir la Matriz ni resolver solicitudes de cambio).
--   2) Celdas de 0021 no aplicadas en la BD (codepage):
--        rutas.puede_ver        → GV, GG, CA, DC, CEM, AEM
--        rutas.puede_gestionar  → CEM, AEM, GV
--        rutas.puede_autorizar  → GV, CA, DC
--        configuracion.puede_gestionar → GV, GG, AEM, CEM, CA
--        aprobaciones.puede_ver_todos  → GV, GG, CA, DC
--        selecciones.puede_ver  → CEM, CA, DC
--        selecciones.puede_gestionar → CEM
--        hospitales.puede_ver   → CEM
--   3) Exclusivos del CEM de 0029 (bloque comentado en ese script):
--        rutas.puede_ajustar, talleres.puede_ajustar,
--        talleres.puede_capturar_asistida, talleres.puede_capturar_extraordinarios
--   4) Re-grant del rol SuperAdministrador (patrón legacy/026).
--
-- NO CREA PERMISOS: los 29 códigos del módulo ya existen en Asokam.app.Permisos.
-- Este script solo completa celdas de Asokam.app.RolesPermisos.
--
-- POR QUÉ
--   Los seeds 0017/0021/0029 se ejecutaron con codepage equivocado y las
--   concesiones por nombre de rol no se aplicaron (0 filas en silencio). Además,
--   CEM nunca tuvo `talleres.puede_ver` en ningún seed. El dashboard de
--   Educación Médica (ADR-00012) depende de esta matriz.
--
-- QUÉ HABILITA
--   - CEM: Matriz de talleres, solicitudes de cambio, rutas/configuración y
--     ajustes/extraordinarios.
--   - GV/CA/DC: rutas, configuración y bandeja "todos".
--   - El dashboard muestra T1–T6 según corresponda (ADR-00012).
--
-- CÓMO USAR
--   1) Revisar y aprobar (este script NO se aplica solo).
--   2) Ejecutar en LefarmaDev2 y en Lefarma/prod.
--   3) Re-ejecutar también 0017/0021/0029 con UTF-8 como camino canónico.
--
-- IDEMPOTENTE: re-ejecutable; cada INSERT valida que la celda no exista.
--
-- NOTA DE EJECUCIÓN (obligatoria): ejecutar como UTF-8
--   sqlcmd: `-f 65001` · DBeaver: conexión/archivo UTF-8.
--   Los nombres de rol con acentos ('Coordinador de Educación Médica') no
--   coinciden con otro codepage y los INSERT aplican 0 filas.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1. CEM: talleres.puede_ver (nuevo; no estaba en ningún seed)
    -- =========================================================================
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r
    CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.talleres.puede_ver'
      AND r.NombreRol = N'Coordinador de Educación Médica'
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);
    PRINT 'CEM: talleres.puede_ver asegurado.';

    -- =========================================================================
    -- 2. Celdas de 0021 (guards de rutas, configuración, bandeja y refuerzos)
    -- =========================================================================
    -- rutas.puede_ver → GV, GG, CA, DC, CEM, AEM
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.rutas.puede_ver'
      AND r.NombreRol IN (N'Gerente de Ventas', N'Gerente General', N'Coordinador Administrativo',
                          N'Director Corporativo', N'Coordinador de Educación Médica',
                          N'Auxiliar Administrativo Educación Médica')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- rutas.puede_gestionar → CEM, AEM, GV
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.rutas.puede_gestionar'
      AND r.NombreRol IN (N'Coordinador de Educación Médica',
                          N'Auxiliar Administrativo Educación Médica',
                          N'Gerente de Ventas')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- rutas.puede_autorizar → GV, CA, DC
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.rutas.puede_autorizar'
      AND r.NombreRol IN (N'Gerente de Ventas', N'Coordinador Administrativo',
                          N'Director Corporativo')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- configuracion.puede_gestionar → GV, GG, AEM, CEM, CA
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.configuracion.puede_gestionar'
      AND r.NombreRol IN (N'Gerente de Ventas', N'Gerente General',
                          N'Auxiliar Administrativo Educación Médica',
                          N'Coordinador de Educación Médica',
                          N'Coordinador Administrativo')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- aprobaciones.puede_ver_todos → GV, GG, CA, DC
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.aprobaciones.puede_ver_todos'
      AND r.NombreRol IN (N'Gerente de Ventas', N'Gerente General',
                          N'Coordinador Administrativo', N'Director Corporativo')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- selecciones.puede_ver += CEM, CA, DC
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.selecciones.puede_ver'
      AND r.NombreRol IN (N'Coordinador de Educación Médica',
                          N'Coordinador Administrativo', N'Director Corporativo')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- selecciones.puede_gestionar += CEM
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.selecciones.puede_gestionar'
      AND r.NombreRol = N'Coordinador de Educación Médica'
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- hospitales.puede_ver += CEM
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.hospitales.puede_ver'
      AND r.NombreRol = N'Coordinador de Educación Médica'
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);
    PRINT 'Celdas de 0021 aseguradas (rutas, configuración, bandeja, CEM/CA/DC).';

    -- =========================================================================
    -- 3. Exclusivos del CEM de 0029 (bloque comentado en ese script)
    -- =========================================================================
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso IN (
          N'educacion_medica.rutas.puede_ajustar',
          N'educacion_medica.talleres.puede_ajustar',
          N'educacion_medica.talleres.puede_capturar_asistida',
          N'educacion_medica.talleres.puede_capturar_extraordinarios')
      AND r.NombreRol = N'Coordinador de Educación Médica'
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);
    PRINT 'Exclusivos del CEM asegurados (ajustes y captura asistida/extraordinaria).';

    -- =========================================================================
    -- 4. SuperAdministrador: heredar todos los permisos activos (patrón 026)
    -- =========================================================================
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE r.NombreRol = N'SuperAdministrador'
      AND p.EsActivo = 1
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                      WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);
    PRINT 'SuperAdministrador con todos los permisos activos.';

    COMMIT TRANSACTION;
    PRINT '0032 completado: matriz de permisos de Educación Médica reparada.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0032: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO

-- =============================================================================
-- Verificación posterior (solo lectura): permisos EM por rol
-- Esperado: EV 10, EP 8, GV 15, AEM 12, CEM 14, CA 15, GG 15, DC 7, SuperAdmin 29
-- =============================================================================
SELECT r.NombreRol, COUNT(*) AS PermisosEM
FROM Asokam.app.RolesPermisos rp
JOIN Asokam.app.Roles r ON r.IdRol = rp.IdRol
JOIN Asokam.app.Permisos p ON p.IdPermiso = rp.IdPermiso
WHERE (p.CodigoPermiso LIKE N'educacion_medica.%'
       OR p.CodigoPermiso = N'baseapp.hub.puede_ver_educacion_medica')
  AND r.NombreRol IN (
        N'Ejecutivo de Ventas', N'Especialista de Producto', N'Gerente de Ventas',
        N'Auxiliar Administrativo Educación Médica', N'Coordinador de Educación Médica',
        N'Director Corporativo', N'Gerente General', N'Coordinador Administrativo',
        N'SuperAdministrador')
GROUP BY r.NombreRol
ORDER BY r.NombreRol;
