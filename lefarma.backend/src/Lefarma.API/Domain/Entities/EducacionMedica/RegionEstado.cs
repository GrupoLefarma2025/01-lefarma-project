namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Mapeo editable estado -> región (educacion_medica.regiones_estados).
/// codigo_estado es FK lógica -> Asokam.genEstadosCat (mismo servidor).
/// </summary>
public class RegionEstado
{
    public int IdRegionEstado { get; set; }
    public int CodigoEstado { get; set; }
    public int IdRegion { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public RegionCatalogo? Region { get; set; }
}
