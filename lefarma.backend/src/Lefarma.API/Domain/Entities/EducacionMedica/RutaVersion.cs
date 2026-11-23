namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class RutaVersion
{
    public const string EstadoCreada = "Creada";
    public const string EstadoCerrada = "Cerrada";
    public const string EstadoRechazada = "Rechazada";
    public const string EstadoCancelada = "Cancelada";
    public const string EstadoArchivada = "Archivada";

    public int IdRutaVersion { get; set; }
    public int IdSeleccionMensual { get; set; }
    public int Version { get; set; }
    public int? IdTipoGerencia { get; set; }   
    public string Estado { get; set; } = EstadoCreada;
    public DateTime? FechaConfirmacion { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public virtual ICollection<Ruta> Rutas { get; set; } = new List<Ruta>();
}
