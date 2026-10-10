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
    /// <summary>Contacto logístico tipo almacén (delegacional/subdelegacional, sub-almacén, BIRMEX).</summary>
    public bool? EsAlmacen { get; set; }
    /// <summary>Contacto logístico tipo farmacia.</summary>
    public bool? EsFarmacia { get; set; }
    /// <summary>1 = seleccionable como sede de taller; 0 = contacto logístico; NULL = sin clasificar (no se excluye).</summary>
    public bool? EsSedeTaller { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
}
