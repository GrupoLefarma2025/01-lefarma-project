namespace Lefarma.API.Features.Archivos.Notifications;

public sealed record ArchivoEliminadoEvento(
    int IdArchivo,
    string EntidadTipo,
    int EntidadId,
    string Carpeta,
    string NombreOriginal,
    string Extension,
    long TamanoBytes,
    string? Metadata,
    DateTime FechaCreacion,
    int? IdUsuarioSubio,
    int? IdUsuarioElimina,
    DateTime FechaEliminacion);
