-- ============================================================================
-- LEFARMA - Control de cambios de firma en config.usuario_detalle
-- ============================================================================
-- Fecha: 2026-09-24
-- Descripcion: Agrega la columna JSON con el HISTORIAL DE EVENTOS de la firma:
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
--              Regla de negocio: solo la subida inicial es libre; cualquier
--              reemplazo o eliminacion requiere que RH habilite el cambio
--              (habilitacion de un solo uso).
--
--              Backfill: los usuarios que ya tienen firma (firma_path no vacio)
--              y no tienen historial reciben un evento "subida" con fecha
--              aproximada (fecha_modificacion). No depende de columnas previas:
--              funciona igual en una base nueva donde nunca existieron.
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
-- PASO 2: backfill de usuarios con firma registrada.
-- Idempotente: solo filas con firma_control IS NULL.
-- ----------------------------------------------------------------------------
UPDATE ud
SET firma_control = (
    SELECT
        'subida' AS accion,
        ISNULL(ud.fecha_modificacion, GETUTCDATE()) AS fecha,
        ud.id_usuario AS idUsuario
    FOR JSON PATH
)
FROM [config].[usuario_detalle] ud
WHERE ud.firma_control IS NULL
  AND ud.firma_path IS NOT NULL
  AND LTRIM(RTRIM(ud.firma_path)) <> '';

PRINT CONCAT('Backfill: ', @@ROWCOUNT, ' filas con evento inicial en [firma_control]');
GO

PRINT 'Script 027 ejecutado correctamente.';
GO
