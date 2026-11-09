/* ============================================================
   051 — Alta de área GERENTE DE VENTAS IMSS BIENESTAR (Asokam)
   BD destino: Lefarma

   CONTEXTO
   --------
   Requerimiento 2026-11-02: agregar al catálogo de áreas de Asokam
   el puesto "GERENTE DE VENTAS IMSS BIENESTAR", similar al área
   existente "GERENTE DE VENTAS IMSS" (id_area 161, clave AREA-0135).

   ALCANCE
   -------
   - Una sola fila en catalogos.areas, empresa Asokam (id_empresa 7).
   - Clave siguiente disponible: AREA-0221.
   - Idempotente: no inserta si el nombre o la clave ya existen.

   ROLLBACK
   --------
   DELETE FROM catalogos.areas
   WHERE id_empresa = 7
     AND nombre = 'GERENTE DE VENTAS IMSS BIENESTAR'
     AND clave = 'AREA-0221';
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

INSERT INTO catalogos.areas
    (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
     clave, id_supervisor_responsable, numero_empleados, activo, fecha_creacion, fecha_modificacion)
SELECT 7,
       'GERENTE DE VENTAS IMSS BIENESTAR',
       'GERENTE DE VENTAS IMSS BIENESTAR',
       'VENTAS IMSS',
       'VENTAS IMSS',
       'AREA-0221',
       NULL,
       0,
       1,
       GETDATE(),
       GETDATE()
WHERE NOT EXISTS (
        SELECT 1 FROM catalogos.areas
        WHERE id_empresa = 7 AND nombre = 'GERENTE DE VENTAS IMSS BIENESTAR'
      )
  AND NOT EXISTS (
        SELECT 1 FROM catalogos.areas WHERE clave = 'AREA-0221'
      );

COMMIT TRANSACTION;

SELECT id_area, id_empresa, nombre, clave, descripcion, activo
FROM catalogos.areas
WHERE id_empresa = 7
  AND nombre = 'GERENTE DE VENTAS IMSS BIENESTAR';
