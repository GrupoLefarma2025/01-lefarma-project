namespace Lefarma.API.Features.Archivos.DTOs;
public record ArchivoListItemResponse(
    int Id,
    string NombreOriginal,
    string Extension,
    string TipoMime,
    long TamanoBytes,
    string? Metadata,
    DateTime FechaCreacion,
    int? UsuarioId,
    string? UsuarioSubioNombre,
    bool Activo,
    DateTime? FechaEliminacion = null,
    string? UsuarioEliminoNombre = null,
    string? MotivoBaja = null
);
