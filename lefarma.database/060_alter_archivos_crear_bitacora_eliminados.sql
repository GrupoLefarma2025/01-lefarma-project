/*
    060_alter_archivos_crear_bitacora_eliminados.sql

    Bitácora de archivos eliminados o reemplazados (ticket Freshdesk #6987).
    Guarda el contexto del borrado y la ruta del binario conservado en la
    carpeta privada (private-media/eliminados). La fila es inmutable.

    No se ejecuta automáticamente: se revisa y aplica desde la Bandeja del
    panel «Explorador SQL». Sin GO para que el ejecutor lo reciba en un lote.
*/

SET XACT_ABORT ON;

IF OBJECT_ID(N'archivos.ArchivosEliminados', N'U') IS NULL
BEGIN
    CREATE TABLE archivos.ArchivosEliminados
    (
        Id                  int IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ArchivosEliminados PRIMARY KEY,
        IdArchivo           int               NOT NULL,
        EntidadTipo         nvarchar(100)     NOT NULL,
        EntidadId           int               NOT NULL,
        Carpeta             nvarchar(500)     NOT NULL,
        NombreOriginal      nvarchar(255)     NOT NULL,
        NombreFisico        nvarchar(255)     NOT NULL,
        Extension           nvarchar(20)      NOT NULL,
        TipoMime            nvarchar(100)     NOT NULL,
        TamanoBytes         bigint            NOT NULL,
        HashSha256          char(64)          NULL,
        RutaHistorica       nvarchar(400)     NULL,
        Metadata            nvarchar(max)     NULL,
        IdUsuarioSubio      int               NULL,
        FechaSubida         datetime2         NULL,
        IdUsuarioElimina    int               NULL,
        FechaEliminacion    datetime2         NOT NULL
            CONSTRAINT DF_ArchivosEliminados_FechaEliminacion DEFAULT (GETUTCDATE()),
        Motivo              nvarchar(20)      NOT NULL
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_ArchivosEliminados_IdArchivo'
      AND object_id = OBJECT_ID(N'archivos.ArchivosEliminados')
)
BEGIN
    CREATE INDEX IX_ArchivosEliminados_IdArchivo
        ON archivos.ArchivosEliminados (IdArchivo);
END;
