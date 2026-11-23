using Lefarma.API.Shared.Logging;

namespace Lefarma.API.Domain.Interfaces.Logging;

public interface IBusinessAuditLogService
{
    Task LogAsync(WideEvent wideEvent, CancellationToken cancellationToken = default);
}
