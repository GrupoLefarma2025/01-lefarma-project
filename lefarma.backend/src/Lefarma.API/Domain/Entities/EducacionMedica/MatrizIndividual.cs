namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Matriz de talleres por equipo de pareo (EV+EP) y mes (FOR-005). EnCaptura -> Generada:
/// al generar se bloquea la captura del equipo; el GV puede reabrirla mientras la matriz
/// general siga en el paso inicial (ADR-00007).
/// </summary>
public class MatrizIndividual
{
    public const string EstadoEnCaptura = "EnCaptura";
    public const string EstadoGenerada = "Generada";

    public int IdMatrizIndividual { get; set; }
    public int IdEquipo { get; set; }
    public DateOnly Periodo { get; set; }   // primer día del mes
    public string Estado { get; set; } = EstadoEnCaptura;
    public DateTime? FechaGeneracion { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public virtual EquipoPareo? Equipo { get; set; }
    public virtual ICollection<Taller> Talleres { get; set; } = new List<Taller>();
}
