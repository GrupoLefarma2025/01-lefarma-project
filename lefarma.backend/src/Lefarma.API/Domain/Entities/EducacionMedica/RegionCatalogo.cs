namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class RegionCatalogo
{
    public int IdRegion { get; set; }
    public int IdTipoGerencia { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public decimal? CentroLatitud { get; set; }
    public decimal? CentroLongitud { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
}
