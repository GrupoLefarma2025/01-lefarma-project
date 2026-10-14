namespace Lefarma.API.Features.Viaticos.DTOs;

public class MunicipioDto
{
    public int IdMunicipio { get; set; }
    public int CodigoEstado { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? ClaveMunicipio { get; set; }
    public double? Latitud { get; set; }
    public double? Longitud { get; set; }
}
