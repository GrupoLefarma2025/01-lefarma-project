namespace Lefarma.API.Features.Archivos.DTOs;

public record ArchivoResponse(
    int Id,
    string EntidadTipo,
    int EntidadId,
    string Carpeta,
    string NombreOriginal,
    string NombreFisico,
    string Extension,
    string TipoMime,
    long TamanoBytes,
    string? Metadata,
    DateTime FechaCreacion,
    DateTime? FechaEdicion,
    int? UsuarioId,
    bool Activo
);
