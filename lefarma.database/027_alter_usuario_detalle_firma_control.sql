-- ============================================================================
-- LEFARMA - Consolida el control de cambios de firma en una columna JSON
-- ============================================================================
-- Fecha: 2026-09-24
-- Descripcion: Reemplaza las 4 columnas tipadas del script 032
--              (firma_subidas, firma_cambio_habilitado,
--               id_usuario_habilito_firma, fecha_habilito_firma)
--              por una sola columna JSON con el HISTORIAL DE EVENTOS:
--
--                firma_control NVARCHAR(MAX) NULL
--
--              Forma del JSON (arreglo de eventos en orden cronologico):
--                [
--                  { "accion": "subida",       "fecha": "...", "idUsuario": 123 },
--                  { "accion": "solicitud",    "fecha": "...", "idUsuario": 123 },
--                  { "accion": "habilitacion", "fecha": "...", "idUsuario": 45  },
--                  { "accion": "subida",       "fecha": "...", "idUsuario": 123 }
--                ]
--
--              Acciones: subida | eliminacion | solicitud | habilitacion
--              El estado (subidas, cambio habilitado, solicitud pendiente)
--              se DERIVA del historial en la app (Domain/Firmas/FirmaControl).
--
--              Migracion desde las columnas del 032:
--                - firma_subidas = N   -> N eventos "subida"
--                  (o 1 si hay firma_path y el contador quedo en 0).
--                  Fecha aproximada: fecha_modificacion.
--                - firma_cambio_habilitado = 1 (pendiente):
--                  evento "habilitacion" AL FINAL (ultimo evento => habilitado).
--                - firma_cambio_habilitado = 0 con auditoria (ya consumida):
--                  evento "habilitacion" PRIMERO (una subida posterior la consumio).
--
-- NOTA: este script NO elimina las columnas viejas. Eso lo hace el 035, que
--       debe ejecutarse DESPUES de desplegar el backend que ya no las usa.
-- ============================================================================

USE Lefarma;
GO

-- ----------------------------------------------------------------------------
-- PASO 1: columna firma_control
-- ----------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[config].[usuario_detalle]')
      AND name = 'firma_control'
)
BEGIN
    ALTER TABLE [config].[usuario_detalle]
    ADD [firma_control] NVARCHAR(MAX) NULL;
    PRINT 'Columna [firma_control] agregada a [config].[usuario_detalle]';
END
ELSE
BEGIN
    PRINT 'Columna [firma_control] ya existe. Saltando.';
END
GO

-- ----------------------------------------------------------------------------
-- PASO 2: migracion de las columnas del 032 al historial de eventos.
-- Idempotente: solo filas con firma_control IS NULL.
-- ----------------------------------------------------------------------------
;WITH Nums AS (
    SELECT TOP (ISNULL((
        SELECT MAX(CASE
                       WHEN ud.firma_subidas > 0 THEN ud.firma_subidas
                       WHEN ud.firma_path IS NOT NULL AND LTRIM(RTRIM(ud.firma_path)) <> '' THEN 1
                       ELSE 0
                   END)
        FROM [config].[usuario_detalle] ud), 1))
        ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_objects
),
Eventos AS (
    -- Habilitacion YA CONSUMIDA (flag=0 con auditoria): va PRIMERO.
    SELECT
        ud.id_usuario AS id_usuario,
        0 AS orden,
        'habilitacion' AS accion,
        ISNULL(ud.fecha_habilito_firma, GETUTCDATE()) AS fecha,
        ISNULL(ud.id_usuario_habilito_firma, 0) AS idUsuario
    FROM [config].[usuario_detalle] ud
    WHERE ud.firma_cambio_habilitado = 0
      AND ud.id_usuario_habilito_firma IS NOT NULL

    UNION ALL

    -- Subidas: N eventos (o 1 si hay firma y el contador quedo en 0).
    SELECT
        ud.id_usuario,
        1,
        'subida',
        ISNULL(ud.fecha_modificacion, GETUTCDATE()),
        ud.id_usuario
    FROM [config].[usuario_detalle] ud
    JOIN Nums ON Nums.n <= CASE
        WHEN ud.firma_subidas > 0 THEN ud.firma_subidas
        WHEN ud.firma_path IS NOT NULL AND LTRIM(RTRIM(ud.firma_path)) <> '' THEN 1
        ELSE 0
    END

    UNION ALL

    -- Habilitacion PENDIENTE (flag=1): va AL FINAL para que el estado
    -- derivado quede habilitado.
    SELECT
        ud.id_usuario,
        2,
        'habilitacion',
        ISNULL(ud.fecha_habilito_firma, GETUTCDATE()),
        ISNULL(ud.id_usuario_habilito_firma, 0)
    FROM [config].[usuario_detalle] ud
    WHERE ud.firma_cambio_habilitado = 1
)
UPDATE ud
SET firma_control = (
    SELECT e.accion AS accion,
           e.fecha AS fecha,
           e.idUsuario AS idUsuario
    FROM Eventos e
    WHERE e.id_usuario = ud.id_usuario
    ORDER BY e.orden
    FOR JSON PATH
)
FROM [config].[usuario_detalle] ud
WHERE ud.firma_control IS NULL
  AND EXISTS (SELECT 1 FROM Eventos e WHERE e.id_usuario = ud.id_usuario);

PRINT CONCAT('Migradas ', @@ROWCOUNT, ' filas a [firma_control]');
GO

PRINT 'Script 034 ejecutado correctamente';
GO
