/* ============================================================
   0001 — Permisos de alcance de visibilidad de órdenes de compra
   BD destino: Asokam

   CONTEXTO
   --------
   ADR 00001 (lefarma.docs/ordenes-compra/decisiones/00001_alcance-visibilidad-ordenes-compra.md).
   La bandeja «Órdenes pendientes para autorización» solo tenía el permiso
   binario orden_compra.puede_ver_todas_las_ordenes. Este script agrega las
   dos capacidades de alcance parcial:

     - orden_compra.puede_ver_por_empresa -> órdenes de las empresas
       asignadas al usuario en Lefarma.config.usuario_alcance_empresa.
     - orden_compra.puede_ver_por_flujo   -> todas las órdenes de los
       workflows de ORDEN_COMPRA donde el usuario participa.

   El permiso por sí solo no asigna empresas ni concede acceso: sin filas
   activas en config.usuario_alcance_empresa el alcance por empresa no
   amplía nada (fail-closed). La asignación de personas se hace al final,
   de forma explícita.

   Es idempotente: re-ejecutar no duplica filas.

   ROLLBACK
   --------
   DELETE FROM app.RolesPermisos
   WHERE IdPermiso IN (SELECT IdPermiso FROM app.Permisos
                       WHERE CodigoPermiso IN ('orden_compra.puede_ver_por_empresa',
                                               'orden_compra.puede_ver_por_flujo'));

   DELETE FROM app.UsuariosPermisos
   WHERE IdPermiso IN (SELECT IdPermiso FROM app.Permisos
                       WHERE CodigoPermiso IN ('orden_compra.puede_ver_por_empresa',
                                               'orden_compra.puede_ver_por_flujo'));

   DELETE FROM app.Permisos
   WHERE CodigoPermiso IN ('orden_compra.puede_ver_por_empresa',
                           'orden_compra.puede_ver_por_flujo');
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ------------------------------------------------------------
   1) Catálogo de permisos
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM app.Permisos WHERE CodigoPermiso = N'orden_compra.puede_ver_por_empresa')
BEGIN
    INSERT INTO app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
    VALUES (N'orden_compra.puede_ver_por_empresa',
            N'Ver órdenes de compra por empresa',
            N'Permite ver todas las órdenes de compra de las empresas asignadas al usuario en config.usuario_alcance_empresa.',
            N'Órdenes de compra', N'orden_compra', N'ver_por_empresa');
END

IF NOT EXISTS (SELECT 1 FROM app.Permisos WHERE CodigoPermiso = N'orden_compra.puede_ver_por_flujo')
BEGIN
    INSERT INTO app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
    VALUES (N'orden_compra.puede_ver_por_flujo',
            N'Ver órdenes de compra por flujo',
            N'Permite ver todas las órdenes de compra de los workflows de ORDEN_COMPRA en los que el usuario participa o está mapeado.',
            N'Órdenes de compra', N'orden_compra', N'ver_por_flujo');
END

/* ------------------------------------------------------------
   2) Verificación
   ------------------------------------------------------------ */
SELECT p.IdPermiso, p.CodigoPermiso, p.NombrePermiso, p.EsActivo
FROM app.Permisos p
WHERE p.CodigoPermiso IN (N'orden_compra.puede_ver_por_empresa',
                          N'orden_compra.puede_ver_por_flujo')
ORDER BY p.CodigoPermiso;

/* ------------------------------------------------------------
   3) Asignación (NO se ejecuta automáticamente)
   ------------------------------------------------------------
   Asignar el permiso a la persona que lo necesite. Ejemplos:

   -- Victor Manuel Gonzalez Betanzos (1a130) — alcance por flujo
   INSERT INTO app.UsuariosPermisos (IdUsuario, IdPermiso, EsConcedido, FechaAsignacion, FechaExpiracion)
   SELECT u.IdUsuario, p.IdPermiso, 1, GETUTCDATE(), NULL
   FROM app.Usuarios u
   CROSS JOIN app.Permisos p
   WHERE u.SamAccountName = N'1a130'
     AND p.CodigoPermiso = N'orden_compra.puede_ver_por_flujo'
     AND NOT EXISTS (SELECT 1 FROM app.UsuariosPermisos up
                     WHERE up.IdUsuario = u.IdUsuario AND up.IdPermiso = p.IdPermiso);

   -- Emmanuel Lopez Perez (1a42) — alcance por flujo
   INSERT INTO app.UsuariosPermisos (IdUsuario, IdPermiso, EsConcedido, FechaAsignacion, FechaExpiracion)
   SELECT u.IdUsuario, p.IdPermiso, 1, GETUTCDATE(), NULL
   FROM app.Usuarios u
   CROSS JOIN app.Permisos p
   WHERE u.SamAccountName = N'1a42'
     AND p.CodigoPermiso = N'orden_compra.puede_ver_por_flujo'
     AND NOT EXISTS (SELECT 1 FROM app.UsuariosPermisos up
                     WHERE up.IdUsuario = u.IdUsuario AND up.IdPermiso = p.IdPermiso);

   Para el alcance por empresa, además del permiso hay que asignar las
   empresas visibles en Lefarma (script 0002).
   ------------------------------------------------------------ */
