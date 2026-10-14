-- =============================================================================
-- 0029 — Permisos de ajustes post-cierre y extraordinarios (seed, compartido)
-- ADRs: lefarma.docs/educacion-medica/decisiones/00010_ajustes-post-cierre.md
--       lefarma.docs/educacion-medica/decisiones/00011_hospitales-extraordinarios.md.
--
-- QUÉ HACE (Asokam cross-DB, idempotente por código y por celda)
--   1) app.Permisos: 4 códigos nuevos del módulo:
--        - educacion_medica.rutas.puede_ajustar                    (ADR-00010)
--        - educacion_medica.talleres.puede_ajustar                 (ADR-00010)
--        - educacion_medica.talleres.puede_capturar_asistida       (ADR-00011)
--        - educacion_medica.talleres.puede_capturar_extraordinarios (ADR-00011)
--   2) app.RolesPermisos: los 4 permisos EXCLUSIVOS del rol
--      Coordinador de Educación Médica (CEM). Los permisos normales
--      (gestionar/capturar) NO habilitan ajustes ni captura asistida.
--   3) Re-grant del rol SuperAdministrador (patrón legacy/026) para que
--      herede los permisos nuevos.
--
-- REQUISITOS
--   - 0017/0021 aplicados (roles y permisos base del módulo).
--   - CROSS-DB: WRITE sobre Asokam.app (auth compartido).
--   - Los [HasPermission] del backend vienen en el código (Fase 2 de los ADRs);
--     este script solo siembra datos.
--
-- EFECTO EN RUNTIME
--   El backend cachea permisos ~5 minutos; los cambios se reflejan solos.
--   El frontend refresca /profile cada 5 minutos (o al recargar).
--
-- NOTA DE EJECUCIÓN (2026-10-10): ejecutar como UTF-8 (sqlcmd: `-f 65001`; DBeaver:
--   conexión/archivo UTF-8). La matriz rol↔permiso compara nombres de rol con
--   acentos ('Coordinador de Educación Médica'); con otro codepage los INSERT no
--   aplican (0 filas) en silencio. Verificar tras aplicar:
--   SELECT COUNT(*) FROM Asokam.app.RolesPermisos rp JOIN Asokam.app.Permisos p
--   ON p.IdPermiso = rp.IdPermiso WHERE p.CodigoPermiso LIKE 'educacion_medica.%puede_ajustar%';
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1. Permisos nuevos (guarda idempotente por código)
    -- =========================================================================
    IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'educacion_medica.rutas.puede_ajustar')
    BEGIN
        INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
        VALUES (N'educacion_medica.rutas.puede_ajustar', N'Ajustar rutas cerradas', N'Aplicar cambios de fecha/hora/orden y alta/baja de visitas en una version de rutas Cerrada, con motivo y auditoria (ADR-00010)', N'Educación Médica', N'rutas', N'puede_ajustar');
        PRINT 'Permiso educacion_medica.rutas.puede_ajustar insertado.';
    END
    ELSE
        PRINT 'Permiso educacion_medica.rutas.puede_ajustar ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'educacion_medica.talleres.puede_ajustar')
    BEGIN
        INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
        VALUES (N'educacion_medica.talleres.puede_ajustar', N'Ajustar talleres cerrados', N'Editar fecha, hora, lugar y participantes de talleres Autorizado/Programado y resolver solicitudes de cambio del equipo, con motivo y auditoria (ADR-00010)', N'Educación Médica', N'talleres', N'puede_ajustar');
        PRINT 'Permiso educacion_medica.talleres.puede_ajustar insertado.';
    END
    ELSE
        PRINT 'Permiso educacion_medica.talleres.puede_ajustar ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'educacion_medica.talleres.puede_capturar_asistida')
    BEGIN
        INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
        VALUES (N'educacion_medica.talleres.puede_capturar_asistida', N'Captura asistida de talleres', N'Crear talleres a nombre de otro equipo usando hospitales de la seleccion de ese equipo, para cuando el EV/EP no puede acceder (ADR-00011)', N'Educación Médica', N'talleres', N'puede_capturar_asistida');
        PRINT 'Permiso educacion_medica.talleres.puede_capturar_asistida insertado.';
    END
    ELSE
        PRINT 'Permiso educacion_medica.talleres.puede_capturar_asistida ya existe. Skip.';

    IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'educacion_medica.talleres.puede_capturar_extraordinarios')
    BEGIN
        INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
        VALUES (N'educacion_medica.talleres.puede_capturar_extraordinarios', N'Capturar talleres extraordinarios', N'Crear talleres con hospitales del catalogo (FOR-002) fuera de la seleccion autorizada, con motivo obligatorio (ADR-00011)', N'Educación Médica', N'talleres', N'puede_capturar_extraordinarios');
        PRINT 'Permiso educacion_medica.talleres.puede_capturar_extraordinarios insertado.';
    END
    ELSE
        PRINT 'Permiso educacion_medica.talleres.puede_capturar_extraordinarios ya existe. Skip.';

    -- =========================================================================
    -- 2. Matriz rol↔permiso: los 4 al rol Coordinador de Educación Médica (CEM)
    -- =========================================================================
    /*INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
    WHERE p.CodigoPermiso IN (
          N'educacion_medica.rutas.puede_ajustar',
          N'educacion_medica.talleres.puede_ajustar',
          N'educacion_medica.talleres.puede_capturar_asistida',
          N'educacion_medica.talleres.puede_capturar_extraordinarios')
      AND r.NombreRol = N'Coordinador de Educación Médica'
      AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);
    PRINT 'Matriz rol↔permiso: 4 permisos asignados al Coordinador de Educación Médica.';*/

    -- =========================================================================
    -- 3. SuperAdministrador: heredar todos los permisos activos (patrón 026)
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
    PRINT '0029 completado: permisos de ajustes post-cierre y extraordinarios (CEM + re-grant SuperAdmin).';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0029: ' + ERROR_MESSAGE();
    THROW;
END CATCH
