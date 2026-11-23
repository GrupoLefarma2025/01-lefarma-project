namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class RegionEstado
{
    public int IdRegionEstado { get; set; }
    public int CodigoEstado { get; set; }
    public int IdRegion { get; set; }
    public int IdTipoGerencia { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public RegionCatalogo? Region { get; set; }
}
