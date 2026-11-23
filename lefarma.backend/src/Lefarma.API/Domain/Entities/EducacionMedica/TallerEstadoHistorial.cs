namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class TallerEstadoHistorial
{
    public const string OrigenAutomatico = "Automatico";
    public const string OrigenManual = "Manual";

    public int IdHistorial { get; set; }
    public int IdTaller { get; set; }
    public string? EstadoAnterior { get; set; }
    public string EstadoNuevo { get; set; } = string.Empty;
    public string Origen { get; set; } = OrigenManual;
    public string? Motivo { get; set; }
    public int? IdUsuario { get; set; }
    public DateTime Fecha { get; set; }
    public string? DatosJson { get; set; }

    public virtual Taller? Taller { get; set; }
}
