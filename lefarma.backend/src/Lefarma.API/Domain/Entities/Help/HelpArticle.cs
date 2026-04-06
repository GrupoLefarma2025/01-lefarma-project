namespace Lefarma.API.Domain.Entities.Help;
public class HelpArticle
{
    public int Id { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Contenido { get; set; } = string.Empty;
    public string? Resumen { get; set; }
    public int? ModuloId { get; set; }
    public string Modulo { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public int Orden { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime FechaActualizacion { get; set; } = DateTime.UtcNow;
    public string? CreadoPor { get; set; }
    public string? ActualizadoPor { get; set; }
    public HelpModule? ModuloNavigation { get; set; }
}
