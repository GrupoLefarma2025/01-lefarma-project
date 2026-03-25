namespace Lefarma.API.Features.Help.DTOs;

/// <summary>
/// DTO para representar un artículo de ayuda completo
/// </summary>
public record HelpArticleDto
{
    public int Id { get; init; }
    public string Titulo { get; init; } = string.Empty;
    public string Contenido { get; init; } = string.Empty;
    public string? Resumen { get; init; }
    public string Modulo { get; init; } = string.Empty;
    public string Tipo { get; init; } = string.Empty;
    public string? Categoria { get; init; }
    public int Orden { get; init; }
    public bool Activo { get; init; }
    public DateTime FechaCreacion { get; init; }
    public DateTime FechaActualizacion { get; init; }
    public string? CreadoPor { get; init; }
    public string? ActualizadoPor { get; init; }
}
