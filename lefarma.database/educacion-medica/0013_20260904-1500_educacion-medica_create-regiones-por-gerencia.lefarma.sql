-- ============================================================
-- 0013_20260904-1500_educacion-medica_create-regiones-por-gerencia.lefarma.sql
-- Descripcion: Regiones POR GERENCIA. Los ejecutivos de ventas del IMSS no son
--              los mismos que los de Descentralizados, por lo que cada gerencia
--              mantiene su propio catalogo de regiones y su propio mapeo
--              estado -> region. Un equipo (EquipoPareo) sigue ligado a una
--              region; su gerencia se deriva de la region.
--              Cambios:
--              1) regiones_cat.id_tipo_gerencia      (FK fisica -> tipo_gerencia)
--              2) regiones_estados.id_tipo_gerencia  (denormalizado para poder
--                 mantener UQ (gerencia, codigo_estado); SQL Server no permite
--                 un UQ sobre una columna de la tabla padre)
--              3) Las 7 regiones existentes y sus 31 mapeos pasan a
--                 Descentralizado. Se COPIAN las 7 regiones equivalentes para
--                 IMSS con el mismo mapeo de estados (base editable desde la app).
--              4) hospital_extension.id_region se re-deriva:
--                 - hospital con region de OTRA gerencia -> region del mapeo de
--                   SU gerencia; si no hay mapeo -> NULL.
--                 - hospital SIN gerencia -> region NULL (regla de negocio:
--                   la region exige gerencia).
--              5) UQ globales (UQ_regiones_cat_nombre, UQ_regiones_estados_estado)
--                 se reemplazan por UQ compuestas por gerencia.
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (familia lefarma).
-- Idempotente: puede reejecutarse; no duplica regiones, mapeos ni reasignaciones.
-- CROSS-DB: lee Asokam.dbo.genContactosCat (mismo servidor).
-- ============================================================

SET NOCOUNT ON;
GO

-- ============================================================
-- 1) Columnas id_tipo_gerencia (NULL al crear; se endurecen al final)
-- ============================================================

IF COL_LENGTH('educacion_medica.regiones_cat', 'id_tipo_gerencia') IS NULL
BEGIN
    ALTER TABLE educacion_medica.regiones_cat ADD id_tipo_gerencia INT NULL;
    PRINT 'Columna [regiones_cat].[id_tipo_gerencia] agregada.';
END
ELSE
    PRINT 'Columna [regiones_cat].[id_tipo_gerencia] ya existe. Skip.';
GO

IF COL_LENGTH('educacion_medica.regiones_estados', 'id_tipo_gerencia') IS NULL
BEGIN
    ALTER TABLE educacion_medica.regiones_estados ADD id_tipo_gerencia INT NULL;
    PRINT 'Columna [regiones_estados].[id_tipo_gerencia] agregada.';
END
ELSE
    PRINT 'Columna [regiones_estados].[id_tipo_gerencia] ya existe. Skip.';
GO

-- ============================================================
-- 2) Backfill: lo existente (7 regiones + 31 mapeos) es Descentralizado
-- ============================================================

DECLARE @id_descentralizado INT = (SELECT id_tipo_gerencia FROM educacion_medica.tipo_gerencia WHERE descripcion = 'Descentralizado');
DECLARE @id_imss INT = (SELECT id_tipo_gerencia FROM educacion_medica.tipo_gerencia WHERE descripcion = 'IMSS');

IF @id_descentralizado IS NULL OR @id_imss IS NULL
BEGIN
    RAISERROR('No existe el catalogo tipo_gerencia con IMSS y Descentralizado. Ejecute 0003 primero.', 16, 1);
    RETURN;
END

UPDATE educacion_medica.regiones_cat
SET id_tipo_gerencia = @id_descentralizado,
    fecha_modificacion = SYSUTCDATETIME()
WHERE id_tipo_gerencia IS NULL;

PRINT CONCAT('Regiones asignadas a Descentralizado: ', @@ROWCOUNT);
GO

