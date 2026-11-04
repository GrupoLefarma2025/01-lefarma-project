-- ============================================================
-- 0010_20260903-1200_educacion-medica_create-catalogo-regiones.lefarma.sql
-- Descripcion: Catálogo maestro de regiones (macro, estable) para la
--              segmentación logística de hospitales.
--              1) educacion_medica.regiones_cat      -> 7 regiones, editable
--              2) educacion_medica.regiones_estados  -> mapeo estado -> región,
--                 editable; codigo_estado es FK lógica -> Asokam.genEstadosCat
--              3) hospital_extension.id_region -> FK fisica -> regiones_cat
--                 (columna creada en 0003; FK aqui, SET NULL al eliminar la
--                 region). NULL = sin asignar
--              4) Seed de las 7 regiones (naming literal del campo
--                 genContactosCat.zona) + mapeo inicial de 31 estados.
--                 SUGERENCIA editable: corrige errores conocidos de
--                 Asokam.genRegionesXDelegacionCat (Aguascalientes/Chihuahua
--                 no van en CDMX SUR, Michoacán no va en OTE-PTE). La Ciudad
--                de México (493) NO se mapea: se asigna manualmente.
--              5) Backfill de id_region en hospital_extension por el mapeo.-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (familia lefarma).
-- Idempotente: puede reejecutarse; no duplica regiones, mapeos ni backfill.
-- CROSS-DB: lee Asokam.dbo.genContactosCat (mismo servidor 192.168.4.2).
-- ============================================================

SET NOCOUNT ON;
GO

-- 1) regiones_cat: catálogo maestro editable (audit columns: es maestro)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'regiones_cat')
BEGIN
    CREATE TABLE educacion_medica.regiones_cat
    (
        id_region                 INT IDENTITY(1,1) NOT NULL,
        nombre                  NVARCHAR(50) NOT NULL,
        centro_latitud          DECIMAL(9,6) NULL,
        centro_longitud         DECIMAL(9,6) NULL,
        activo                  BIT NOT NULL CONSTRAINT DF_regiones_cat_activo DEFAULT (1),
        fecha_creacion          DATETIME2 NOT NULL CONSTRAINT DF_regiones_cat_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion      DATETIME2 NOT NULL CONSTRAINT DF_regiones_cat_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        id_usuario_creacion     INT NULL,
        id_usuario_modificacion INT NULL,
        CONSTRAINT PK_regiones_cat PRIMARY KEY (id_region),
        CONSTRAINT UQ_regiones_cat_nombre UNIQUE (nombre)
    );
    PRINT 'Tabla [educacion_medica].[regiones_cat] creada.';
END
ELSE
    PRINT 'Tabla [educacion_medica].[regiones_cat] ya existe. Skip.';
GO

-- 2) regiones_estados: mapeo estado -> región (editable, 1 fila por estado)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'regiones_estados')
BEGIN
    CREATE TABLE educacion_medica.regiones_estados
    (
        id_region_estado          INT IDENTITY(1,1) NOT NULL,
        codigo_estado           INT NOT NULL,   -- FK logica -> Asokam.genEstadosCat.codigoEstado
        id_region                 INT NOT NULL,   -- FK fisica -> regiones_cat
        fecha_creacion          DATETIME2 NOT NULL CONSTRAINT DF_regiones_estados_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion      DATETIME2 NOT NULL CONSTRAINT DF_regiones_estados_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        id_usuario_creacion     INT NULL,
        id_usuario_modificacion INT NULL,
        CONSTRAINT PK_regiones_estados PRIMARY KEY (id_region_estado),
        CONSTRAINT UQ_regiones_estados_estado UNIQUE (codigo_estado),
        CONSTRAINT FK_regiones_estados_region FOREIGN KEY (id_region) REFERENCES educacion_medica.regiones_cat (id_region)
    );
    PRINT 'Tabla [educacion_medica].[regiones_estados] creada.';
END
ELSE
    PRINT 'Tabla [educacion_medica].[regiones_estados] ya existe. Skip.';
GO

-- 3) hospital_extension.id_region: FK fisica -> regiones_cat (SET NULL al
--    eliminar la region). La columna se crea en el CREATE TABLE del script
--    0003; la FK solo puede crearse aqui, porque regiones_cat se crea en este
--    script (no existe aun cuando 0003 corre). NULL = sin asignar.

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('educacion_medica.hospital_extension') AND name = 'FK_hospital_extension_region')
BEGIN
    ALTER TABLE educacion_medica.hospital_extension
    ADD CONSTRAINT FK_hospital_extension_region
    FOREIGN KEY (id_region) REFERENCES educacion_medica.regiones_cat (id_region)
    ON DELETE SET NULL;
    PRINT 'FK [FK_hospital_extension_region] agregada.';
