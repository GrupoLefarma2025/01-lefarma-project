namespace Lefarma.API.Domain.Entities.Viaticos;

public class Municipio
{
    public int IdMunicipio { get; set; }
    public int CodigoEstado { get; set; }
    public string Nombre { get; set; } = string.Empty;

    public string? ClaveMunicipio { get; set; }

    public double? Latitud { get; set; }
    public double? Longitud { get; set; }

    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
}