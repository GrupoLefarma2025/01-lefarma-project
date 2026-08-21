-- ============================================================
-- 0004_20260810-1820_educacion-medica_create-view-hospitales.lefarma.sql
-- Descripcion: Crea la vista vw_hospitales_clasificados en el schema
--              educacion_medica (Lefarma) que consolida los datos de
--              hospitales desde Asokam (cross-DB) con la clasificación
--              por institución derivada de la jerarquía codigoContactoPrincipal.
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (familia lefarma).
-- Schema requerido: educacion_medica (creado en 0002/0003).
--
-- CROSS-DB: lee de Asokam.dbo (genContactosCat, genEstadosCat). Lefarma
--   no duplica los datos; la vista los consulta en vivo. Requiere que el
--   usuario de ejecución tenga READ sobre Asokam (mismo servidor 192.168.4.2).
--
-- Clasificación por institución (derivable, no manual):
--   La lógica canónica vive en Asokam dbo.vwDiarioDeVentas (CASE cuyo nombre
--   original es ClienteAgrupado; en el módulo se expone como 'institucion').
--   IMSS=contacto 364, Bienestar=385, ISSSTE=370; los hospitales cuelgan como
--   hijas vía codigoContactoPrincipal. Esta vista replica esa lógica para el
--   catálogo de contactos (sin datos de venta). Ver ADR 00001 §1.2.12 y
--   reglas-negocio.md §5.8.
--
-- Limitación conocida: la jerarquía se recorre 1 nivel (codigoContactoPrincipal
--   directo al padre institucional). Si un hospital nieto no apunta directo al
--   abuelo institucional, quedará 'Sin clasificar' y se resuelve manualmente.
-- ============================================================

SET NOCOUNT ON;
GO

IF NOT EXISTS (SELECT * FROM sys.views WHERE schema_id = SCHEMA_ID('educacion_medica') AND name = 'vw_hospitales_clasificados')
BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'
    CREATE VIEW educacion_medica.vw_hospitales_clasificados AS
    SELECT
        g.codigoContacto,
        g.nombreContacto,
        g.nombreCorto,
        g.tipo,
        g.activo,
        g.ciudad,
        g.codigoEstado,
        e.nombreEstado,
        g.latitud,
        g.longitud,
        g.clues,
        g.codigoContactoPrincipal,
        p.nombreContacto AS nombre_padre,
        CASE
            WHEN g.codigoContacto = 364 OR g.codigoContactoPrincipal = 364 THEN ''IMSS''
            WHEN g.codigoContacto = 385 OR g.codigoContactoPrincipal = 385 THEN ''Bienestar''
            WHEN g.codigoContacto = 370 OR g.codigoContactoPrincipal = 370 THEN ''ISSSTE''
            WHEN g.tipo = ''Gobierno''    THEN ''Descentralizado''
            WHEN g.tipo = ''Privado''     THEN ''Privado''
            WHEN g.tipo = ''Distribuidor'' THEN ''Distribuidor''
            ELSE ''Sin clasificar''
        END AS institucion
    FROM Asokam.dbo.genContactosCat g
    LEFT JOIN Asokam.dbo.genContactosCat p
        ON p.codigoContacto = g.codigoContactoPrincipal
    LEFT JOIN Asokam.dbo.genEstadosCat e
        ON e.codigoEstado = TRY_CAST(g.codigoEstado AS INT);';
    EXEC sp_executesql @sql;
    PRINT 'Vista [educacion_medica].[vw_hospitales_clasificados] creada.';
END
ELSE
BEGIN
    PRINT 'Vista [educacion_medica].[vw_hospitales_clasificados] ya existe. Skip.';
END
GO

-- Documentación (extended property MS_Description a nivel schema+vista)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.vw_hospitales_clasificados')
      AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Vista cross-DB (Asokam) con hospitales + institución derivada de la jerarquía codigoContactoPrincipal (364=IMSS, 385=Bienestar, 370=ISSSTE). Para el módulo Educación Médica.',
        @level0type = N'SCHEMA', @level0name = N'educacion_medica',
        @level1type = N'VIEW',  @level1name = N'vw_hospitales_clasificados';
GO

PRINT 'FIN script 0004.';
GO