END
ELSE
    PRINT 'FK [FK_hospital_extension_region] ya existe. Skip.';
GO

-- 4) Seed: 7 regiones (naming literal de genContactosCat.zona; renombrables
--    desde la app). OJO: el catálogo Asokam.genRegionesXDelegacionCat usa
--    'CDMX OTE - PTE'; aquí se conserva 'OTE - PTE' por consistencia con el
--    campo zona ya poblado en Asokam.

INSERT INTO educacion_medica.regiones_cat (nombre, activo, fecha_creacion, fecha_modificacion)
SELECT v.nombre, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM (VALUES
    (N'CDMX NORTE'),
    (N'CDMX SUR'),
    (N'NORESTE'),
    (N'NOROESTE'),
    (N'OCCIDENTE'),
    (N'OTE - PTE'),
    (N'SURESTE')
) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM educacion_medica.regiones_cat z WHERE z.nombre = v.nombre);

DECLARE @n_regiones INT = (SELECT COUNT(*) FROM educacion_medica.regiones_cat);
PRINT CONCAT('Regiones en catálogo: ', @n_regiones);
GO

--    Mapeo inicial de estados -> región (SUGERENCIA editable desde la app).
--    Correcciones vs genRegionesXDelegacionCat (errores geográficos
--    validados con GPS el 2026-09-03):
--      Aguascalientes: CDMX SUR -> OCCIDENTE
--      Chihuahua:      CDMX SUR -> NOROESTE
--      Michoacán:      CDMX OTE - PTE -> OCCIDENTE
--      Puebla:         CDMX NORTE -> OTE - PTE
--    Ciudad de México (493) NO se mapea: la división CDMX NORTE / CDMX SUR
--    se decide manualmente por hospital (apoyados en lat/long).

INSERT INTO educacion_medica.regiones_estados (codigo_estado, id_region, fecha_creacion, fecha_modificacion)
SELECT m.codigo_estado, z.id_region, SYSUTCDATETIME(), SYSUTCDATETIME()
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
WHERE NOT EXISTS (SELECT 1 FROM educacion_medica.regiones_estados ze WHERE ze.codigo_estado = m.codigo_estado);

DECLARE @n_mapeos INT = (SELECT COUNT(*) FROM educacion_medica.regiones_estados);
PRINT CONCAT('Mapeos estado->region: ', @n_mapeos);
GO

-- 5) Backfill: id_region en hospital_extension por el mapeo de estado.
--    Solo aplica donde id_region IS NULL (sugerencia inicial, editable).--    Hospitales de CDMX (493, sin mapeo) y sin codigoEstado válido quedan
--    NULL para asignación manual.

UPDATE he
SET id_region = ze.id_region,
    fecha_modificacion = SYSUTCDATETIME()
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g
    ON g.codigoContacto = he.id_hospital
JOIN educacion_medica.regiones_estados ze
    ON ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
WHERE he.id_region IS NULL;

PRINT CONCAT('Backfill aplicado a ', @@ROWCOUNT, ' hospital_extension.');
GO

-- Resumen de cobertura tras el backfill

SELECT z.nombre AS region, COUNT(he.id_hospital_extension) AS hospitales
FROM educacion_medica.regiones_cat z
LEFT JOIN educacion_medica.hospital_extension he ON he.id_region = z.id_region
GROUP BY z.id_region, z.nombre
ORDER BY z.id_region;

SELECT
    (SELECT COUNT(*) FROM educacion_medica.hospital_extension) AS extensiones_total,
    (SELECT COUNT(*) FROM educacion_medica.hospital_extension WHERE id_region IS NOT NULL) AS con_region,
    (SELECT COUNT(*) FROM educacion_medica.hospital_extension he
        JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
        WHERE TRY_CAST(g.codigoEstado AS INT) IS NULL) AS sin_codigo_estado,
    (SELECT COUNT(*) FROM educacion_medica.hospital_extension he
        JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
        WHERE NULLIF(g.latitud, 0) IS NULL) AS sin_coordenadas;
GO

PRINT 'FIN script 0010.';
GO
