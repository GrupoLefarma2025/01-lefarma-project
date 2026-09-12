namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class Ruta
{
    public const string EstadoDraft = "Draft";
    public const string EstadoConfirmada = "Confirmada";
    public const string EstadoCancelada = "Cancelada";
    public const string EstadoArchivada = "Archivada";

    public int IdRuta { get; set; }
    public int IdSeleccionMensual { get; set; }
    public int IdEquipo { get; set; }
    public int Version { get; set; }
    public string? Nombre { get; set; }
    public string Estado { get; set; } = EstadoDraft;
    public DateTime? FechaConfirmacion { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
}
