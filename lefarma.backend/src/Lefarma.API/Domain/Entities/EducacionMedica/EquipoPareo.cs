namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class EquipoPareo
{
    public int IdEquipo { get; set; }
    public int IdRegion { get; set; }
    public int IdEjecutivo { get; set; }
    public int IdEspecialista { get; set; }
    public DateOnly FechaInicio { get; set; }
    public DateOnly? FechaFin { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public RegionCatalogo? Region { get; set; }
}
