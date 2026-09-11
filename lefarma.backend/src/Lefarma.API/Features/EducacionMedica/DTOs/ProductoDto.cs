namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class ProductoDto
{
    public int CodigoProducto { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? DescripcionCorta { get; set; }
    public string? Tipo { get; set; }
    public string? TipoAsokam { get; set; }
    public string? MarcaIMSS { get; set; }
}
