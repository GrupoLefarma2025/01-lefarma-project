/*
    061_alter_archivos_bitacora_poblar_eliminados.sql

    Ticket Freshdesk #6987 — ADR 00003.

    1. Permite que la fecha de baja sea NULL: de los archivos eliminados antes
       de la bitácora no se conoce la fecha ni el usuario.
    2. Copia a la bitácora los metadatos de los archivos que ya están inactivos
       en archivos.Archivos (usuario y fecha de subida reales; sin usuario ni
       fecha de eliminación). No mueve binarios: los antiguos siguen como
       `_inactivo` en la carpeta pública y se resuelven por la ruta de respaldo.

    Idempotente: el ALTER solo corre si la columna no admite NULL y el INSERT
    omite los archivos que ya tienen fila en la bitácora.
    No se ejecuta automáticamente: se revisa y aplica desde la Bandeja del
    panel «Explorador SQL».
*/

SET XACT_ABORT ON;

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'archivos.ArchivosEliminados')
      AND name = N'FechaEliminacion'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE archivos.ArchivosEliminados
        ALTER COLUMN FechaEliminacion datetime2 NULL;
END;

INSERT INTO archivos.ArchivosEliminados
    (IdArchivo, EntidadTipo, EntidadId, Carpeta, NombreOriginal, NombreFisico,
     Extension, TipoMime, TamanoBytes, HashSha256, RutaHistorica, Metadata,
     IdUsuarioSubio, FechaSubida, IdUsuarioElimina, FechaEliminacion, Motivo)
SELECT
    a.Id, a.EntidadTipo, a.EntidadId, a.Carpeta, a.NombreOriginal, a.NombreFisico,
    a.Extension, a.TipoMime, a.TamanoBytes, NULL, NULL, a.Metadata,
    a.UsuarioId, a.FechaCreacion, NULL, NULL, N'Eliminacion'
FROM archivos.Archivos AS a
WHERE a.Activo = 0
  AND NOT EXISTS (
      SELECT 1
      FROM archivos.ArchivosEliminados AS e
      WHERE e.IdArchivo = a.Id
  );