-- Mapeos: heredan la gerencia de su region (por si el paso anterior ya corrio)
UPDATE ze
SET id_tipo_gerencia = rc.id_tipo_gerencia,
    fecha_modificacion = SYSUTCDATETIME()
FROM educacion_medica.regiones_estados ze
JOIN educacion_medica.regiones_cat rc ON rc.id_region = ze.id_region
WHERE ze.id_tipo_gerencia IS NULL;

PRINT CONCAT('Mapeos con gerencia heredada de su region: ', @@ROWCOUNT);
GO

-- ============================================================
-- 3) Reemplazo de UQ globales por compuestas: primero eliminar las viejas
--    (necesario antes de copiar los mapeos a IMSS, que violarian UQ(codigo_estado))
-- ============================================================

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.regiones_cat') AND name = 'UQ_regiones_cat_nombre')
BEGIN
    ALTER TABLE educacion_medica.regiones_cat DROP CONSTRAINT UQ_regiones_cat_nombre;
    PRINT 'UQ [UQ_regiones_cat_nombre] eliminado.';
END
ELSE
    PRINT 'UQ [UQ_regiones_cat_nombre] no existe (ya reemplazado). Skip.';
GO

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.regiones_estados') AND name = 'UQ_regiones_estados_estado')
BEGIN
    ALTER TABLE educacion_medica.regiones_estados DROP CONSTRAINT UQ_regiones_estados_estado;
    PRINT 'UQ [UQ_regiones_estados_estado] eliminado.';
END
ELSE
    PRINT 'UQ [UQ_regiones_estados_estado] no existe (ya reemplazado). Skip.';
GO

-- ============================================================
-- 4) Copia de regiones y mapeos para IMSS (base editable desde la app)
-- ============================================================

DECLARE @id_descentralizado_4 INT = (SELECT id_tipo_gerencia FROM educacion_medica.tipo_gerencia WHERE descripcion = 'Descentralizado');
DECLARE @id_imss_4 INT = (SELECT id_tipo_gerencia FROM educacion_medica.tipo_gerencia WHERE descripcion = 'IMSS');

INSERT INTO educacion_medica.regiones_cat
    (nombre, centro_latitud, centro_longitud, activo, id_tipo_gerencia, fecha_creacion, fecha_modificacion)
SELECT rc.nombre, rc.centro_latitud, rc.centro_longitud, rc.activo, @id_imss_4, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM educacion_medica.regiones_cat rc
WHERE rc.id_tipo_gerencia = @id_descentralizado_4
  AND NOT EXISTS (
      SELECT 1 FROM educacion_medica.regiones_cat x
      WHERE x.id_tipo_gerencia = @id_imss_4 AND x.nombre = rc.nombre);

PRINT CONCAT('Regiones IMSS creadas (copia): ', @@ROWCOUNT);
GO

DECLARE @id_descentralizado_5 INT = (SELECT id_tipo_gerencia FROM educacion_medica.tipo_gerencia WHERE descripcion = 'Descentralizado');
DECLARE @id_imss_5 INT = (SELECT id_tipo_gerencia FROM educacion_medica.tipo_gerencia WHERE descripcion = 'IMSS');

INSERT INTO educacion_medica.regiones_estados
    (codigo_estado, id_region, id_tipo_gerencia, fecha_creacion, fecha_modificacion)
SELECT ze.codigo_estado, destino.id_region, @id_imss_5, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM educacion_medica.regiones_estados ze
JOIN educacion_medica.regiones_cat origen
    ON origen.id_region = ze.id_region AND origen.id_tipo_gerencia = @id_descentralizado_5
JOIN educacion_medica.regiones_cat destino
    ON destino.id_tipo_gerencia = @id_imss_5 AND destino.nombre = origen.nombre
WHERE NOT EXISTS (
    SELECT 1 FROM educacion_medica.regiones_estados x
    WHERE x.codigo_estado = ze.codigo_estado AND x.id_tipo_gerencia = @id_imss_5);

PRINT CONCAT('Mapeos IMSS copiados: ', @@ROWCOUNT);
GO

