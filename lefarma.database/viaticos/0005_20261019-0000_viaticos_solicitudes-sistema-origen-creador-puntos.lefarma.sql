-- ============================================================
-- 0005_20261019-0000_viaticos_solicitudes-sistema-origen-creador-puntos.lefarma.sql
-- Descripcion: Amplia [viaticos].[solicitudes] con los datos que expone la
--              tabla "Mis viajes" del frontend:
--
--              1) sistema_origen    -> sistema que creo la solicitud
--                                      ('viaticos' | 'educacion_medica').
--              2) id_usuario_creacion -> quien creo el registro (auditoria).
--              3) num_puntos        -> contador de puntos/destinos del viaje.
--
--              Las tablas base (solicitudes, solicitud_opciones,
--              solicitud_ajustes, solicitud_eventos) las crea el script
--              0003_20261007-0000_viaticos_schema-solicitudes.lefarma.sql.
--              Este script es la migracion incremental y debe ejecutarse
--              DESPUES del 0003.
--
-- App: viaticos
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (familia lefarma).
-- Idempotente: puede reejecutarse; no duplica columnas, defaults, CHECK ni
--              indices, y solo rellena filas con datos faltantes.
-- NO se aplica automaticamente: requiere ejecucion manual.
-- ============================================================

SET NOCOUNT ON;
GO

-- 1) sistema_origen: bandera del sistema que origino la solicitud.
--    Default 'viaticos' para que las filas existentes queden clasificadas
--    sin intervencion manual.
IF COL_LENGTH('viaticos.solicitudes', 'sistema_origen') IS NULL
BEGIN
    ALTER TABLE viaticos.solicitudes
        ADD sistema_origen NVARCHAR(30) NOT NULL
            CONSTRAINT DF_solicitudes_sistema_origen DEFAULT ('viaticos');
    PRINT 'Columna [viaticos].[solicitudes].[sistema_origen] creada.';
END
ELSE
    PRINT 'Columna [viaticos].[solicitudes].[sistema_origen] ya existe. Skip.';
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_solicitudes_sistema_origen'
      AND parent_object_id = OBJECT_ID(N'viaticos.solicitudes')
)
BEGIN
    ALTER TABLE viaticos.solicitudes WITH CHECK
        ADD CONSTRAINT CK_solicitudes_sistema_origen
            CHECK (sistema_origen IN ('viaticos', 'educacion_medica'));
    PRINT 'Constraint [CK_solicitudes_sistema_origen] creada.';
END
ELSE
    PRINT 'Constraint [CK_solicitudes_sistema_origen] ya existe. Skip.';
GO

-- 2) id_usuario_creacion: auditoria de quien creo la solicitud.
--    Se agrega nullable, se rellena con id_usuario_solicitante (en el flujo
--    actual son el mismo usuario) y al final se vuelve NOT NULL.
IF COL_LENGTH('viaticos.solicitudes', 'id_usuario_creacion') IS NULL
BEGIN
    ALTER TABLE viaticos.solicitudes
        ADD id_usuario_creacion INT NULL;
    PRINT 'Columna [viaticos].[solicitudes].[id_usuario_creacion] creada (nullable para backfill).';
END
ELSE
    PRINT 'Columna [viaticos].[solicitudes].[id_usuario_creacion] ya existe. Skip.';
GO

UPDATE viaticos.solicitudes
SET id_usuario_creacion = id_usuario_solicitante
WHERE id_usuario_creacion IS NULL;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'viaticos.solicitudes')
      AND name = N'id_usuario_creacion'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE viaticos.solicitudes
        ALTER COLUMN id_usuario_creacion INT NOT NULL;
    PRINT 'Columna [viaticos].[solicitudes].[id_usuario_creacion] ahora es NOT NULL.';
END
ELSE
    PRINT 'Columna [viaticos].[solicitudes].[id_usuario_creacion] ya es NOT NULL. Skip.';
GO

-- 3) num_puntos: contador de puntos/destinos a visitar, calculado al crear.
IF COL_LENGTH('viaticos.solicitudes', 'num_puntos') IS NULL
BEGIN
    ALTER TABLE viaticos.solicitudes
        ADD num_puntos INT NOT NULL
            CONSTRAINT DF_solicitudes_num_puntos DEFAULT (0);
    PRINT 'Columna [viaticos].[solicitudes].[num_puntos] creada.';
END
ELSE
    PRINT 'Columna [viaticos].[solicitudes].[num_puntos] ya existe. Skip.';
GO

-- Backfill de num_puntos desde datos_json.destinos (solo filas en 0 y con
-- JSON valido). JSON_QUERY devuelve NULL si el nodo no es un arreglo, y
-- OPENJSON('[]') no produce filas: nunca rompe con datos legados.
UPDATE s
SET num_puntos = COALESCE((
    SELECT COUNT(*)
    FROM OPENJSON(COALESCE(JSON_QUERY(s.datos_json, '$.destinos'), '[]')) AS d
), 0)
FROM viaticos.solicitudes AS s
WHERE s.num_puntos = 0
  AND ISJSON(s.datos_json) = 1;
GO

-- 4) Indice para filtrar/listar por sistema de origen.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'viaticos.solicitudes')
      AND name = N'IX_solicitudes_sistema_origen'
)
BEGIN
    CREATE INDEX IX_solicitudes_sistema_origen
        ON viaticos.solicitudes (sistema_origen, fecha_creacion DESC)
        INCLUDE (id_usuario_solicitante, id_usuario_creacion, periodo, estado, num_puntos);
    PRINT 'Indice [IX_solicitudes_sistema_origen] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitudes_sistema_origen] ya existe. Skip.';
GO

PRINT 'FIN script 0005 viaticos (sistema_origen + id_usuario_creacion + num_puntos).';
GO
