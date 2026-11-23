namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class HospitalExtension
{
    public int IdHospitalExtension { get; set; }
    public int IdHospital { get; set; }
    public DateTime? Fecha { get; set; }
    public int? IdTipoGerencia { get; set; }
    public int? IdRegion { get; set; }
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
    public bool? EsAlmacen { get; set; }
    public bool? EsFarmacia { get; set; }
    public bool? EsSedeTaller { get; set; }
    public bool MostrarEducacionMedica { get; set; }
    public string? MotivoClasificacion { get; set; }
    public bool RequiereRevision { get; set; }
    public bool ClasificacionManual { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
}
