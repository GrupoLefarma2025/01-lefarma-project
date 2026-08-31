namespace Lefarma.API.Domain.Entities.Rh;

public class IncidenciaChecadoNotificacionHistorial
{
    public int Id { get; set; }
    public int? NotificationId { get; set; }
    public long Nomina { get; set; }
    public string? Nombre { get; set; }
    public string? Periodo { get; set; }
    public DateTime? FechaInicio { get; set; }
    public DateTime? FechaFin { get; set; }
    public string? Asunto { get; set; }
    public string? Mensaje { get; set; }
    public string? Canales { get; set; }
    public bool Exitoso { get; set; }
    public string? Error { get; set; }
    public int? EnviadoPor { get; set; }
    public DateTime FechaEnvio { get; set; }
}
