using Lefarma.API.Features.Auth.DTOs;

namespace Lefarma.API.Features.Auth;

public interface ISseService
{
    Task RegisterConnectionAsync(int userId, HttpResponse response, CancellationToken cancellationToken = default);
    void UnregisterConnection(int userId);
    Task NotifyUserUpdateAsync(int userId, string updateType, UserInfo userData, CancellationToken cancellationToken = default);
    Task NotifyAsync(int userId, string eventType, object data, CancellationToken cancellationToken = default);

    /// <summary>Envía un evento a todas las conexiones SSE activas (todas las pestañas y equipos).</summary>
    Task BroadcastAsync(string eventType, object data, CancellationToken cancellationToken = default);

    int GetActiveConnectionsCount();
    bool IsUserConnected(int userId);
}
