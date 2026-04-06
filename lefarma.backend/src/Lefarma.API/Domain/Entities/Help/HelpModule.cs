namespace Lefarma.API.Domain.Entities.Help;
public class HelpModule
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Orden { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime FechaActualizacion { get; set; } = DateTime.UtcNow;
    public ICollection<HelpArticle> Articulos { get; set; } = [];
}
