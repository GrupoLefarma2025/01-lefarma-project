using Lefarma.API.Shared.Logging;

namespace Lefarma.API.Domain.Interfaces.Logging;

/// <summary>
/// Servicio para persistir auditoría de operaciones de negocio en base de datos.
/// Se invoca automáticamente desde el middleware para cada operación mutante exitosa.
/// </summary>
public interface IBusinessAuditLogService
{
    /// <summary>
    /// Guarda un registro de auditoría de negocio a partir del WideEvent del request.
    /// </summary>
    Task LogAsync(WideEvent wideEvent, CancellationToken cancellationToken = default);
}
