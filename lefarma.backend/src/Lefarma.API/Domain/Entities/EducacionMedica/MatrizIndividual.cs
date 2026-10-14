namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Matriz de talleres por equipo de pareo (EV+EP) y mes (FOR-005). La captura se
/// bloquea al generarla (es_bloqueado = 1) y el GV puede reabrirla (es_bloqueado = 0)
/// mientras la matriz general siga en el paso inicial (ADR-00007).
/// </summary>
public class MatrizIndividual
{
    public int IdMatrizIndividual { get; set; }
    public int IdEquipo { get; set; }
    public DateOnly Periodo { get; set; }   // primer día del mes
    /// <summary>0 = captura abierta; 1 = captura bloqueada (generada por el equipo).</summary>
    public bool EsBloqueado { get; set; }
    /// <summary>Último bloqueo de la captura (UTC).</summary>
    public DateTime? FechaBloqueo { get; set; }
    /// <summary>Última reapertura de la captura por el GV (UTC).</summary>
    public DateTime? FechaDesbloqueo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public virtual EquipoPareo? Equipo { get; set; }
    public virtual ICollection<Taller> Talleres { get; set; } = new List<Taller>();
}
