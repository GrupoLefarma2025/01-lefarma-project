using Lefarma.API.Shared.Logging;

namespace Lefarma.API.Domain.Interfaces.Logging;
public interface IErrorLogService
{
    Task<Guid?> LogErrorAsync(WideEvent wideEvent, Exception? exception = null, CancellationToken cancellationToken = default);
}