-- ============================================================
-- 5) Re-derivacion de hospital_extension.id_region
-- ============================================================

-- 5a) Region de OTRA gerencia con mapeo disponible en la gerencia del hospital
UPDATE he
SET id_region = ze.id_region,
    fecha_modificacion = SYSUTCDATETIME()
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
JOIN educacion_medica.regiones_estados ze
    ON ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
   AND ze.id_tipo_gerencia = he.id_tipo_gerencia
JOIN educacion_medica.regiones_cat actual ON actual.id_region = he.id_region
WHERE actual.id_tipo_gerencia <> he.id_tipo_gerencia;

PRINT CONCAT('Hospitales reasignados a la region de su gerencia: ', @@ROWCOUNT);


-- 5b) Region de OTRA gerencia sin mapeo en la gerencia del hospital -> NULL
UPDATE he
SET id_region = NULL,
    fecha_modificacion = SYSUTCDATETIME()
FROM educacion_medica.hospital_extension he
JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
JOIN educacion_medica.regiones_cat actual ON actual.id_region = he.id_region
WHERE actual.id_tipo_gerencia <> he.id_tipo_gerencia
  AND NOT EXISTS (
      SELECT 1 FROM educacion_medica.regiones_estados ze
      WHERE ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
        AND ze.id_tipo_gerencia = he.id_tipo_gerencia);

PRINT CONCAT('Hospitales sin mapeo en su gerencia, region a NULL: ', @@ROWCOUNT);


-- 5c) Hospital sin gerencia no puede tener region -> NULL (regla de negocio)
UPDATE educacion_medica.hospital_extension
SET id_region = NULL,
    fecha_modificacion = SYSUTCDATETIME()
WHERE id_tipo_gerencia IS NULL AND id_region IS NOT NULL;

PRINT CONCAT('Hospitales sin gerencia con region limpiada: ', @@ROWCOUNT);


-- ============================================================
-- 6) Endurecer columnas (NOT NULL), FKs y UQ compuestas
-- ============================================================

IF EXISTS (SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('educacion_medica.regiones_cat') AND name = 'id_tipo_gerencia' AND is_nullable = 1)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.regiones_cat WHERE id_tipo_gerencia IS NULL)
    BEGIN
        ALTER TABLE educacion_medica.regiones_cat ALTER COLUMN id_tipo_gerencia INT NOT NULL;
        PRINT 'regiones_cat.id_tipo_gerencia ahora NOT NULL.';
    END
    ELSE
        PRINT 'ADVERTENCIA: quedan regiones sin gerencia; no se pudo poner NOT NULL.';
END
ELSE
    PRINT 'regiones_cat.id_tipo_gerencia ya es NOT NULL. Skip.';


IF EXISTS (SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('educacion_medica.regiones_estados') AND name = 'id_tipo_gerencia' AND is_nullable = 1)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM educacion_medica.regiones_estados WHERE id_tipo_gerencia IS NULL)
    BEGIN
        ALTER TABLE educacion_medica.regiones_estados ALTER COLUMN id_tipo_gerencia INT NOT NULL;
        PRINT 'regiones_estados.id_tipo_gerencia ahora NOT NULL.';
    END
    ELSE
        PRINT 'ADVERTENCIA: quedan mapeos sin gerencia; no se pudo poner NOT NULL.';
END
ELSE
    PRINT 'regiones_estados.id_tipo_gerencia ya es NOT NULL. Skip.';


IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('educacion_medica.regiones_cat') AND name = 'FK_regiones_cat_tipo_gerencia')
BEGIN
    ALTER TABLE educacion_medica.regiones_cat
    ADD CONSTRAINT FK_regiones_cat_tipo_gerencia
        FOREIGN KEY (id_tipo_gerencia) REFERENCES educacion_medica.tipo_gerencia (id_tipo_gerencia);
    PRINT 'FK [FK_regiones_cat_tipo_gerencia] creada.';
END
ELSE
    PRINT 'FK [FK_regiones_cat_tipo_gerencia] ya existe. Skip.';


IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('educacion_medica.regiones_estados') AND name = 'FK_regiones_estados_tipo_gerencia')
BEGIN
    ALTER TABLE educacion_medica.regiones_estados
    ADD CONSTRAINT FK_regiones_estados_tipo_gerencia
        FOREIGN KEY (id_tipo_gerencia) REFERENCES educacion_medica.tipo_gerencia (id_tipo_gerencia);
    PRINT 'FK [FK_regiones_estados_tipo_gerencia] creada.';
END
ELSE
    PRINT 'FK [FK_regiones_estados_tipo_gerencia] ya existe. Skip.';

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.regiones_cat') AND name = 'UQ_regiones_cat_gerencia_nombre')
BEGIN
    ALTER TABLE educacion_medica.regiones_cat
    ADD CONSTRAINT UQ_regiones_cat_gerencia_nombre UNIQUE (id_tipo_gerencia, nombre);
    PRINT 'UQ [UQ_regiones_cat_gerencia_nombre] creado.';
END
ELSE
    PRINT 'UQ [UQ_regiones_cat_gerencia_nombre] ya existe. Skip.';


IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('educacion_medica.regiones_estados') AND name = 'UQ_regiones_estados_gerencia_estado')
BEGIN
    ALTER TABLE educacion_medica.regiones_estados
    ADD CONSTRAINT UQ_regiones_estados_gerencia_estado UNIQUE (id_tipo_gerencia, codigo_estado);
    PRINT 'UQ [UQ_regiones_estados_gerencia_estado] creado.';
END
ELSE
    PRINT 'UQ [UQ_regiones_estados_gerencia_estado] ya existe. Skip.';


-- ============================================================
-- 7) Documentacion (MS_Description)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.regiones_cat')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.regiones_cat'), 'id_tipo_gerencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Gerencia duena del catalogo de regiones (FK educacion_medica.tipo_gerencia): IMSS y Descentralizado tienen sus propias regiones; sus ejecutivos de ventas son distintos.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'regiones_cat',
        @level2type = N'COLUMN', @level2name = N'id_tipo_gerencia';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.regiones_estados')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.regiones_estados'), 'id_tipo_gerencia', 'ColumnId')
      AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Gerencia del mapeo (denormalizada de su region). Permite que un mismo estado pertenezca a una region de IMSS y a una de Descentralizado a la vez (UQ compuesta). El servicio la mantiene sincronizada con la region.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'TABLE',  @level1name = N'regiones_estados',
        @level2type = N'COLUMN', @level2name = N'id_tipo_gerencia';
GO

-- ============================================================
-- 8) Verificacion
-- ============================================================

SELECT rc.id_tipo_gerencia, tg.descripcion AS gerencia, COUNT(*) AS regiones
FROM educacion_medica.regiones_cat rc
JOIN educacion_medica.tipo_gerencia tg ON tg.id_tipo_gerencia = rc.id_tipo_gerencia
GROUP BY rc.id_tipo_gerencia, tg.descripcion
ORDER BY rc.id_tipo_gerencia;

SELECT ze.id_tipo_gerencia, tg.descripcion AS gerencia, COUNT(*) AS mapeos_estado
FROM educacion_medica.regiones_estados ze
JOIN educacion_medica.tipo_gerencia tg ON tg.id_tipo_gerencia = ze.id_tipo_gerencia
GROUP BY ze.id_tipo_gerencia, tg.descripcion
ORDER BY ze.id_tipo_gerencia;

SELECT he.id_tipo_gerencia, ISNULL(tg.descripcion, 'SIN GERENCIA') AS gerencia,
       COUNT(*) AS hospitales,
       SUM(CASE WHEN he.id_region IS NOT NULL THEN 1 ELSE 0 END) AS con_region
FROM educacion_medica.hospital_extension he
LEFT JOIN educacion_medica.tipo_gerencia tg ON tg.id_tipo_gerencia = he.id_tipo_gerencia
GROUP BY he.id_tipo_gerencia, tg.descripcion
ORDER BY he.id_tipo_gerencia;

PRINT 'FIN script 0013.';
GO
