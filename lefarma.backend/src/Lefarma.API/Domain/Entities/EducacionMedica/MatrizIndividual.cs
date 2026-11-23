namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class MatrizIndividual
{
    public int IdMatrizIndividual { get; set; }
    public int? IdEquipo { get; set; }
    public int? IdEjecutivo { get; set; }
    public DateOnly Periodo { get; set; }   
    public bool EsBloqueado { get; set; }
    public DateTime? FechaBloqueo { get; set; }
    public DateTime? FechaDesbloqueo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public virtual EquipoPareo? Equipo { get; set; }
    public virtual ICollection<Taller> Talleres { get; set; } = new List<Taller>();
}
