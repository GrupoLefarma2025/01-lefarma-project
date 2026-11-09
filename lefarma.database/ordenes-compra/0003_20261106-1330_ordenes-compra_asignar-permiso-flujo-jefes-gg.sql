/* ============================================================
   0003 — Permiso de ver por flujo para los jefes (Gerente General)
   BD destino: Lefarma (con referencias cruzadas a Asokam)

   CONTEXTO
   --------
   ADR 00001 (lefarma.docs/ordenes-compra/decisiones/00001_alcance-visibilidad-ordenes-compra.md).
   Regla de negocio indicada por el usuario (2026-11-06): en los workflows
   de ORDEN_COMPRA, los pasos llamados «Aprobación Gerente General»
   identifican a los jefes de cada flujo; esas personas deben poder ver
   TODAS las órdenes de los flujos en los que participan, no solo las
   detenidas en su paso.

   QUÉ HACE
   --------
   1. Asegura el permiso orden_compra.puede_ver_por_flujo en Asokam
      (idempotente; mismo alta que el script 0001).
   2. Asigna el permiso, de forma directa en Asokam.app.UsuariosPermisos,
      a los usuarios activos que sean participantes activos de un paso
      activo cuyo nombre contenga «Gerente General», dentro de un workflow
      activo de ORDEN_COMPRA.
   3. No revoca permisos existentes. Es idempotente y re-ejecutable:
      volver a correrlo sincroniza jefes nuevos sin duplicar filas.

   RESULTADO ESPERADO (producción al 2026-11-06)
   ---------------------------------------------
   Usuarios activos: 74 (Victor), 21 (Carlos Guzmán), 34 (Daniel Gasca),
   46 (Juan Alejandro) y 23 (1a1, que ya tiene el permiso de ver todas).
   El usuario 39 (Adán) está configurado en un paso GG pero su cuenta está
   INACTIVA, por lo que se excluye; si se reactiva, re-ejecutar este script.

   NOTA: el permiso solo surte efecto cuando el backend con el servicio de
   visibilidad (ADR 00001) esté publicado. El usuario debe re-loguearse o
   esperar el SSE de permisos; el backend cachea permisos 5 minutos.

   ROLLBACK
   --------
   DELETE up
   FROM Asokam.app.UsuariosPermisos up
   INNER JOIN Asokam.app.Permisos p ON p.IdPermiso = up.IdPermiso
   WHERE p.CodigoPermiso = N'orden_compra.puede_ver_por_flujo'
     AND up.IdUsuario IN (21, 23, 34, 46, 74);

   -- 23 (1a1) conserva el permiso de ver todas; el de flujo es redundante.
   -- Revisar antes si alguna de esas filas se asignó por otra vía.
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

/* ------------------------------------------------------------
   1) Permiso en el catálogo de Asokam
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM Asokam.app.Permisos WHERE CodigoPermiso = N'orden_compra.puede_ver_por_flujo')
BEGIN
    INSERT INTO Asokam.app.Permisos (CodigoPermiso, NombrePermiso, Descripcion, Categoria, Recurso, Accion)
    VALUES (N'orden_compra.puede_ver_por_flujo',
            N'Ver órdenes de compra por flujo',
            N'Permite ver todas las órdenes de compra de los workflows de ORDEN_COMPRA en los que el usuario participa o está mapeado.',
            N'Órdenes de compra', N'orden_compra', N'ver_por_flujo');
END

/* ------------------------------------------------------------
   2) Asignación directa a los jefes de los pasos «Gerente General»
   ------------------------------------------------------------ */
INSERT INTO Asokam.app.UsuariosPermisos (IdUsuario, IdPermiso, EsConcedido, FechaAsignacion, FechaExpiracion)
SELECT DISTINCT pt.id_usuario, p.IdPermiso, 1, GETUTCDATE(), NULL
FROM config.workflow_participantes pt
INNER JOIN config.workflow_pasos wfpaso ON wfpaso.id_paso = pt.id_paso
INNER JOIN config.workflows wf ON wf.id_workflow = wfpaso.id_workflow
INNER JOIN Asokam.app.Usuarios u ON u.IdUsuario = pt.id_usuario AND u.EsActivo = 1
CROSS JOIN Asokam.app.Permisos p
WHERE pt.activo = 1
  AND wfpaso.activo = 1
  AND wf.activo = 1
  AND wf.codigo_proceso = N'ORDEN_COMPRA'
  AND wfpaso.nombre_paso LIKE N'%Gerente General%'
  AND p.CodigoPermiso = N'orden_compra.puede_ver_por_flujo'
  AND NOT EXISTS (
      SELECT 1
      FROM Asokam.app.UsuariosPermisos up
      WHERE up.IdUsuario = pt.id_usuario
        AND up.IdPermiso = p.IdPermiso
  );

COMMIT TRANSACTION;

/* ------------------------------------------------------------
   Verificación
   ------------------------------------------------------------ */
SELECT u.IdUsuario, u.SamAccountName, u.NombreCompleto,
       p.CodigoPermiso, up.EsConcedido, up.FechaAsignacion
FROM Asokam.app.UsuariosPermisos up
INNER JOIN Asokam.app.Usuarios u ON u.IdUsuario = up.IdUsuario
INNER JOIN Asokam.app.Permisos p ON p.IdPermiso = up.IdPermiso
WHERE p.CodigoPermiso = N'orden_compra.puede_ver_por_flujo'
ORDER BY u.NombreCompleto;
