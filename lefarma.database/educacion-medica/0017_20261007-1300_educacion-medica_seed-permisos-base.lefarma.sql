-- =============================================================================
-- 0017 — Permisos base del módulo de Educación Médica (Asokam)
--        (antes "seed de catálogos": los catálogos se movieron a 0030 el 2026-10-10)
-- ADR: lefarma.docs/educacion-medica/decisiones/00001 y 00009.
--
-- QUÉ HACE (CROSS-DB, idempotente)
--   1) Asokam.app.Roles        : crea los 5 roles del módulo que faltan
--      (EV, EP, GV, AEM, CEM; DC/GG/CA ya existen).
--   2) Asokam.app.Permisos     : 20 permisos base del módulo (+ tile del hub).
--   3) Asokam.app.RolesPermisos: matriz rol↔permiso completa (idempotente por celda).
--   Requiere WRITE sobre Asokam.app (auth compartido).
--
-- SEPARACIÓN DE RESPONSABILIDADES (2026-10-10)
--   - Catálogos y backfills (tipo_gerencia, regiones, config_ranking, etc.):
--     viven en 0030_..._instalacion-limpia-catalogos.lefarma.sql (solo Lefarma).
--   - Permisos de guards (CEM/CA/DC, bandeja "todos"): 0021.
--   - Permisos de ajustes post-cierre y extraordinarios: 0029.
--
-- CÓMO USAR (entorno NUEVO que necesite sembrar Asokam)
--   Aplicar tras 0016 (esquema) y 0030 (catálogos); antes o después de 0018.
--   En el Asokam de producción los roles/permisos del módulo ya existen:
--   NO ejecutar este script ahí (es idempotente, pero no hay nada que sembrar).
--
-- NOTA DE EJECUCIÓN (2026-10-10): ejecutar como UTF-8 (sqlcmd: `-f 65001`;
--   DBeaver: conexión/archivo UTF-8). La matriz rol↔permiso compara nombres de rol
--   con acentos; con otro codepage los INSERT no aplican (0 filas) en silencio.
--   Verificar después: SELECT COUNT(*) FROM Asokam.app.RolesPermisos rp JOIN
--   Asokam.app.Roles r ON r.IdRol = rp.IdRol WHERE r.NombreRol LIKE '%Coordinador de Educaci%'.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1. Roles (Asokam): crea los 5 del módulo que faltan
    --    DC (IdRol 8), GG (14) y CA (13) ya existen.
    -- =========================================================================
    IF NOT EXISTS (SELECT 1 FROM Asokam.app.Roles WHERE NombreRol = N'Especialista de Producto')
    BEGIN
        INSERT INTO Asokam.app.Roles (NombreRol, Descripcion)
        VALUES
          (N'Ejecutivo de Ventas',                      N'Visita hospitales, captura FOR-005, recibe materiales (EV)'),
          (N'Especialista de Producto',                 N'Imparte talleres, captura asistencia y evidencias (EP)'),
          (N'Gerente de Ventas',                        N'CRUD programas/selecciones, firma concentrado FOR-005 (GV)'),
          (N'Auxiliar Administrativo Educación Médica', N'Calendario, solicitud de materiales, captura (AEM)'),
          (N'Coordinador de Educación Médica',          N'Coordina planificación anual, presenta indicadores a GG/DC (CEM)');
        PRINT 'Roles del módulo insertados en Asokam.app.Roles (EV/EP/GV/AEM/CEM).';
    END
    ELSE
        PRINT 'Roles del módulo ya existen en Asokam.app.Roles. Skip.';

    -- =========================================================================
    -- 2. Permisos base del módulo
    -- =========================================================================
    IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'educacion_medica.talleres.puede_ver')
    BEGIN
        INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
        VALUES
          (N'baseapp.hub.puede_ver_educacion_medica',       N'Ver módulo Educación Médica (hub)', N'Muestra el tile del módulo en el hub',                 N'Educación Médica', N'baseapp.hub',  N'puede_ver_educacion_medica'),
          (N'educacion_medica.hospitales.puede_ver',         N'Ver hospitales',                    N'Consultar la base de hospitales y cálculos',          N'Educación Médica', N'hospitales',   N'puede_ver'),
          (N'educacion_medica.hospitales.puede_gestionar',   N'Gestionar hospitales',              N'Crear/editar/eliminar hospitales y su extensión',     N'Educación Médica', N'hospitales',   N'puede_gestionar'),
          (N'educacion_medica.ejecutivos.puede_ver',         N'Ver ejecutivos',                    N'Consultar catálogo de ejecutivos/especialistas',      N'Educación Médica', N'ejecutivos',   N'puede_ver'),
          (N'educacion_medica.ejecutivos.puede_gestionar',   N'Gestionar ejecutivos',              N'Editar catálogo de ejecutivos',                       N'Educación Médica', N'ejecutivos',   N'puede_gestionar'),
          (N'educacion_medica.productos.puede_ver',          N'Ver productos',                     N'Consultar catálogo de productos',                     N'Educación Médica', N'productos',    N'puede_ver'),
          (N'educacion_medica.productos.puede_gestionar',    N'Gestionar productos',               N'Editar catálogo de productos',                        N'Educación Médica', N'productos',    N'puede_gestionar'),
          (N'educacion_medica.programas.puede_ver',          N'Ver Programa Anual',                N'Consultar programas anuales',                         N'Educación Médica', N'programas',    N'puede_ver'),
          (N'educacion_medica.programas.puede_gestionar',    N'Gestionar Programa Anual',          N'Crear/editar programas anuales',                      N'Educación Médica', N'programas',    N'puede_gestionar'),
          (N'educacion_medica.programas.puede_autorizar',    N'Autorizar Programa Anual',          N'Firmar Autorizó del programa anual',                  N'Educación Médica', N'programas',    N'puede_autorizar'),
          (N'educacion_medica.selecciones.puede_ver',        N'Ver Selección Mensual',             N'Consultar selecciones mensuales',                     N'Educación Médica', N'selecciones',  N'puede_ver'),
          (N'educacion_medica.selecciones.puede_gestionar',  N'Gestionar Selección Mensual',       N'Elegir hospitales en la selección',                   N'Educación Médica', N'selecciones',  N'puede_gestionar'),
          (N'educacion_medica.selecciones.puede_autorizar',  N'Autorizar Selección Mensual',       N'Firmar la selección mensual',                         N'Educación Médica', N'selecciones',  N'puede_autorizar'),
          (N'educacion_medica.talleres.puede_ver',           N'Ver talleres',                      N'Consultar talleres y calendario',                     N'Educación Médica', N'talleres',     N'puede_ver'),
          (N'educacion_medica.talleres.puede_capturar',      N'Capturar taller',                   N'Crear/editar taller, recursos y asistencia',          N'Educación Médica', N'talleres',     N'puede_capturar'),
          (N'educacion_medica.talleres.puede_revisar',       N'Revisar taller',                    N'Firmar Revisó y mover estado (incluye costos CA)',    N'Educación Médica', N'talleres',     N'puede_revisar'),
          (N'educacion_medica.talleres.puede_autorizar',     N'Autorizar taller',                  N'Firmar Autorizó final del taller',                    N'Educación Médica', N'talleres',     N'puede_autorizar'),
          (N'educacion_medica.materiales.puede_gestionar',   N'Gestionar materiales',              N'CRUD de solicitud de material',                       N'Educación Médica', N'materiales',   N'puede_gestionar'),
          (N'educacion_medica.materiales.puede_confirmar',   N'Confirmar recepción de material',   N'Firma de recibido del ejecutivo',                     N'Educación Médica', N'materiales',   N'puede_confirmar'),
          (N'educacion_medica.evidencias.puede_gestionar',   N'Gestionar evidencias',              N'Subir/borrar evidencias post-taller',                 N'Educación Médica', N'evidencias',   N'puede_gestionar');
        PRINT 'Permisos del módulo insertados en Asokam.app.Permisos (20).';
    END
    ELSE
        PRINT 'Permisos del módulo ya existen en Asokam.app.Permisos. Skip.';

    -- =========================================================================
    -- 3. Matriz rol↔permiso (idempotente por celda)
    -- =========================================================================
    IF NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp
                   JOIN Asokam.app.Roles r ON r.IdRol = rp.IdRol
                   JOIN Asokam.app.Permisos p ON p.IdPermiso = rp.IdPermiso
                   WHERE r.NombreRol = N'Especialista de Producto'
                     AND p.CodigoPermiso = N'educacion_medica.talleres.puede_capturar')
    BEGIN
        -- baseapp.hub.puede_ver_educacion_medica → todos los roles del módulo
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'baseapp.hub.puede_ver_educacion_medica'
          AND r.NombreRol IN (N'Ejecutivo de Ventas', N'Especialista de Producto', N'Gerente de Ventas', N'Gerente General', N'Coordinador Administrativo', N'Auxiliar Administrativo Educación Médica', N'Coordinador de Educación Médica', N'Director Corporativo')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- hospitales.puede_ver → EV, EP, AEM, CA, GV, GG
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.hospitales.puede_ver'
          AND r.NombreRol IN (N'Ejecutivo de Ventas', N'Especialista de Producto', N'Auxiliar Administrativo Educación Médica', N'Coordinador Administrativo', N'Gerente de Ventas', N'Gerente General')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- hospitales.puede_gestionar → GV, GG, AEM, CA
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.hospitales.puede_gestionar'
          AND r.NombreRol IN (N'Gerente de Ventas', N'Gerente General', N'Auxiliar Administrativo Educación Médica', N'Coordinador Administrativo')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- ejecutivos.puede_ver → EV, EP, CA, GG
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.ejecutivos.puede_ver'
          AND r.NombreRol IN (N'Ejecutivo de Ventas', N'Especialista de Producto', N'Coordinador Administrativo', N'Gerente General')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- ejecutivos.puede_gestionar → CA, GG
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.ejecutivos.puede_gestionar'
          AND r.NombreRol IN (N'Coordinador Administrativo', N'Gerente General')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- productos.puede_ver → EV, EP, GV, CA, GG
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.productos.puede_ver'
          AND r.NombreRol IN (N'Ejecutivo de Ventas', N'Especialista de Producto', N'Gerente de Ventas', N'Coordinador Administrativo', N'Gerente General')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- productos.puede_gestionar → CA, GG
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.productos.puede_gestionar'
          AND r.NombreRol IN (N'Coordinador Administrativo', N'Gerente General')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- programas.puede_ver → EV, EP, AEM, GV, CEM, GG
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.programas.puede_ver'
          AND r.NombreRol IN (N'Ejecutivo de Ventas', N'Especialista de Producto', N'Auxiliar Administrativo Educación Médica', N'Gerente de Ventas', N'Coordinador de Educación Médica', N'Gerente General')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- programas.puede_gestionar → AEM, GV, CEM
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.programas.puede_gestionar'
          AND r.NombreRol IN (N'Auxiliar Administrativo Educación Médica', N'Gerente de Ventas', N'Coordinador de Educación Médica')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- programas.puede_autorizar → GG
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.programas.puede_autorizar'
          AND r.NombreRol IN (N'Gerente General')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- selecciones.puede_ver → EV, AEM, GV, GG
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.selecciones.puede_ver'
          AND r.NombreRol IN (N'Ejecutivo de Ventas', N'Auxiliar Administrativo Educación Médica', N'Gerente de Ventas', N'Gerente General')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- selecciones.puede_gestionar → GV
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.selecciones.puede_gestionar'
          AND r.NombreRol IN (N'Gerente de Ventas')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- selecciones.puede_autorizar → GG
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.selecciones.puede_autorizar'
          AND r.NombreRol IN (N'Gerente General')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- talleres.puede_ver → EP, EV, AEM, GV, GG, CA, DC
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.talleres.puede_ver'
          AND r.NombreRol IN (N'Especialista de Producto', N'Ejecutivo de Ventas', N'Auxiliar Administrativo Educación Médica', N'Gerente de Ventas', N'Gerente General', N'Coordinador Administrativo', N'Director Corporativo')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- talleres.puede_capturar → EP, EV, AEM
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.talleres.puede_capturar'
          AND r.NombreRol IN (N'Especialista de Producto', N'Ejecutivo de Ventas', N'Auxiliar Administrativo Educación Médica')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- talleres.puede_revisar → GV, CA
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.talleres.puede_revisar'
          AND r.NombreRol IN (N'Gerente de Ventas', N'Coordinador Administrativo')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- talleres.puede_autorizar → DC
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.talleres.puede_autorizar'
          AND r.NombreRol IN (N'Director Corporativo')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- materiales.puede_gestionar → AEM, CA
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.materiales.puede_gestionar'
          AND r.NombreRol IN (N'Auxiliar Administrativo Educación Médica', N'Coordinador Administrativo')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- materiales.puede_confirmar → EV
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.materiales.puede_confirmar'
          AND r.NombreRol IN (N'Ejecutivo de Ventas')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        -- evidencias.puede_gestionar → EP, EV
        INSERT INTO Asokam.app.RolesPermisos (IdRol, IdPermiso)
        SELECT r.IdRol, p.IdPermiso FROM Asokam.app.Roles r CROSS JOIN Asokam.app.Permisos p
        WHERE p.CodigoPermiso = N'educacion_medica.evidencias.puede_gestionar'
          AND r.NombreRol IN (N'Especialista de Producto', N'Ejecutivo de Ventas')
          AND NOT EXISTS (SELECT 1 FROM Asokam.app.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

        PRINT 'Matriz Rol↔Permiso del módulo insertada en Asokam.app.RolesPermisos.';
    END
    ELSE
        PRINT 'Matriz Rol↔Permiso del módulo ya existe. Skip.';

    COMMIT TRANSACTION;
    PRINT '0017 completado: roles, permisos base y matriz rol↔permiso (Asokam).';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0017: ' + ERROR_MESSAGE();
    THROW;
END CATCH
