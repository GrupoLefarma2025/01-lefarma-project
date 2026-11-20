namespace Lefarma.API.Domain.Entities.Telemetria;

/// <summary>
/// Lote de telemetría ya aplicado. Es la llave de idempotencia: si el navegador
/// reenvía un lote porque no recibió el 202, aquí se detecta y no se duplica.
/// </summary>
public class LoteTelemetriaProcesado
{
    public string LoteId { get; set; } = string.Empty;
    public DateTime RecibidoEn { get; set; }
}
