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
    /// <summary>Contacto logístico tipo almacén (no sede de taller).</summary>
    public bool? EsAlmacen { get; set; }
    /// <summary>Contacto logístico tipo farmacia.</summary>
    public bool? EsFarmacia { get; set; }
    /// <summary>1 = sede de taller seleccionable; 0 = contacto logístico; NULL = sin clasificar.</summary>
    public bool? EsSedeTaller { get; set; }
}
