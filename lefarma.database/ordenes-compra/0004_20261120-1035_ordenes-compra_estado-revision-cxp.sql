/* ============================================================
   0004 — Estado propio para «Validación Cuentas por Pagar»
   BD destino: Lefarma (config + operaciones)

   CONTEXTO
   --------
   Petición del usuario (2026-11-20): en Cuentas por Pagar (CxP) casi
   todas las órdenes de compra pasan por el usuario Marco Polo Narváez
   (IdUsuario 73), responsable de «Validación Cuentas por Pagar». Hoy ese
   paso comparte el estado REVISION («En Revisión») con «Aprobación
   Gerente General», así que en la bandeja ambos momentos se ven igual.
   Se quiere que, cuando la orden está en el paso de CxP, el estado diga
   «En Revisión Gerencia General».

   QUÉ HACE
   --------
   1. Alta idempotente del estado REVISION_CXP con nombre
      «En Revisión Gerencia General» y color ámbar (mismo tono que
      En Revisión).
   2. Reapunta a ese estado los pasos «Validación Cuentas por Pagar» de
      los workflows de ORDEN_COMPRA (activos e inactivos), solo si hoy
      usan REVISION. Los pasos «Aprobación Gerente General» conservan
      «En Revisión».
   3. Reapunta las órdenes que hoy están detenidas en esos pasos y en
      estado REVISION (10 en producción al 2026-11-20: 1 en el paso 3
      del workflow 1 y 9 en el paso 16 del workflow 2).

   RESULTADO ESPERADO (producción al 2026-11-20)
   ---------------------------------------------
   - 1 fila nueva en config.workflow_estados (REVISION_CXP).
   - 13 pasos reapuntados (12 workflows activos + el 18 inactivo).
   - 10 órdenes reapuntadas (las que están con CxP en este momento).
   - La orden que está en «Aprobación Gerente General» sigue en
     «En Revisión».

   NOTA: basta con ejecutar este script para que la bandeja de CxP
   muestre el nombre nuevo, porque la UI resuelve el estado desde
   config.workflow_estados. El contador «En Firma» del dashboard incluye
   el estado nuevo a partir de la próxima publicación del backend
   (constante WorkflowEstadoCodigo.REVISION_CXP).

   ROLLBACK
   --------
   Al final del script, en el bloque comentado «ROLLBACK». Restaura las
   órdenes y los pasos a REVISION y elimina la fila REVISION_CXP.
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

/* ------------------------------------------------------------
   1) Estado nuevo
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM config.workflow_estados WHERE codigo = N'REVISION_CXP')
BEGIN
    INSERT INTO config.workflow_estados (id_estado, codigo, nombre, color_hex, activo)
    SELECT ISNULL(MAX(id_estado), 0) + 1,
           N'REVISION_CXP',
           N'En Revisión Gerencia General',
           N'#F59E0B',
           1
    FROM config.workflow_estados;
END;

DECLARE @idRevision     int = (SELECT id_estado FROM config.workflow_estados WHERE codigo = N'REVISION');
DECLARE @idRevisionCxp  int = (SELECT id_estado FROM config.workflow_estados WHERE codigo = N'REVISION_CXP');

/* ------------------------------------------------------------
   2) Pasos de CxP de los workflows de compras
   ------------------------------------------------------------ */
UPDATE p
SET p.id_estado = @idRevisionCxp
FROM config.workflow_pasos p
INNER JOIN config.workflows w ON w.id_workflow = p.id_workflow
WHERE w.codigo_proceso = N'ORDEN_COMPRA'
  AND p.nombre_paso LIKE N'%Cuentas por Pagar%'
  AND p.id_estado = @idRevision;

/* ------------------------------------------------------------
   3) Órdenes detenidas hoy en esos pasos
   ------------------------------------------------------------ */
UPDATE o
SET o.id_estado = @idRevisionCxp
FROM operaciones.ordenes_compra o
INNER JOIN config.workflow_pasos p ON p.id_paso = o.id_paso_actual
INNER JOIN config.workflows w ON w.id_workflow = p.id_workflow
WHERE w.codigo_proceso = N'ORDEN_COMPRA'
  AND p.nombre_paso LIKE N'%Cuentas por Pagar%'
  AND o.id_estado = @idRevision;

COMMIT TRANSACTION;

/* ------------------------------------------------------------
   Verificación (devuelve el resultado de la ejecución)
   ------------------------------------------------------------ */
SELECT e.codigo,
       e.nombre,
       (SELECT COUNT(*) FROM config.workflow_pasos p
        INNER JOIN config.workflows w ON w.id_workflow = p.id_workflow
        WHERE w.codigo_proceso = N'ORDEN_COMPRA' AND p.id_estado = e.id_estado) AS pasos_orden_compra,
       (SELECT COUNT(*) FROM operaciones.ordenes_compra o WHERE o.id_estado = e.id_estado) AS ordenes
FROM config.workflow_estados e
WHERE e.codigo IN (N'REVISION', N'REVISION_CXP');

/* ============================================================
   ROLLBACK (ejecutar solo si hay que revertir)
   ============================================================
BEGIN TRANSACTION;

-- Se usan variables propias para que este bloque funcione también si se
-- copia solo (las @idRevision/@idRevisionCxp ya están declaradas arriba).
DECLARE @rbRevision    int = (SELECT id_estado FROM config.workflow_estados WHERE codigo = N'REVISION');
DECLARE @rbRevisionCxp int = (SELECT id_estado FROM config.workflow_estados WHERE codigo = N'REVISION_CXP');

UPDATE o
SET o.id_estado = @rbRevision
FROM operaciones.ordenes_compra o
INNER JOIN config.workflow_pasos p ON p.id_paso = o.id_paso_actual
INNER JOIN config.workflows w ON w.id_workflow = p.id_workflow
WHERE w.codigo_proceso = N'ORDEN_COMPRA'
  AND p.nombre_paso LIKE N'%Cuentas por Pagar%'
  AND o.id_estado = @rbRevisionCxp;

UPDATE p
SET p.id_estado = @rbRevision
FROM config.workflow_pasos p
INNER JOIN config.workflows w ON w.id_workflow = p.id_workflow
WHERE w.codigo_proceso = N'ORDEN_COMPRA'
  AND p.nombre_paso LIKE N'%Cuentas por Pagar%'
  AND p.id_estado = @idRevisionCxp;

DELETE FROM config.workflow_estados WHERE codigo = N'REVISION_CXP';

COMMIT TRANSACTION;
   ============================================================ */
