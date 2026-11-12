/* ============================================================
   057 — Alta de áreas ANALISTA DE ADMINISTRACION DE PERSONAL y
         GERENTE DE RECURSOS HUMANOS para Reumedika
   BD destino: Lefarma

   CONTEXTO
   --------
   Requerimiento 2026-11-12: en CxP, con Empresa = Reumedika, el selector
   de Área no ofrece estos dos puestos (Reumedika solo tenía el área
   interna CxP, id_area 248). Es el mismo alta que el script 056 hizo para
   Asokam (id_empresa 7, áreas 253 y 254). Ya existen en el catálogo para
   Grupo Lefarma (id_area 107, clave AREA-0082 y id_area 120, clave
   AREA-0095) y en Asistencias.dbo.vwEmpleados aparecen como puestos del
   departamento RECURSOS HUMANOS.

   ALCANCE
   -------
   - Dos filas en catalogos.areas, empresa Reumedika (id_empresa 15).
   - Claves siguientes disponibles: AREA-0224 y AREA-0225.
   - descripcion = RECURSOS HUMANOS (departamento del puesto).
   - Idempotente: no inserta si el nombre ya existe para la empresa ni si
     la clave ya está tomada.

   ROLLBACK
   --------
   DELETE FROM catalogos.areas
   WHERE id_empresa = 15
     AND nombre IN ('ANALISTA DE ADMINISTRACION DE PERSONAL',
                    'GERENTE DE RECURSOS HUMANOS')
     AND clave IN ('AREA-0224', 'AREA-0225');
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

INSERT INTO catalogos.areas
    (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
     clave, id_supervisor_responsable, numero_empleados, activo, fecha_creacion, fecha_modificacion)
SELECT 15,
       'ANALISTA DE ADMINISTRACION DE PERSONAL',
       'ANALISTA DE ADMINISTRACION DE PERSONAL',
       'RECURSOS HUMANOS',
       'RECURSOS HUMANOS',
       'AREA-0224',
       NULL,
       0,
       1,
       GETDATE(),
       GETDATE()
WHERE NOT EXISTS (
        SELECT 1 FROM catalogos.areas
        WHERE id_empresa = 15 AND nombre = 'ANALISTA DE ADMINISTRACION DE PERSONAL'
      )
  AND NOT EXISTS (
        SELECT 1 FROM catalogos.areas WHERE clave = 'AREA-0224'
      );

INSERT INTO catalogos.areas
    (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
     clave, id_supervisor_responsable, numero_empleados, activo, fecha_creacion, fecha_modificacion)
SELECT 15,
       'GERENTE DE RECURSOS HUMANOS',
       'GERENTE DE RECURSOS HUMANOS',
       'RECURSOS HUMANOS',
       'RECURSOS HUMANOS',
       'AREA-0225',
       NULL,
       0,
       1,
       GETDATE(),
       GETDATE()
WHERE NOT EXISTS (
        SELECT 1 FROM catalogos.areas
        WHERE id_empresa = 15 AND nombre = 'GERENTE DE RECURSOS HUMANOS'
      )
  AND NOT EXISTS (
        SELECT 1 FROM catalogos.areas WHERE clave = 'AREA-0225'
      );

COMMIT TRANSACTION;

SELECT id_area, id_empresa, nombre, clave, descripcion, activo
FROM catalogos.areas
WHERE id_empresa = 15
  AND nombre IN ('ANALISTA DE ADMINISTRACION DE PERSONAL', 'GERENTE DE RECURSOS HUMANOS')
ORDER BY nombre;
