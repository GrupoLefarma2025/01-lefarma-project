using Lefarma.API.Shared.Logging;

namespace Lefarma.API.Domain.Interfaces.Logging;
/// <summary>
/// Servicio para persistir errores en base de datos
/// </summary>
public interface IErrorLogService
{
    /// <summary>
    /// Guarda un error en la base de datos a partir de un WideEvent y opcionalmente una Exception
    /// </summary>
    /// <param name="wideEvent">Evento con contexto de la petición</param>
    /// <param name="exception">Excepción capturada (opcional, puede ser null para errores HTTP sin excepción)</param>
    /// <param name="cancellationToken">Token de cancelación</param>
    /// <returns>Guid del error guardado, o null si falla</returns>
    Task<Guid?> LogErrorAsync(WideEvent wideEvent, Exception? exception = null, CancellationToken cancellationToken = default);
}
