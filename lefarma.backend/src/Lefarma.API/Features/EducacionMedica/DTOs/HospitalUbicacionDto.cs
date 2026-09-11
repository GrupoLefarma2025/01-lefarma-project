namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class HospitalUbicacionDto
{
    public int CodigoContacto { get; set; }
    public string NombreContacto { get; set; } = string.Empty;
    public string? NombreCorto { get; set; }
    public string? Clues { get; set; }
    public string? Ciudad { get; set; }
    public string? CodigoEstado { get; set; }
    public decimal? Latitud { get; set; }
    public decimal? Longitud { get; set; }
    public int? IdRegion { get; set; }
    public string? RegionNombre { get; set; }
}
