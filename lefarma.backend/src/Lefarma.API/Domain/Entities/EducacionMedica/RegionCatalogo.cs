namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Catálogo maestro de regiones (macro, estable) para la segmentación
/// logística de hospitales (educacion_medica.regiones_cat). Editable.
/// </summary>
public class RegionCatalogo
{
    public int IdRegion { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public decimal? CentroLatitud { get; set; }
    public decimal? CentroLongitud { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
}
