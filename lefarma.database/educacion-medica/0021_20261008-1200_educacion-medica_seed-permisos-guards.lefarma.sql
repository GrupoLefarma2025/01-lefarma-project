-- =============================================================================
-- 0021 — Permisos y guards de Educación Médica (rutas, configuración, bandeja)
-- ADR: lefarma.docs/educacion-medica/decisiones/00009_permisos-y-guards-educacion-medica.md.
--
-- QUÉ HACE (Asokam cross-DB, idempotente por celda)
--   1) app.Permisos: 5 códigos nuevos del módulo:
--        - educacion_medica.rutas.puede_ver / puede_gestionar / puede_autorizar
--        - educacion_medica.configuracion.puede_gestionar
--        - educacion_medica.aprobaciones.puede_ver_todos  (se usa en el código
--          desde ADR-00006/00007 pero NUNCA se sembró; la bandeja "todos" daba 403)
--   2) Ajustes a la matriz de 0017 para que los guards del backend no rompan
--      flujos reales:
--        - selecciones.puede_ver    += CEM, CA, DC
--          (CEM crea la selección; CA/DC abren rutas/documentos desde la Bandeja)
--        - selecciones.puede_gestionar += CEM (crea y envía la selección, ADR-00006 §Fase 4)
--        - hospitales.puede_ver     += CEM (página Selección usa el catálogo)
--   3) app.RolesPermisos: matriz rol↔permiso de los códigos nuevos.
--   4) Re-grant del rol SuperAdministrador (patrón de legacy/026) para que
--      herede los permisos nuevos.
--
-- REQUISITOS
--   - 0017 aplicado (roles y 20 permisos base del módulo).
--   - CROSS-DB: WRITE sobre Asokam.app (auth compartido).
--   - Los `[HasPermission]` del backend y los PermissionGuard del frontend ya
--     vienen en el código (ADR-00009); este script solo siembra datos.
--
-- EFECTO EN RUNTIME
--   El backend cachea permisos 5 minutos; los cambios se reflejan solos.
--   El frontend refresca /profile cada 5 minutos (o al recargar).
--
-- NOTA DE EJECUCIÓN (2026-10-10): ejecutar como UTF-8 (sqlcmd: `-f 65001`; DBeaver:
--   conexión/archivo UTF-8). La matriz rol↔permiso compara nombres de rol con
--   acentos; con otro codepage los INSERT no aplican (0 filas) en silencio.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1. Permisos nuevos del módulo
    -- =========================================================================
    IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'educacion_medica.rutas.puede_ver')
    BEGIN
        INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
        VALUES
          (N'educacion_medica.rutas.puede_ver',               N'Ver Rutas',                           N'Consultar la planificación de rutas de visitas',                              N'Educación Médica', N'rutas',          N'puede_ver'),
          (N'educacion_medica.rutas.puede_gestionar',         N'Gestionar Rutas',                     N'Generar el draft, mover/agregar/quitar visitas y cancelar versiones',         N'Educación Médica', N'rutas',          N'puede_gestionar'),
          (N'educacion_medica.rutas.puede_autorizar',         N'Autorizar Rutas',                     N'Firmar la cadena de autorización de rutas (GV/CA/DC)',                        N'Educación Médica', N'rutas',          N'puede_autorizar'),
          (N'educacion_medica.configuracion.puede_gestionar', N'Gestionar configuración del módulo',  N'Administrar tipo de gerencia, regiones, equipos, parámetros y ranking',       N'Educación Médica', N'configuracion',  N'puede_gestionar'),
          (N'educacion_medica.aprobaciones.puede_ver_todos',  N'Ver todos en la Bandeja',             N'Ver documentos de la bandeja sin filtro de participante',                     N'Educación Médica', N'aprobaciones',   N'puede_ver_todos');
        PRINT 'Permisos nuevos del módulo insertados (5).';
    END
    ELSE
        PRINT 'Permisos nuevos del módulo ya existen. Skip.';

    -- =========================================================================
    -- 2. Matriz rol↔permiso de los códigos nuevos (idempotente por celda)
    -- =========================================================================
    -- rutas.puede_ver → GV, GG, CA, DC, CEM, AEM
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.rutas.puede_ver'
      AND r.NombreRol IN (N'Gerente de Ventas', N'Gerente General', N'Coordinador Administrativo', N'Director Corporativo', N'Coordinador de Educación Médica', N'Auxiliar Administrativo Educación Médica')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- rutas.puede_gestionar → CEM, AEM, GV
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.rutas.puede_gestionar'
      AND r.NombreRol IN (N'Coordinador de Educación Médica', N'Auxiliar Administrativo Educación Médica', N'Gerente de Ventas')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- rutas.puede_autorizar → GV, CA, DC
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.rutas.puede_autorizar'
      AND r.NombreRol IN (N'Gerente de Ventas', N'Coordinador Administrativo', N'Director Corporativo')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- configuracion.puede_gestionar → GV, GG, AEM, CEM, CA
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.configuracion.puede_gestionar'
      AND r.NombreRol IN (N'Gerente de Ventas', N'Gerente General', N'Auxiliar Administrativo Educación Médica', N'Coordinador de Educación Médica', N'Coordinador Administrativo')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- aprobaciones.puede_ver_todos → GV, GG, CA, DC
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.aprobaciones.puede_ver_todos'
      AND r.NombreRol IN (N'Gerente de Ventas', N'Gerente General', N'Coordinador Administrativo', N'Director Corporativo')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    PRINT 'Matriz rol↔permiso de los permisos nuevos insertada.';

    -- =========================================================================
    -- 3. Ajustes a la matriz de 0017 (compatibilidad con los guards del código)
    -- =========================================================================
    -- selecciones.puede_ver += CEM, CA, DC (crea la selección / la firman o la consultan desde la Bandeja y Rutas)
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.selecciones.puede_ver'
      AND r.NombreRol IN (N'Coordinador de Educación Médica', N'Coordinador Administrativo', N'Director Corporativo')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- selecciones.puede_gestionar += CEM (crea y envía la selección, ADR-00006 §Fase 4)
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.selecciones.puede_gestionar'
      AND r.NombreRol IN (N'Coordinador de Educación Médica')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    -- hospitales.puede_ver += CEM (la página Selección consulta el catálogo de hospitales)
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso = N'educacion_medica.hospitales.puede_ver'
      AND r.NombreRol IN (N'Coordinador de Educación Médica')
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

    PRINT 'Ajustes a la matriz de 0017 aplicados (CEM/CA/DC).';

    -- =========================================================================
    -- 4. SuperAdministrador: heredar todos los permisos activos (patrón 026)
    -- =========================================================================
    INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso, FechaAsignacion)
    SELECT r.IdRol, p.IdPermiso, GETUTCDATE()
    FROM Asokam.app.Roles r
    CROSS JOIN Asokam.app.Permisos p
    WHERE r.NombreRol = N'SuperAdministrador'
      AND p.EsActivo = 1
      AND NOT EXISTS (
          SELECT 1 FROM Asokam.app.RolesPermisos rp
          WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso
      );
    PRINT 'SuperAdministrador con todos los permisos activos.';

    COMMIT TRANSACTION;
    PRINT '0021 completado: permisos y guards de Educación Médica.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0021: ' + ERROR_MESSAGE();
    THROW;
END CATCH
