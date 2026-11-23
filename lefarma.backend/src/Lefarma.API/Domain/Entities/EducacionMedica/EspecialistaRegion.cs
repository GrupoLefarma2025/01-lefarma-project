namespace Lefarma.API.Domain.Entities.EducacionMedica;

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
