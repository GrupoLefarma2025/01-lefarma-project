namespace Lefarma.API.Domain.Entities.Telemetria;

/// <summary>
/// Parámetros internos del módulo que deben sobrevivir entre reinicios; hoy
/// guarda la sal con la que se calcula la huella del usuario.
/// </summary>
public class ParametroTelemetria
{
    public string Clave { get; set; } = string.Empty;
    public string Valor { get; set; } = string.Empty;
    public DateTime ActualizadoEn { get; set; }
}
