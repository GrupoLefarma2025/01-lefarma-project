-- =============================================================================
-- 0043 — Hospitales: verificación y listas de revisión (solo lectura)
--
-- QUÉ HACE
--   - Ejecuta conteos y listas para validar la depuración de hospital_extension.
--   - No modifica datos.
--
-- EJECUCIÓN
--   - Requiere 0041 y 0042 aplicados.
--   - Ejecutar en LefarmaDev2.
--   - Revisar especialmente:
--       * Hospitales IMSS Bienestar de CDMX sin región (mapeo manual).
--       * Duplicados dudosos y registros con requiere_revision = 1.
--       * Registros visibles que aún parezcan no hospitalarios.
-- =============================================================================

SET NOCOUNT ON;

-- -----------------------------------------------------------------------------
-- 1. Resumen general
-- -----------------------------------------------------------------------------
SELECT
    'Resumen general' AS bloque,
    COUNT(*) AS total_extensiones,
    SUM(CASE WHEN mostrar_educacion_medica = 1 THEN 1 ELSE 0 END) AS visibles_edm,
    SUM(CASE WHEN mostrar_educacion_medica = 0 THEN 1 ELSE 0 END) AS ocultos_edm,
    SUM(CASE WHEN es_sede_taller = 1 THEN 1 ELSE 0 END) AS sedes_taller,
    SUM(CASE WHEN es_sede_taller = 0 THEN 1 ELSE 0 END) AS no_sedes,
    SUM(CASE WHEN requiere_revision = 1 THEN 1 ELSE 0 END) AS requieren_revision,
    SUM(CASE WHEN clasificacion_manual = 1 THEN 1 ELSE 0 END) AS clasificacion_manual
FROM educacion_medica.hospital_extension;

-- -----------------------------------------------------------------------------
-- 2. Distribución por gerencia
-- -----------------------------------------------------------------------------
SELECT
    tg.id_tipo_gerencia,
    tg.descripcion AS gerencia,
    COUNT(he.id_hospital_extension) AS total,
    SUM(CASE WHEN he.mostrar_educacion_medica = 1 THEN 1 ELSE 0 END) AS visibles,
    SUM(CASE WHEN he.es_sede_taller = 1 THEN 1 ELSE 0 END) AS sedes
FROM educacion_medica.tipo_gerencia tg
LEFT JOIN educacion_medica.hospital_extension he
    ON he.id_tipo_gerencia = tg.id_tipo_gerencia
GROUP BY tg.id_tipo_gerencia, tg.descripcion
ORDER BY tg.id_tipo_gerencia;

-- -----------------------------------------------------------------------------
-- 3. IMSS Bienestar: hijos de 385
-- -----------------------------------------------------------------------------
SELECT
    'IMSS Bienestar - hijos de 385' AS bloque,
    he.id_tipo_gerencia,
    COUNT(*) AS total,
    SUM(CASE WHEN he.id_region IS NULL THEN 1 ELSE 0 END) AS sin_region,
    SUM(CASE WHEN he.mostrar_educacion_medica = 1 THEN 1 ELSE 0 END) AS visibles
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE g.codigoContactoPrincipal = 385
GROUP BY he.id_tipo_gerencia;

-- Debe dar 0 filas con gerencia distinta de 4.
SELECT
    he.id_hospital,
    g.nombreContacto,
    he.id_tipo_gerencia,
    he.id_region
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE g.codigoContactoPrincipal = 385
  AND he.id_tipo_gerencia <> 4;

-- -----------------------------------------------------------------------------
-- 4. CDMX IMSS Bienestar sin región (para mapeo manual del usuario)
--    Se listan solo unidades visibles, no logísticas.
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    g.nombreCorto,
    g.ciudad,
    g.codigoEstado,
    g.calle,
    g.cp,
    he.es_sede_taller,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE he.id_tipo_gerencia = 4
  AND he.id_region IS NULL
  AND he.mostrar_educacion_medica = 1
ORDER BY g.nombreContacto;

-- -----------------------------------------------------------------------------
-- 4B. Todas las unidades visibles sin región (para mapeo manual)
-- -----------------------------------------------------------------------------
SELECT
    tg.descripcion AS gerencia,
    he.id_hospital,
    g.nombreContacto,
    g.ciudad,
    g.codigoEstado,
    he.es_sede_taller,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
LEFT JOIN educacion_medica.tipo_gerencia tg
    ON tg.id_tipo_gerencia = he.id_tipo_gerencia
WHERE he.mostrar_educacion_medica = 1
  AND he.id_region IS NULL
ORDER BY tg.descripcion, g.nombreContacto;

-- -----------------------------------------------------------------------------
-- 5. Duplicados exactos de nombre entre registros visibles
-- -----------------------------------------------------------------------------
WITH visibles AS (
    SELECT
        he.id_hospital,
        he.mostrar_educacion_medica,
        he.es_sede_taller,
        he.motivo_clasificacion,
        g.nombreContacto,
        g.codigoContactoPrincipal,
        g.clues,
        g.ciudad,
        g.codigoEstado,
        UPPER(LTRIM(RTRIM(g.nombreContacto))) COLLATE Latin1_General_CI_AI AS nombre_norm
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g
        ON g.codigoContacto = he.id_hospital
    WHERE he.mostrar_educacion_medica = 1
),
dup AS (
    SELECT nombre_norm
    FROM visibles
    GROUP BY nombre_norm
    HAVING COUNT(*) > 1
)
SELECT
    v.*
