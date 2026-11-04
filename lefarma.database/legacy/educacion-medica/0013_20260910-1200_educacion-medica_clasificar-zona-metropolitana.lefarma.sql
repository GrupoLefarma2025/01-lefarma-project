-- ============================================================
-- 0013_20260910-1200_educacion-medica_clasificar-zona-metropolitana.lefarma.sql
-- Descripcion: Clasifica en bloque hospital_extension.es_zona_metropolitana
--   (1 = local CDMX / zona metropolitana; 0 = foraneo; NULL = sin clasificar).
--   Regla: es local todo hospital de la Ciudad de México (estado 493) y de
--   los municipios conurbados del Estado de México a la Zona Metropolitana
--   del Valle de México; el resto se marca foraneo.
--   - Los CDMX/conurbados se FUERZAN a 1 (es hecho geografico).
--   - Lo demas solo se toca si sigue NULL (respeta reclasificaciones
--     manuales hechas desde la pantalla Hospitales).
--   Alimenta la regla de <=3 viajes foraneos/mes del ADR-00004 (decision 10:
--   sin clasificar cuenta como foraneo de forma conservadora; este script
--   elimina esos NULL masivamente).
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (toda la familia lefarma).
-- Requisitos: scripts 0003 y 0006 aplicados (hospital_extension con
--   es_zona_metropolitana). CROSS-DB: lee Asokam.dbo.genContactosCat.
-- Idempotente: puede reejecutarse sin duplicar cambios.
-- ============================================================

SET NOCOUNT ON;
GO

-- ------------------------------------------------------------
-- 0) DIAGNOSTICO (descomenta para revisar antes de aplicar):
--    como vive Asokam la ubicacion de los hospitales del EdomeX.
-- ------------------------------------------------------------
-- SELECT TRY_CAST(g.codigoEstado AS INT) AS estado, g.ciudad, COUNT(*) AS hospitales
-- FROM educacion_medica.hospital_extension he
-- JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
-- WHERE TRY_CAST(g.codigoEstado AS INT) IN (493, 501)
-- GROUP BY TRY_CAST(g.codigoEstado AS INT), g.ciudad
-- ORDER BY 1, 3 DESC;

-- ------------------------------------------------------------
-- 1) Locales: Ciudad de México (493).
-- ------------------------------------------------------------
UPDATE he
SET es_zona_metropolitana = 1,
    fecha_modificacion = SYSUTCDATETIME()
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
WHERE TRY_CAST(g.codigoEstado AS INT) = 493
  AND ISNULL(he.es_zona_metropolitana, -1) <> 1;

PRINT CONCAT('[1/3] CDMX clasificadas como locales: ', @@ROWCOUNT);
GO

-- ------------------------------------------------------------
-- 2) Locales: municipios conurbados del Estado de México a la
--    Zona Metropolitana del Valle de México (los 16 nucleos;
--    coincidencia por prefijo para sobrevivir variantes de
--    acentos/nombre en genContactosCat).
-- ------------------------------------------------------------
UPDATE he
SET es_zona_metropolitana = 1,
    fecha_modificacion = SYSUTCDATETIME()
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
WHERE TRY_CAST(g.codigoEstado AS INT) = 501
  AND ISNULL(he.es_zona_metropolitana, -1) <> 1
  AND (
       UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'ECATEPEC%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'CIUDAD ECATEPEC%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'NEZAHUALC%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'NETZAHUALC%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'NAUCALPAN%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'TLALNEPANTLA%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE '%UAUTITLAN%'      -- Cuautitlán / Cuautitlán Izcalli
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'TULTITLAN%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'COACALCO%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'NICOL%SROMERO%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'ATIZAPAN%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'MELCHOR OCAMPO%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'CHIMALHUAC%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'IXTAPALUCA%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'VALLE DE CHALCO%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'CHICOLOAPAN%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'TEPOZOTL%'
    OR UPPER(LTRIM(RTRIM(g.ciudad))) = 'LA PAZ'              -- La Paz, Edoméx (el filtro de estado ya excluye BCS)
  );

PRINT CONCAT('[2/3] Conurbados Edoméx clasificados como locales: ', @@ROWCOUNT);
GO

-- Opcional (descomenta si negocio decide que Toluca y su conurbacion
-- tambien cuentan como local — forman otra zona metropolitana):
-- UPDATE he SET es_zona_metropolitana = 1, fecha_modificacion = SYSUTCDATETIME()
-- FROM educacion_medica.hospital_extension he
-- JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
-- WHERE TRY_CAST(g.codigoEstado AS INT) = 501
--   AND ISNULL(he.es_zona_metropolitana, -1) <> 1
--   AND (UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'TOLUCA%'
--        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'ZINACANTEPEC%'
--        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'CALIMAYO%'
--        OR UPPER(LTRIM(RTRIM(g.ciudad))) LIKE 'ALMOLOYA%');

-- ------------------------------------------------------------
-- 3) Foraneos: TODO lo que sigue sin clasificar pasa a 0.
--    No sobrescribe 1 existentes (p. ej. clasificaciones
--    manuales previas).
-- ------------------------------------------------------------
UPDATE educacion_medica.hospital_extension
SET es_zona_metropolitana = 0,
    fecha_modificacion = SYSUTCDATETIME()
WHERE es_zona_metropolitana IS NULL;

PRINT CONCAT('[3/3] Resto clasificado como foraneo: ', @@ROWCOUNT);
GO

-- Resumen final
SELECT
    CASE es_zona_metropolitana WHEN 1 THEN 'Local (CDMX/ZM)' WHEN 0 THEN 'Foraneo' ELSE 'Sin clasificar' END AS clasificacion,
    COUNT(*) AS hospitales
FROM educacion_medica.hospital_extension
GROUP BY es_zona_metropolitana;
GO

ALTER TABLE config.workflow_bitacora
    ALTER COLUMN comentario NVARCHAR(MAX) NULL;


PRINT 'FIN script 0013.';
GO
