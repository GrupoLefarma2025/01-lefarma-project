namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Matriz de talleres por ejecutivo y mes (FOR-005, ADR-00015). La captura se
/// bloquea al generarla (es_bloqueado = 1) y el GV puede reabrirla (es_bloqueado = 0)
/// mientras la matriz general siga en el paso inicial (ADR-00007).
/// </summary>
public class MatrizIndividual
{
    public int IdMatrizIndividual { get; set; }
    /// <summary>Legacy (ADR-00015): equipo de pareo del modelo anterior.</summary>
    public int? IdEquipo { get; set; }
    /// <summary>Ejecutivo dueño de la matriz individual.</summary>
    public int? IdEjecutivo { get; set; }
    public DateOnly Periodo { get; set; }   // primer día del mes
    /// <summary>0 = captura abierta; 1 = captura bloqueada (generada por el ejecutivo).</summary>
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
