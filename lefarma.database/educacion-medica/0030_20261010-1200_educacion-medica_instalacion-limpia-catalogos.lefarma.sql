-- =============================================================================
-- 0030 — Catálogos y backfills de Educación Médica (instalación limpia Lefarma)
--        NO toca Asokam (roles/permisos viven en el Asokam de producción).
--
-- QUÉ HACE (idempotente, transacción única)
--   1) tipo_gerencia            : IMSS, Descentralizado, Privado
--   2) parametros_anestesias    : factores del FOR-002 para el año en curso
--   3) regiones_cat             : las 7 regiones por gerencia (IMSS y Descentralizado)
--   4) regiones_estados         : mapeo estado -> región por gerencia (31 estados)
--   5) hospital_extension       : backfill de id_region + clasificación local/foráneo
--   6) config_ranking           : configuración "General" v2 (cobertura_taller)
--   7) hospital_extension       : clasificación de contactos logísticos
--                                 (almacén / farmacia / sede) — solo UPDATEs
--                                 (las columnas ya las crea 0016; sin ALTER TABLE)
--   8) hospital_extension       : gerencia NULL por jerarquía institucional
--
-- SEPARACIÓN DE RESPONSABILIDADES (2026-10-10)
--   Los catálogos que antes vivían en el 0017 se movieron aquí; el 0017 quedó
--   solo con los roles/permisos base de Asokam. Los incrementales de esquema
--   0022/0023/0025/0026/0027/0028 y los backfills 0019/0024 se retiraron del
--   repositorio al quedar integrados en 0016 y en este script.
--
-- CÓMO USAR (Lefarma limpio: prod o LefarmaDev2 recién reseteado)
--   1) 0016  — esquema completo (crea TODAS las tablas, columnas, índices y el
--              seed de dias_limite_cambio)
--   2) 0030  — este script (catálogos y backfills; solo Lefarma)
--   3) 0018  — workflows de selección, rutas y matriz (si el entorno no los tiene)
--
-- REQUISITOS
--   - 0016 aplicado.
--   - Lectura a Asokam.dbo.genContactosCat (mismo servidor). Este script NO
--     escribe en Asokam.
--   - Los backfills de hospital_extension (5, 7 y 8) solo aplican a extensiones
--     ya capturadas desde la app; en un entorno vacío son no-ops y se pueden
--     re-ejecutar después del primer sincronizado de hospitales.
--
-- IDEMPOTENTE: todos los bloques tienen guardas (re-ejecutable).
--
-- NOTA DE EJECUCIÓN (2026-10-10): ejecutar como UTF-8 (sqlcmd: `-f 65001`;
--   DBeaver: conexión/archivo UTF-8) por los acentos en descripciones.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;   -- requerido por índices filtrados (config_ranking)
SET ANSI_NULLS ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1. tipo_gerencia
    -- =========================================================================
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.tipo_gerencia)
    BEGIN
        INSERT INTO educacion_medica.tipo_gerencia (descripcion)
        VALUES (N'IMSS'), (N'Descentralizado'), (N'Privado');
        PRINT 'Catalogo [tipo_gerencia] sembrado: IMSS, Descentralizado, Privado.';
    END
    ELSE
        PRINT 'Catalogo [tipo_gerencia] ya tiene datos. Skip.';

    -- =========================================================================
    -- 2. parametros_anestesias (factores del FOR-002 para el año en curso)
    -- =========================================================================
    DECLARE @anio_actual INT = YEAR(GETDATE());

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.parametros_anestesias WHERE anio = @anio_actual)
    BEGIN
        INSERT INTO educacion_medica.parametros_anestesias (anio, clave, valor, descripcion, orden)
        VALUES
            (@anio_actual, 'factor_cirugias_dia',     2.5,    'Cirugias promedio por dia por quirofano', 1),
            (@anio_actual, 'dias_laborables_anio',    250.0,  'Dias laborables al ano', 2),
            (@anio_actual, 'pct_generales',           0.30,   'Porcentaje de anestesias generales sobre el total', 3),
            (@anio_actual, 'pct_regionales',          0.70,   'Porcentaje de anestesias regionales sobre el total', 4),
            (@anio_actual, 'pct_epidurales',          0.35,   'Porcentaje de epidurales sobre las regionales', 5),
            (@anio_actual, 'pct_subdurales',          0.45,   'Porcentaje de subdurales sobre las regionales', 6),
            (@anio_actual, 'pct_mixtas_obesos',       0.02,   'Porcentaje de mixtas obesos sobre las regionales', 7),
            (@anio_actual, 'pct_mixtas_no_obesos',    0.18,   'Porcentaje de mixtas no obesos sobre las regionales', 8);
        PRINT 'Parametros de anestesias sembrados para el anio ' + CAST(@anio_actual AS VARCHAR(4)) + '.';
    END
    ELSE
        PRINT 'Parametros de anestesias del anio actual ya existen. Skip.';

    -- =========================================================================
    -- 3. regiones_cat: las 7 regiones por gerencia (IMSS y Descentralizado)
    --    (estado final de 0010 + 0013: cada gerencia tiene su propio catálogo)
    -- =========================================================================
    INSERT INTO educacion_medica.regiones_cat (nombre, id_tipo_gerencia, activo, fecha_creacion, fecha_modificacion)
    SELECT v.nombre, tg.id_tipo_gerencia, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM (VALUES
        (N'CDMX NORTE'),
        (N'CDMX SUR'),
        (N'NORESTE'),
        (N'NOROESTE'),
        (N'OCCIDENTE'),
        (N'OTE - PTE'),
        (N'SURESTE')
    ) AS v(nombre)
    CROSS JOIN educacion_medica.tipo_gerencia tg
    WHERE tg.descripcion IN (N'IMSS', N'Descentralizado')
      AND NOT EXISTS (
          SELECT 1 FROM educacion_medica.regiones_cat z
          WHERE z.nombre = v.nombre AND z.id_tipo_gerencia = tg.id_tipo_gerencia);

    DECLARE @n_regiones INT = (SELECT COUNT(*) FROM educacion_medica.regiones_cat);
    PRINT CONCAT('Regiones en catalogo: ', @n_regiones);

    -- =========================================================================
    -- 4. regiones_estados: mapeo estado -> región por gerencia (31 estados)
    --    Correcciones vs Asokam (validadas con GPS el 2026-09-03):
    --      Aguascalientes -> OCCIDENTE; Chihuahua -> NOROESTE;
    --      Michoacán -> OCCIDENTE; Puebla -> OTE - PTE.
    --    Ciudad de México (493) NO se mapea (división CDMX NORTE/SUR manual).
    -- =========================================================================
    INSERT INTO educacion_medica.regiones_estados (codigo_estado, id_region, id_tipo_gerencia, fecha_creacion, fecha_modificacion)
    SELECT m.codigo_estado, z.id_region, z.id_tipo_gerencia, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM (VALUES
        (485, N'OCCIDENTE'),  -- Aguascalientes
        (486, N'NOROESTE'),   -- Baja California
        (487, N'NOROESTE'),   -- Baja California Sur
        (488, N'NOROESTE'),   -- Chihuahua
        (489, N'OCCIDENTE'),  -- Colima
        (490, N'SURESTE'),    -- Campeche
        (491, N'NORESTE'),    -- Coahuila
        (492, N'SURESTE'),    -- Chiapas
        (494, N'NORESTE'),    -- Durango
        (495, N'CDMX SUR'),   -- Guerrero
        (496, N'OCCIDENTE'),  -- Guanajuato
        (497, N'OTE - PTE'),  -- Hidalgo
        (498, N'OCCIDENTE'),  -- Jalisco
        (499, N'OCCIDENTE'),  -- Michoacán
        (500, N'CDMX SUR'),   -- Morelos
        (501, N'OTE - PTE'),  -- México
        (502, N'OCCIDENTE'),  -- Nayarit
        (503, N'NORESTE'),    -- Nuevo León
        (504, N'SURESTE'),    -- Oaxaca
        (505, N'OTE - PTE'),  -- Puebla
        (506, N'SURESTE'),    -- Quintana Roo
        (507, N'CDMX NORTE'), -- Querétaro
        (508, N'NOROESTE'),   -- Sinaloa
        (509, N'CDMX NORTE'), -- San Luis Potosí
        (510, N'NOROESTE'),   -- Sonora
        (511, N'SURESTE'),    -- Tabasco
        (512, N'OTE - PTE'),  -- Tlaxcala
        (513, N'NORESTE'),    -- Tamaulipas
        (514, N'SURESTE'),    -- Veracruz
        (515, N'SURESTE'),    -- Yucatán
        (516, N'OCCIDENTE')   -- Zacatecas
    ) AS m(codigo_estado, region)
    JOIN educacion_medica.regiones_cat z ON z.nombre = m.region
    JOIN educacion_medica.tipo_gerencia tg
        ON tg.id_tipo_gerencia = z.id_tipo_gerencia
       AND tg.descripcion IN (N'IMSS', N'Descentralizado')
    WHERE NOT EXISTS (
        SELECT 1 FROM educacion_medica.regiones_estados ze
        WHERE ze.codigo_estado = m.codigo_estado AND ze.id_tipo_gerencia = z.id_tipo_gerencia);

    DECLARE @n_mapeos INT = (SELECT COUNT(*) FROM educacion_medica.regiones_estados);
    PRINT CONCAT('Mapeos estado->region: ', @n_mapeos);

    -- =========================================================================
    -- 5. hospital_extension: backfill de id_region (por gerencia del hospital)
    --    y clasificación de zona metropolitana (local CDMX/ZM vs foráneo).
    --    Solo aplica a extensiones ya capturadas desde la app.
    -- =========================================================================

    -- 5.1 Backfill de región: la del mapeo de SU gerencia (sugerencia editable)
    UPDATE he
    SET id_region = ze.id_region,
        fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g
        ON g.codigoContacto = he.id_hospital
    JOIN educacion_medica.regiones_estados ze
        ON ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
       AND ze.id_tipo_gerencia = he.id_tipo_gerencia
    WHERE he.id_region IS NULL;

    PRINT CONCAT('Backfill de region aplicado a ', @@ROWCOUNT, ' hospital_extension.');

    -- 5.2 Zona metropolitana: CDMX (493) es local
    UPDATE he
    SET es_zona_metropolitana = 1,
        fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
    WHERE TRY_CAST(g.codigoEstado AS INT) = 493
      AND ISNULL(he.es_zona_metropolitana, -1) <> 1;

    PRINT CONCAT('[1/3] CDMX clasificadas como locales: ', @@ROWCOUNT);

    -- 5.3 Zona metropolitana: municipios conurbados del Edomex (501)
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

    PRINT CONCAT('[2/3] Conurbados Edomex clasificados como locales: ', @@ROWCOUNT);

    -- 5.4 Zona metropolitana: el resto sin clasificar pasa a foráneo (0)
    UPDATE educacion_medica.hospital_extension
    SET es_zona_metropolitana = 0,
        fecha_modificacion = SYSUTCDATETIME()
    WHERE es_zona_metropolitana IS NULL;

    PRINT CONCAT('[3/3] Resto clasificado como foraneo: ', @@ROWCOUNT);

    -- =========================================================================
    -- 6. config_ranking: configuración "General" v2 (scoring-v1.1, cobertura_taller)
    --    Nota: el histórico v1 no se siembra (su script 0009 ya no existe);
    --    la v2 queda activa y es la que usa el motor de ranking.
    -- =========================================================================
    DECLARE @id_config INT;

    IF NOT EXISTS (SELECT 1 FROM educacion_medica.config_ranking WHERE nombre = N'General' AND version = 2)
    BEGIN
        -- Solo una configuracion activa (UX_config_ranking_activa): se desactiva la anterior
        UPDATE educacion_medica.config_ranking
        SET activo = 0,
            fecha_modificacion = SYSUTCDATETIME()
        WHERE activo = 1;

        INSERT INTO educacion_medica.config_ranking (nombre, version, activo, fecha_vigencia_inicio, fecha_vigencia_fin,
            fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
        VALUES (N'General', 2, 1, NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), NULL, NULL);

        SET @id_config = SCOPE_IDENTITY();

        INSERT INTO educacion_medica.config_ranking_factores
            (id_configuracion, clave, grupo, nombre, descripcion, peso, activo, tipo_normalizacion, parametros_json)
        VALUES
            (@id_config, N'anestesias_totales',      N'Potencial',  N'Total de anestesias',        N'Suma anual de procedimientos de anestesia; mayor volumen indica mayor potencial de demanda.', 35.00, 1, N'percentil', N'{}'),
            (@id_config, N'numero_quirofanos',        N'Potencial',  N'Numero de quirofanos',       N'Capacidad operativa del hospital medida en numero de quirofanos disponibles.', 10.00, 1, N'percentil', N'{}'),
            (@id_config, N'recencia_seleccion',       N'Cobertura',  N'Recencia de seleccion',      N'Tiempo transcurrido desde la ultima seleccion del hospital; prioriza menor recencia para fomentar rotacion de cobertura.', 20.00, 1, N'tramos', N'{"nunca":100,"reciente":10,"tramos":[{"meses_min":12,"score":90},{"meses_min":6,"score":70},{"meses_min":3,"score":40}]}'),
            (@id_config, N'agrupabilidad_geografica', N'Geografia',  N'Agrupabilidad geografica',   N'Proximidad a otros hospitales ya seleccionados dentro del radio configurado; premia concentracion logistica.', 20.00, 1, N'funcion', N'{"radio_km": 50}'),
            (@id_config, N'cobertura_taller',         N'Cobertura',  N'Cobertura de taller',        N'Estado de cobertura efectiva: nunca seleccionado (maximo), seleccionado con taller pendiente de impartir (alto) o con taller ya Realizado (minimo).', 15.00, 1, N'tramos', N'{"nunca":100,"pendiente":90,"realizado":10}');

        PRINT 'Config General V2 (con cobertura_taller al 15%) insertada y activada.';
    END
    ELSE
        PRINT 'Config General V2 ya existe. Skip.';

    -- =========================================================================
    -- 7. hospital_extension: clasificación de contactos logísticos
    --    (columnas es_almacen/es_farmacia/es_sede_taller ya las crea 0016)
    --    Solo filas sin clasificar (es_sede_taller IS NULL); re-ejecutable.
    -- =========================================================================

    -- 7.1 Almacenes de distribución y BIRMEX -> no sede
    UPDATE he
    SET he.es_almacen = 1, he.es_farmacia = 0, he.es_sede_taller = 0
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat hc ON hc.codigoContacto = he.id_hospital
    WHERE he.es_sede_taller IS NULL
      AND (hc.nombreContacto LIKE '%BIRMEX%'
        OR (hc.nombreContacto LIKE '%ALMAC%'
            AND (hc.nombreContacto LIKE '%DELEGACIONAL%' OR hc.nombreContacto LIKE '%DELEGACION%')));
    PRINT CONCAT('Almacenes/BIRMEX clasificados (no sede): ', @@ROWCOUNT);

    -- 7.2 Sub-almacenes -> sede preferente de su UMAE
    UPDATE he
    SET he.es_almacen = 1, he.es_farmacia = 0, he.es_sede_taller = 1
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat hc ON hc.codigoContacto = he.id_hospital
    WHERE he.es_sede_taller IS NULL
      AND (hc.nombreContacto LIKE '%SUB-ALMAC%' OR hc.nombreContacto LIKE '%SUB ALMAC%');
    PRINT CONCAT('Sub-almacenes clasificados (sede): ', @@ROWCOUNT);

    -- 7.3 Farmacias con sub-almacén del mismo UMAE -> no sede
    UPDATE he
    SET he.es_almacen = 0, he.es_farmacia = 1, he.es_sede_taller = 0
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat hc ON hc.codigoContacto = he.id_hospital
    WHERE he.es_sede_taller IS NULL
      AND hc.nombreContacto LIKE '%FARMACIA%'
      AND EXISTS (
          SELECT 1
          FROM Asokam.dbo.genContactosCat h2
          WHERE h2.activo = 1
            AND (h2.nombreContacto LIKE '%SUB-ALMAC%' OR h2.nombreContacto LIKE '%SUB ALMAC%')
            AND h2.nombreContacto LIKE LEFT(hc.nombreContacto, LEN(hc.nombreContacto) - LEN(' - FARMACIA')) + '%'
      );
    PRINT CONCAT('Farmacias con sub-almacen (no sede): ', @@ROWCOUNT);

    -- 7.4 Farmacias sin sub-almacén (únicas de su UMAE) -> sede
    UPDATE he
    SET he.es_almacen = 0, he.es_farmacia = 1, he.es_sede_taller = 1
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat hc ON hc.codigoContacto = he.id_hospital
    WHERE he.es_sede_taller IS NULL
      AND hc.nombreContacto LIKE '%FARMACIA%';
    PRINT CONCAT('Farmacias sin sub-almacen (sede): ', @@ROWCOUNT);

    -- 7.5 Resto -> sede de taller
    UPDATE he
    SET he.es_almacen = 0, he.es_farmacia = 0, he.es_sede_taller = 1
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat hc ON hc.codigoContacto = he.id_hospital
    WHERE he.es_sede_taller IS NULL;
    PRINT CONCAT('Resto clasificado como sede: ', @@ROWCOUNT);

    -- =========================================================================
    -- 8. hospital_extension: gerencia NULL por jerarquía institucional
    --    (de 0019; solo filas con id_tipo_gerencia IS NULL; nunca sobreescribe)
    -- =========================================================================
    UPDATE he
    SET he.id_tipo_gerencia = tg.id_tipo_gerencia,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g
        ON g.codigoContacto = he.id_hospital
    JOIN educacion_medica.tipo_gerencia tg
        ON tg.descripcion = CASE
             WHEN g.codigoContacto = 364 OR g.codigoContactoPrincipal = 364 THEN 'IMSS'
             WHEN g.tipo = 'Privado' THEN 'Privado'
             ELSE 'Descentralizado'
           END
    WHERE he.id_tipo_gerencia IS NULL;
    PRINT CONCAT('Gerencia asignada a ', @@ROWCOUNT, ' hospital_extension (solo filas con gerencia NULL).');

    COMMIT TRANSACTION;
    PRINT '0030 completado: catalogos y backfills de instalacion limpia (solo Lefarma).';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR en 0030: ' + ERROR_MESSAGE();
    THROW;
END CATCH

-- =========================================================================
-- VERIFICACIÓN (ejecutar aparte)
-- =========================================================================
-- Catalogos:
-- SELECT (SELECT COUNT(*) FROM educacion_medica.tipo_gerencia)      AS gerencias,
--        (SELECT COUNT(*) FROM educacion_medica.regiones_cat)       AS regiones,
--        (SELECT COUNT(*) FROM educacion_medica.regiones_estados)   AS mapeos_estado,
--        (SELECT COUNT(*) FROM educacion_medica.config_ranking WHERE activo = 1) AS config_activa,
--        (SELECT COUNT(*) FROM educacion_medica.parametros_anestesias WHERE anio = YEAR(GETDATE())) AS params_anestesias;
--
-- Extensions sin clasificar / sin gerencia (esperado: 0 tras el primer sync):
-- SELECT COUNT(*) AS sin_clasificar FROM educacion_medica.hospital_extension WHERE es_sede_taller IS NULL;
-- SELECT COUNT(*) AS sin_gerencia   FROM educacion_medica.hospital_extension WHERE id_tipo_gerencia IS NULL;
