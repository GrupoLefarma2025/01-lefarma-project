/* ============================================================
   058 — Alta de áreas ANALISTA DE ADMINISTRACION DE PERSONAL y
         GERENTE DE RECURSOS HUMANOS para Artricenter
   BD destino: Lefarma

   CONTEXTO
   --------
   Requerimiento 2026-11-12: Artricenter (id_empresa 1) y Reumedika
   (id_empresa 15) son la misma entidad —Reumedika es el nombre oficial
   en nómina, RFC y legal; Artricenter es el nombre comercial—, pero en
   el catálogo son dos registros distintos y CxP filtra las áreas por
   id_empresa. Los scripts 056 (Asokam) y 057 (Reumedika) ya dieron de
   alta estos dos puestos; este los replica para Artricenter.

   ALCANCE
   -------
   - Dos filas en catalogos.areas, empresa Artricenter (id_empresa 1).
   - Claves siguientes disponibles: AREA-0226 y AREA-0227.
   - descripcion = RECURSOS HUMANOS (departamento del puesto).
   - Idempotente: no inserta si el nombre ya existe para la empresa ni si
     la clave ya está tomada.

   ROLLBACK
   --------
   DELETE FROM catalogos.areas
   WHERE id_empresa = 1
     AND nombre IN ('ANALISTA DE ADMINISTRACION DE PERSONAL',
                    'GERENTE DE RECURSOS HUMANOS')
     AND clave IN ('AREA-0226', 'AREA-0227');
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

INSERT INTO catalogos.areas
    (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
     clave, id_supervisor_responsable, numero_empleados, activo, fecha_creacion, fecha_modificacion)
SELECT 1,
       'ANALISTA DE ADMINISTRACION DE PERSONAL',
       'ANALISTA DE ADMINISTRACION DE PERSONAL',
       'RECURSOS HUMANOS',
       'RECURSOS HUMANOS',
       'AREA-0226',
       NULL,
       0,
       1,
       GETDATE(),
       GETDATE()
WHERE NOT EXISTS (
        SELECT 1 FROM catalogos.areas
        WHERE id_empresa = 1 AND nombre = 'ANALISTA DE ADMINISTRACION DE PERSONAL'
      )
  AND NOT EXISTS (
        SELECT 1 FROM catalogos.areas WHERE clave = 'AREA-0226'
      );

INSERT INTO catalogos.areas
    (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
     clave, id_supervisor_responsable, numero_empleados, activo, fecha_creacion, fecha_modificacion)
SELECT 1,
       'GERENTE DE RECURSOS HUMANOS',
       'GERENTE DE RECURSOS HUMANOS',
       'RECURSOS HUMANOS',
       'RECURSOS HUMANOS',
       'AREA-0227',
       NULL,
       0,
       1,
       GETDATE(),
       GETDATE()
WHERE NOT EXISTS (
        SELECT 1 FROM catalogos.areas
        WHERE id_empresa = 1 AND nombre = 'GERENTE DE RECURSOS HUMANOS'
      )
  AND NOT EXISTS (
        SELECT 1 FROM catalogos.areas WHERE clave = 'AREA-0227'
      );

COMMIT TRANSACTION;

SELECT id_area, id_empresa, nombre, clave, descripcion, activo
FROM catalogos.areas
WHERE id_empresa = 1
  AND nombre IN ('ANALISTA DE ADMINISTRACION DE PERSONAL', 'GERENTE DE RECURSOS HUMANOS')
ORDER BY nombre;
