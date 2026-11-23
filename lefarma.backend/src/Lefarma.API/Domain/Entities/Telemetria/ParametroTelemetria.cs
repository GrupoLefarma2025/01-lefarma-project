namespace Lefarma.API.Domain.Entities.Telemetria;

public class ParametroTelemetria
{
    public string Clave { get; set; } = string.Empty;
    public string Valor { get; set; } = string.Empty;
    public DateTime ActualizadoEn { get; set; }
}
