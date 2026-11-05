namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Región preferida de un especialista (opcional; ADR-00015). Solo alimenta
/// la sugerencia de visitas cercanas; no es una restricción.
/// </summary>
public class EspecialistaRegion
{
    public int IdEspecialistaRegion { get; set; }
    public int IdUsuario { get; set; }
    public int IdRegionCatalogo { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public RegionCatalogo? Region { get; set; }
}
