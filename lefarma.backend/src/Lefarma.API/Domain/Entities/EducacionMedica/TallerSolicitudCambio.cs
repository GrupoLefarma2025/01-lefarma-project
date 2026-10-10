namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Solicitud de cambio del equipo sobre un taller bloqueado o fuera de captura
/// (ADR-00010, decisiones 13-15). El cambio (valores antes/después, motivos y actores) va
/// en datos_json; el CEM la resuelve desde la Matriz General. Al aprobar se aplica la
/// misma lógica del ajuste post-cierre.
/// </summary>
public class TallerSolicitudCambio
{
    public const string EstadoPendiente = "Pendiente";
    public const string EstadoAprobada = "Aprobada";
    public const string EstadoRechazada = "Rechazada";
    public const string EstadoCancelada = "Cancelada";

    public static readonly string[] EstadosValidos =
        [EstadoPendiente, EstadoAprobada, EstadoRechazada, EstadoCancelada];

    public int IdSolicitud { get; set; }
    public int IdTaller { get; set; }
    public string Estado { get; set; } = EstadoPendiente;
    public string? DatosJson { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public virtual Taller? Taller { get; set; }
}
