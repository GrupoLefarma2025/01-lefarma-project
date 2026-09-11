namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class HospitalDto
{
    public int CodigoContacto { get; set; }
    public string NombreContacto { get; set; } = string.Empty;
    public string? NombreCorto { get; set; }
    public string? Clues { get; set; }
    public string? Ciudad { get; set; }
    public string? CodigoEstado { get; set; }
    public byte? Activo { get; set; }
    public int? CodigoContactoPrincipal { get; set; }
    public string? Institucion { get; set; }
    public decimal? Latitud { get; set; }
    public decimal? Longitud { get; set; }
    public bool EsInstitucion { get; set; }
    public HospitalExtensionDto? Extension { get; set; }
}
