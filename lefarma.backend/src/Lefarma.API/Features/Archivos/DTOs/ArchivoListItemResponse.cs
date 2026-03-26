namespace Lefarma.API.Features.Archivos.DTOs;

public record ArchivoListItemResponse(
    int Id,
    string NombreOriginal,
    string Extension,
    string TipoMime,
    long TamanoBytes,
    DateTime FechaCreacion,
    bool Activo
);
