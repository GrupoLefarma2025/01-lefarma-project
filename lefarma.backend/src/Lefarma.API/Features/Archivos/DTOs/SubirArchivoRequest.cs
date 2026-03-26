using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.Archivos.DTOs;

public record SubirArchivoRequest
{
    [Required]
    public string EntidadTipo { get; init; } = string.Empty;

    [Required]
    public int EntidadId { get; init; }

    [Required]
    public string Carpeta { get; init; } = string.Empty;

    public string? Metadata { get; init; }
}
