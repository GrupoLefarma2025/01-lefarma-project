/* ============================================================
   0005 — Renombrar «En Revisión Gerencia General» a «En Revisión Finanzas»
   BD destino: Lefarma (producción) y LefarmaDev (pruebas)

   CONTEXTO
   --------
   Petición del usuario (2026-11-20): el estado creado en el script 0004
   para el paso «Validación Cuentas por Pagar» se llama hoy
   «En Revisión Gerencia General». Se quiere que se lea
   «En Revisión Finanzas».

   QUÉ HACE
   --------
   Cambia SOLO el nombre visible del estado con código REVISION_CXP.
   No toca el código (la constante WorkflowEstadoCodigo.REVISION_CXP del
   backend depende de él), ni el color, ni los pasos, ni las órdenes.
   Las órdenes que ya están en ese estado conservan su id_estado y pasan
   a mostrar el nombre nuevo automáticamente, porque la UI resuelve el
   nombre desde config.workflow_estados.

   RESULTADO ESPERADO
   ------------------
   - 1 fila actualizada en config.workflow_estados (REVISION_CXP).
   - Los 13 pasos de compras y las órdenes detenidas en CxP no cambian
     de estado; solo cambia la etiqueta que se muestra.

   ROLLBACK
   --------
   Al final del script, en el bloque comentado «ROLLBACK»: devuelve el
   nombre a «En Revisión Gerencia General».
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

UPDATE config.workflow_estados
SET nombre = N'En Revisión Finanzas'
WHERE codigo = N'REVISION_CXP'
  AND nombre = N'En Revisión Gerencia General';

COMMIT TRANSACTION;

/* Verificación */
SELECT e.codigo,
       e.nombre,
       e.color_hex,
       (SELECT COUNT(*) FROM config.workflow_pasos p
        INNER JOIN config.workflows w ON w.id_workflow = p.id_workflow
        WHERE w.codigo_proceso = N'ORDEN_COMPRA' AND p.id_estado = e.id_estado) AS pasos_orden_compra,
       (SELECT COUNT(*) FROM operaciones.ordenes_compra o WHERE o.id_estado = e.id_estado) AS ordenes
FROM config.workflow_estados e
WHERE e.codigo = N'REVISION_CXP';

/* ============================================================
   ROLLBACK (ejecutar solo si hay que revertir)
   ============================================================
BEGIN TRANSACTION;

UPDATE config.workflow_estados
SET nombre = N'En Revisión Gerencia General'
WHERE codigo = N'REVISION_CXP'
  AND nombre = N'En Revisión Finanzas';

COMMIT TRANSACTION;
   ============================================================ */
