namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class HospitalExtensionDto
{
    public int IdHospitalExtension { get; set; }
    public int IdHospital { get; set; }
    public DateTime? Fecha { get; set; }
    public int? IdTipoGerencia { get; set; }
    public string? TipoGerencia { get; set; }
    public int? IdRegion { get; set; }
    public string? RegionNombre { get; set; }
    public bool? ConSia { get; set; }
    public int? NumeroQuirofanos { get; set; }
    public bool? EsZonaMetropolitana { get; set; }
    public decimal? AnestesiasTotales { get; set; }
    public decimal? AnestesiasGenerales { get; set; }
    public decimal? AnestesiasRegionales { get; set; }
    public decimal? AnestesiasEpidurales { get; set; }
    public decimal? AnestesiasSubdurales { get; set; }
    public decimal? AnestesiasMixtasObesos { get; set; }
    public decimal? AnestesiasMixtasNoObesos { get; set; }
}
