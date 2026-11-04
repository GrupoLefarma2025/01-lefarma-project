using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Lefarma.API.Features.Auth.DTOs;

namespace Lefarma.API.Features.Auth;

/// <summary>
/// Servicio SSE con soporte para múltiples conexiones simultáneas por usuario
/// (varias pestañas o equipos). La escritura de cada conexión está serializada y
/// las conexiones muertas se eliminan sin bloquear al resto de los clientes.
/// </summary>
public class SseService : ISseService
{
    private const int HeartbeatSegundos = 30;
    private static readonly TimeSpan EscrituraTimeout = TimeSpan.FromSeconds(10);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly ConcurrentDictionary<int, ConcurrentDictionary<Guid, SseConnection>> _connections = new();
    private readonly ILogger<SseService> _logger;

    public SseService(ILogger<SseService> logger)
    {
        _logger = logger;
    }

    public async Task RegisterConnectionAsync(
        int userId,
        HttpResponse response,
        CancellationToken cancellationToken = default)
    {
        // Headers are already set by the controller, don't try to set them again
        var connection = new SseConnection(userId, response);

        while (true)
        {
            var delUsuario = _connections.GetOrAdd(userId, _ => new ConcurrentDictionary<Guid, SseConnection>());
            delUsuario[connection.Id] = connection;

            if (_connections.TryGetValue(userId, out var registrado) && ReferenceEquals(registrado, delUsuario))
            {
                break;
            }
        }

        _logger.LogInformation(
            "SSE connection {ConnectionId} registered for user {UserId}. Active connections: {Count}",
            connection.Id,
            userId,
            ContarConexiones());

        try
        {
            await EscribirAsync(
                connection,
                FormatearEvento("connected", JsonSerializer.Serialize(new { timestamp = DateTime.UtcNow }, JsonOptions)),
                cancellationToken);

            using var heartbeatTimer = new PeriodicTimer(TimeSpan.FromSeconds(HeartbeatSegundos));

            while (await heartbeatTimer.WaitForNextTickAsync(cancellationToken))
            {
                await EscribirAsync(connection, ": heartbeat\n\n", cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogDebug("SSE connection {ConnectionId} cancelled for user {UserId}", connection.Id, userId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "SSE connection {ConnectionId} for user {UserId} ended with an error",
                connection.Id,
                userId);
        }
        finally
        {
            QuitarConexion(userId, connection.Id);
        }
    }

    public void UnregisterConnection(int userId)
    {
        if (_connections.TryRemove(userId, out var conexiones))
        {
            _logger.LogInformation(
                "Removed {Count} SSE connection(s) for user {UserId}. Active connections: {Total}",
                conexiones.Count,
                userId,
                ContarConexiones());
        }
    }

    public async Task NotifyUserUpdateAsync(
        int userId,
        string updateType,
        UserInfo userData,
        CancellationToken cancellationToken = default)
    {
        await EnviarAUsuarioAsync(
            userId,
            "user.updated",
            new { Type = updateType, User = userData },
            cancellationToken);
    }

    public async Task NotifyAsync(
        int userId,
        string eventType,
        object data,
        CancellationToken cancellationToken = default)
    {
        await EnviarAUsuarioAsync(userId, eventType, data, cancellationToken);
    }

    public async Task BroadcastAsync(
        string eventType,
        object data,
        CancellationToken cancellationToken = default)
    {
        var conexiones = ObtenerConexiones();

        if (conexiones.Count == 0)
        {
            return;
        }

        var mensaje = FormatearEvento(eventType, JsonSerializer.Serialize(data, JsonOptions));

        _logger.LogDebug(
            "Broadcasting SSE event {EventType} to {Count} connection(s)",
            eventType,
            conexiones.Count);

        await EntregarAsync(conexiones, mensaje, cancellationToken);
    }

    public int GetActiveConnectionsCount() => ContarConexiones();

    public bool IsUserConnected(int userId)
        => _connections.TryGetValue(userId, out var conexiones) && !conexiones.IsEmpty;

    // ---------------------------------------------------------------- internos

    private async Task EnviarAUsuarioAsync(
        int userId,
        string eventType,
        object data,
        CancellationToken cancellationToken)
    {
        if (!_connections.TryGetValue(userId, out var conexiones) || conexiones.IsEmpty)
        {
            _logger.LogDebug("No active SSE connection for user {UserId}", userId);
            return;
        }

        var mensaje = FormatearEvento(eventType, JsonSerializer.Serialize(data, JsonOptions));
        var activas = conexiones.Values.ToList();

        await EntregarAsync(activas, mensaje, cancellationToken);

        _logger.LogInformation(
            "Sent {EventType} event to user {UserId} ({Count} connection(s))",
            eventType,
            userId,
            activas.Count);
    }

    private async Task EntregarAsync(
        IReadOnlyCollection<SseConnection> conexiones,
        string mensaje,
        CancellationToken cancellationToken)
    {
        try
        {
            // Cada conexión se atiende en paralelo con su propio timeout: una conexión
            // lenta o muerta no bloquea ni retrasa a las demás.
            await Task.WhenAll(conexiones.Select(c => EntregarAAsync(c, mensaje, cancellationToken)));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error delivering SSE event to one or more connections");
        }
    }

    private async Task EntregarAAsync(
        SseConnection conexion,
        string mensaje,
        CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(EscrituraTimeout);

        try
        {
            await EscribirAsync(conexion, mensaje, timeout.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Timed out writing SSE event to connection {ConnectionId} (user {UserId}); dropping connection",
                conexion.Id,
                conexion.UserId);

            QuitarConexion(conexion.UserId, conexion.Id);
        }
        catch (OperationCanceledException)
        {
            // Cancelación del request global: no se considera una conexión muerta.
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Error writing SSE event to connection {ConnectionId} (user {UserId}); dropping connection",
                conexion.Id,
                conexion.UserId);

            QuitarConexion(conexion.UserId, conexion.Id);
        }
    }

    private static async Task EscribirAsync(
        SseConnection conexion,
        string contenido,
        CancellationToken cancellationToken)
    {
        // Serializa la escritura para que los frames SSE nunca se entremezclen
        // entre el heartbeat y los eventos.
        await conexion.Lock.WaitAsync(cancellationToken);

        try
        {
            await conexion.Response.WriteAsync(contenido, Encoding.UTF8, cancellationToken);
            await conexion.Response.Body.FlushAsync(cancellationToken);
        }
        finally
        {
            conexion.Lock.Release();
        }
    }

    private void QuitarConexion(int userId, Guid connectionId)
    {
        if (!_connections.TryGetValue(userId, out var conexiones))
        {
            return;
        }

        if (conexiones.TryRemove(connectionId, out _))
        {
            _logger.LogInformation(
                "SSE connection {ConnectionId} removed for user {UserId}. Active connections: {Count}",
                connectionId,
                userId,
                ContarConexiones());
        }

        if (!conexiones.IsEmpty)
        {
            return;
        }

        var par = new KeyValuePair<int, ConcurrentDictionary<Guid, SseConnection>>(userId, conexiones);

        // Solo se elimina el cubo si sigue siendo el registrado. Si una conexión
        // nueva entró justo en medio, se vuelve a registrar para no perderla.
        if (_connections.TryRemove(par) && !conexiones.IsEmpty)
        {
            _connections.TryAdd(userId, conexiones);
        }
    }

    private List<SseConnection> ObtenerConexiones()
        => _connections.Values.SelectMany(c => c.Values).ToList();

    private int ContarConexiones() => _connections.Values.Sum(c => c.Count);

    private static string FormatearEvento(string eventType, string json)
        => $"event: {eventType}\ndata: {json}\n\n";

    /// <summary>Conexión SSE individual con escritura serializada.</summary>
    private sealed class SseConnection
    {
        public SseConnection(int userId, HttpResponse response)
        {
            UserId = userId;
            Response = response;
        }

        public Guid Id { get; } = Guid.NewGuid();

        public int UserId { get; }

        public HttpResponse Response { get; }

        public SemaphoreSlim Lock { get; } = new(1, 1);
    }
}