FROM visibles v
JOIN dup d
    ON d.nombre_norm = v.nombre_norm
ORDER BY v.nombre_norm, v.id_hospital;

-- -----------------------------------------------------------------------------
-- 6. Registros visibles que aún parecen logísticos/no hospitalarios
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    g.codigoContactoPrincipal,
    p.nombreContacto AS padre,
    p.tipo AS padre_tipo,
    he.es_sede_taller,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
LEFT JOIN Asokam.dbo.genContactosCat p
    ON p.codigoContacto = g.codigoContactoPrincipal
WHERE he.mostrar_educacion_medica = 1
  AND (
      (UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ALMAC%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ALMAC%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%CEDIS%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%BIRMEX%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%DISTRIBUIDORA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%COMERCIALIZADORA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%INSUMOS%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%PHARMA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%TRANSPORT%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%TRASPORT%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ENTREGA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE 'ASOKAM%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%OFICINA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ADMINISTRATIV%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%PRUEBA%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%FALSE%'
       OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%COPIA%'
       OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%CORPORATIVO%'
       OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%COMERLAT%')
      AND UPPER(ISNULL(g.nombreContacto, '')) NOT LIKE '%ENTREGA%'
      AND UPPER(ISNULL(g.nombreContacto, '')) NOT LIKE '%SUB-ALMAC%'
      AND UPPER(ISNULL(g.nombreContacto, '')) NOT LIKE '%SUB ALMAC%'
      AND UPPER(ISNULL(g.nombreContacto, '')) NOT LIKE '%SUBDELEGACIONAL%'
      AND UPPER(ISNULL(g.nombreContacto, '')) NOT LIKE '%FARMACIA%'
  )
ORDER BY g.nombreContacto;

-- -----------------------------------------------------------------------------
-- 7. Registros con requiere_revision = 1
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    g.codigoContactoPrincipal,
    he.id_tipo_gerencia,
    he.id_region,
    he.mostrar_educacion_medica,
    he.es_sede_taller,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE he.requiere_revision = 1
ORDER BY he.id_tipo_gerencia, g.nombreContacto;

-- -----------------------------------------------------------------------------
-- 8. Visibles que no son sede (sub-almacenes/farmacias conservados)
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    he.id_region,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE he.mostrar_educacion_medica = 1
  AND he.es_sede_taller = 0
ORDER BY g.nombreContacto;

-- -----------------------------------------------------------------------------
-- 9. Ocultos que siguen como sede (debe devolver 0 filas)
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    he.motivo_clasificacion
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
WHERE he.mostrar_educacion_medica = 0
  AND he.es_sede_taller = 1;

-- -----------------------------------------------------------------------------
-- 10. Región de otra gerencia (debe devolver 0 filas)
-- -----------------------------------------------------------------------------
SELECT
    he.id_hospital,
    g.nombreContacto,
    he.id_tipo_gerencia,
    he.id_region,
    r.id_tipo_gerencia AS region_gerencia
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
JOIN educacion_medica.regiones_cat r
    ON r.id_region = he.id_region
WHERE he.id_tipo_gerencia <> r.id_tipo_gerencia;

-- -----------------------------------------------------------------------------
-- 11. Completitud operativa
-- -----------------------------------------------------------------------------
SELECT
    'Quirófanos/SIA/fecha' AS bloque,
    SUM(CASE WHEN numero_quirofanos IS NULL THEN 1 ELSE 0 END) AS quirofanos_null,
    SUM(CASE WHEN con_sia IS NULL THEN 1 ELSE 0 END) AS con_sia_null,
    SUM(CASE WHEN fecha IS NULL THEN 1 ELSE 0 END) AS fecha_null,
    COUNT(*) AS total
FROM educacion_medica.hospital_extension;

-- -----------------------------------------------------------------------------
-- 12. Sedes por gerencia y región
-- -----------------------------------------------------------------------------
SELECT
    tg.descripcion AS gerencia,
    ISNULL(rc.nombre, '(sin región)') AS region,
    COUNT(*) AS sedes
FROM educacion_medica.hospital_extension he
LEFT JOIN educacion_medica.tipo_gerencia tg
    ON tg.id_tipo_gerencia = he.id_tipo_gerencia
LEFT JOIN educacion_medica.regiones_cat rc
    ON rc.id_region = he.id_region
WHERE he.mostrar_educacion_medica = 1
  AND he.es_sede_taller = 1
GROUP BY tg.descripcion, rc.nombre
ORDER BY tg.descripcion, rc.nombre;

-- -----------------------------------------------------------------------------
-- 13. Contactos activos incluibles que siguen sin extensión
-- -----------------------------------------------------------------------------
SELECT
    g.codigoContacto,
    g.nombreContacto,
    g.tipo,
    g.clues,
    g.codigoContactoPrincipal
FROM Asokam.dbo.genContactosCat g
LEFT JOIN educacion_medica.hospital_extension he
    ON he.id_hospital = g.codigoContacto
WHERE g.activo = 1
  AND (g.tipo IS NULL OR g.tipo NOT IN ('Privado', 'Distribuidor'))
  AND he.id_hospital IS NULL
ORDER BY g.nombreContacto;

