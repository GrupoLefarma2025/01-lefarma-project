using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Lefarma.API.Features.Auth;
using System.Security.Claims;

namespace Lefarma.API.Features.Notifications.Controllers;

/// <summary>
/// Controller for Server-Sent Events (SSE) streaming of real-time notifications.
/// Maintains persistent connections with clients for instant notification delivery.
/// </summary>
[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationStreamController : ControllerBase
{
    private readonly ISseService _sseService;
    private readonly ILogger<NotificationStreamController> _logger;

    public NotificationStreamController(
        ISseService sseService,
        ILogger<NotificationStreamController> logger)
    {
        _sseService = sseService ?? throw new ArgumentNullException(nameof(sseService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Establishes a Server-Sent Events (SSE) stream for real-time notifications.
    /// This endpoint maintains a persistent connection and pushes notifications as they arrive.
    ///
    /// The connection remains open until:
    /// - The client disconnects
    /// - The server shuts down
    /// - An error occurs
    ///
    /// Expected SSE events:
    /// - notification.received: New notification delivered
    /// - notification.read: Notification marked as read
    /// - keepalive: Periodic keep-alive signal
    /// </summary>
    /// <param name="ct">Cancellation token for the connection</param>
    /// <returns>Stream of SSE events</returns>
    /// <response code="200">SSE connection established successfully</response>
    /// <response code="401">User not authenticated</response>
    /// <response code="500">Internal server error</response>
    [HttpGet("stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task GetStream(CancellationToken ct)
    {
        try
        {
            // Extract user ID from claims
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userIdClaimAlt = User.FindFirstValue("userId"); // Alternative claim name

            if (string.IsNullOrWhiteSpace(userIdClaim) && string.IsNullOrWhiteSpace(userIdClaimAlt))
            {
                _logger.LogWarning("SSE connection attempted without valid user ID claim");
                Response.StatusCode = StatusCodes.Status401Unauthorized;
                await Response.WriteAsync("Unauthorized: No valid user ID found");
                return;
            }

            var userIdStr = userIdClaim ?? userIdClaimAlt!;
            if (!int.TryParse(userIdStr, out var userId))
            {
                _logger.LogWarning("SSE connection attempted with invalid user ID format: {UserIdStr}", userIdStr);
                Response.StatusCode = StatusCodes.Status401Unauthorized;
                await Response.WriteAsync("Unauthorized: Invalid user ID format");
                return;
            }

            _logger.LogInformation(
                "GET /api/notifications/stream - Establishing SSE connection for user {UserId}",
                userId);

            // Set SSE headers
            Response.Headers.Append("Content-Type", "text/event-stream");
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");
            Response.Headers.Append("X-Accel-Buffering", "no"); // Disable Nginx buffering

            // Send initial connection event
            await SendSseEventAsync("connection.established", new
            {
                userId,
                timestamp = DateTime.UtcNow,
                message = "SSE connection established successfully"
            }, ct);

            // Register the connection with the SSE service
            // This will block and send events as they arrive
            await _sseService.RegisterConnectionAsync(userId, Response, ct);

            _logger.LogInformation(
                "SSE connection closed for user {UserId}",
                userId);
        }
        catch (OperationCanceledException)
        {
            // Normal cancellation when client disconnects
            _logger.LogInformation("SSE connection cancelled (client disconnect)");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in SSE stream");
            try
            {
                if (!Response.HasStarted)
                {
                    Response.StatusCode = StatusCodes.Status500InternalServerError;
                    await Response.WriteAsync("Internal server error");
                }
            }
            catch
            {
                // Response might already be closed
            }
        }
    }

    /// <summary>
    /// Sends a Server-Sent Event to the client.
    /// </summary>
    /// <param name="eventType">Type of event (e.g., "notification.received")</param>
    /// <param name="data">Data payload for the event</param>
    /// <param name="ct">Cancellation token</param>
    private async Task SendSseEventAsync<T>(string eventType, T data, CancellationToken ct)
    {
        try
        {
            // Serialize data to JSON
            var jsonData = System.Text.Json.JsonSerializer.Serialize(data);

            // Format SSE event: "event: {eventType}\ndata: {jsonData}\n\n"
            await Response.WriteAsync($"event: {eventType}\n", ct);
            await Response.WriteAsync($"data: {jsonData}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending SSE event: {EventType}", eventType);
            throw;
        }
    }
}
