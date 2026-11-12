/* ============================================================
   059 — Sucursales y áreas de Artricenter para Reumedika y baja de
         Artricenter del catálogo de empresas
   BD destino: Lefarma

   CONTEXTO
   --------
   Requerimiento 2026-11-12: Reumedika (id_empresa 15) es el nombre
   oficial en nómina, RFC y legal de Artricenter (id_empresa 1), que es
   el nombre comercial. En el catálogo son dos empresas distintas y CxP
   filtra sucursales y áreas por id_empresa, así que Reumedika solo veía
   la sucursal "Unica" y su área interna. Se pide que Reumedika tenga las
   mismas sucursales y áreas que Artricenter y que Artricenter deje de
   ofrecerse en el selector de empresa.

   ALCANCE
   -------
   1. Copia las 4 sucursales de Artricenter a Reumedika con claves
      REU-002..REU-005 (clave y clave_contable son únicas a nivel global,
      por eso no se reutilizan ZRG/LRZ/VDT/ATZ ni 1001-1004). Se copian
      dirección, CP, ciudad, estado, teléfono, coordenadas, número de
      empleados y el estado activo (Atizapán está dada de baja y así se
      queda). La descripción cambia "Artricenter" por "Reumedika".
   2. Copia a Reumedika todas las áreas de Artricenter que aún no existan
      por nombre, con claves AREA-#### tomadas desde la última usada
      (hoy AREA-0227). Las dos áreas de RRHH ya existen en Reumedika
      (AREA-0224 y AREA-0225), así que se omiten por nombre. La
      descripción se copia tal cual: varios nombres de departamento
      incluyen "ARTRICENTER" y ese es su nombre real.
   3. Da de baja Artricenter en catalogos.empresas (activo = 0). No borra
      nada: sus áreas, sucursales y los 114 usuarios con id_empresa = 1
      siguen intactos. Ocultarlo del desplegable requiere además el
      cambio de frontend que filtra empresas inactivas en los selectores
      de contexto.
   Idempotente: se puede ejecutar dos veces sin duplicar sucursales ni
   áreas, y la baja solo afecta si Artricenter seguía activa.

   ROLLBACK
   --------
   BEGIN TRANSACTION;
   DELETE FROM catalogos.areas
    WHERE id_empresa = 15
      AND clave LIKE 'AREA-[0-9][0-9][0-9][0-9]'
      AND CAST(SUBSTRING(clave, 6, 4) AS INT) >= 228;
   DELETE FROM catalogos.sucursales
    WHERE id_empresa = 15
      AND clave IN ('REU-002', 'REU-003', 'REU-004', 'REU-005');
   UPDATE catalogos.empresas
      SET activo = 1, fecha_modificacion = GETDATE()
    WHERE id_empresa = 1;
   COMMIT TRANSACTION;
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

-- 1) Sucursales de Artricenter → Reumedika (REU-002 en adelante)
DECLARE @baseSucursal INT = (
    SELECT ISNULL(MAX(CAST(SUBSTRING(clave, 5, 3) AS INT)), 1)
    FROM catalogos.sucursales
    WHERE id_empresa = 15
      AND clave LIKE 'REU-[0-9][0-9][0-9]'
);

INSERT INTO catalogos.sucursales
    (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
     clave, clave_contable, direccion, codigo_postal, ciudad, estado, telefono,
     latitud, longitud, numero_empleados, activo, fecha_creacion, fecha_modificacion)
SELECT 15,
       s.nombre,
       s.nombre_normalizado,
       REPLACE(s.descripcion, 'Artricenter', 'Reumedika'),
       REPLACE(s.descripcion_normalizada, 'Artricenter', 'Reumedika'),
       'REU-' + RIGHT('000' + CAST(@baseSucursal + ROW_NUMBER() OVER (ORDER BY s.id_sucursal) AS VARCHAR(3)), 3),
       'REU-' + RIGHT('000' + CAST(@baseSucursal + ROW_NUMBER() OVER (ORDER BY s.id_sucursal) AS VARCHAR(3)), 3),
       s.direccion,
       s.codigo_postal,
       s.ciudad,
       s.estado,
       s.telefono,
       s.latitud,
       s.longitud,
       s.numero_empleados,
       s.activo,
       GETDATE(),
       GETDATE()
FROM catalogos.sucursales s
WHERE s.id_empresa = 1
  AND NOT EXISTS (
        SELECT 1 FROM catalogos.sucursales d
        WHERE d.id_empresa = 15 AND d.nombre = s.nombre
      );

-- 2) Áreas de Artricenter → Reumedika (solo las que falten por nombre)
DECLARE @baseArea INT = (
    SELECT ISNULL(MAX(CAST(SUBSTRING(clave, 6, 4) AS INT)), 0)
    FROM catalogos.areas
    WHERE clave LIKE 'AREA-[0-9][0-9][0-9][0-9]'
);

INSERT INTO catalogos.areas
    (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
     clave, id_supervisor_responsable, numero_empleados, activo, fecha_creacion, fecha_modificacion)
SELECT 15,
       a.nombre,
       a.nombre_normalizado,
       a.descripcion,
       a.descripcion_normalizada,
       'AREA-' + RIGHT('0000' + CAST(@baseArea + ROW_NUMBER() OVER (ORDER BY a.id_area) AS VARCHAR(4)), 4),
       NULL,
       a.numero_empleados,
       a.activo,
       GETDATE(),
       GETDATE()
FROM catalogos.areas a
WHERE a.id_empresa = 1
  AND NOT EXISTS (
        SELECT 1 FROM catalogos.areas d
        WHERE d.id_empresa = 15 AND d.nombre = a.nombre
      );

-- 3) Baja de Artricenter (no se borra nada)
UPDATE catalogos.empresas
   SET activo = 0,
       fecha_modificacion = GETDATE()
 WHERE id_empresa = 1
   AND activo = 1;

COMMIT TRANSACTION;

-- Verificación
SELECT 'Sucursales Reumedika' AS bloque, id_sucursal, nombre, clave, clave_contable, activo
FROM catalogos.sucursales
WHERE id_empresa = 15
ORDER BY id_sucursal;

SELECT 'Áreas Reumedika' AS bloque, COUNT(*) AS total
FROM catalogos.areas
WHERE id_empresa = 15;

SELECT 'Empresa Artricenter' AS bloque, id_empresa, nombre, activo
FROM catalogos.empresas
WHERE id_empresa = 1;
