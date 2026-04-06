using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Lefarma.API.Features.Auth.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.Auth;
public class SseService : ISseService
{
    private readonly ConcurrentDictionary<int, HttpResponse> _connections = new();
    private readonly ILogger<SseService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public SseService(ILogger<SseService> logger)
    {
        _logger = logger;
    }

    public async Task RegisterConnectionAsync(int userId, HttpResponse response, CancellationToken cancellationToken = default)
    {
        // Headers are already set by the controller, don't try to set them again
        _connections[userId] = response;
        _logger.LogInformation("SSE connection registered for user {UserId}. Active connections: {Count}",
            userId, _connections.Count);

        await SendConnectedEventAsync(response, cancellationToken);

        var heartbeatInterval = TimeSpan.FromSeconds(30);
        using var heartbeatTimer = new PeriodicTimer(heartbeatInterval);

        try
        {
            while (await heartbeatTimer.WaitForNextTickAsync(cancellationToken))
            {
                await SendHeartbeatAsync(response, cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogDebug("SSE connection cancelled for user {UserId}", userId);
        }
        finally
        {
            UnregisterConnection(userId);
        }
    }

    public void UnregisterConnection(int userId)
    {
        if (_connections.TryRemove(userId, out _))
        {
            _logger.LogInformation("SSE connection removed for user {UserId}. Active connections: {Count}", 
                userId, _connections.Count);
        }
    }

    public async Task NotifyUserUpdateAsync(int userId, string updateType, UserInfo userData, CancellationToken cancellationToken = default)
    {
        if (!_connections.TryGetValue(userId, out var response))
        {
            _logger.LogDebug("No active SSE connection for user {UserId}", userId);
            return;
        }

        var eventData = new
        {
            Type = updateType,
            User = userData
        };

        await SendEventAsync(response, "user.updated", eventData, cancellationToken);
        _logger.LogInformation("Sent {UpdateType} update to user {UserId}", updateType, userId);
    }

    public int GetActiveConnectionsCount() => _connections.Count;

    public bool IsUserConnected(int userId) => _connections.ContainsKey(userId);

    public async Task NotifyAsync(int userId, string eventType, object data, CancellationToken cancellationToken = default)
    {
        _logger.LogDebug("Attempting to send {EventType} event to user {UserId}. Active connections: {ConnectionCount}",
            eventType, userId, _connections.Count);

        if (!_connections.TryGetValue(userId, out var response))
        {
            _logger.LogWarning("No active SSE connection for user {UserId}. Active users: {ActiveUsers}",
                userId, string.Join(", ", _connections.Keys));
            return;
        }

        try
        {
            await SendEventAsync(response, eventType, data, cancellationToken);
            _logger.LogInformation("✅ Sent {EventType} event to user {UserId}", eventType, userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending SSE event to user {UserId}", userId);
        }
    }

    private async Task SendConnectedEventAsync(HttpResponse response, CancellationToken cancellationToken)
    {
        await SendEventAsync(response, "connected", new { timestamp = DateTime.UtcNow }, cancellationToken);
    }

    private async Task SendHeartbeatAsync(HttpResponse response, CancellationToken cancellationToken)
    {
        await response.WriteAsync(": heartbeat\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    private async Task SendEventAsync<T>(HttpResponse response, string eventType, T data, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(data, JsonOptions);
        var message = $"event: {eventType}\ndata: {json}\n\n";
        await response.WriteAsync(message, Encoding.UTF8, cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }
}
