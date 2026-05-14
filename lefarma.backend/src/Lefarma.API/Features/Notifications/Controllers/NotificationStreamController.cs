using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Lefarma.API.Features.Auth;
using Lefarma.API.Services.Identity;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Lefarma.API.Features.Notifications.DTOs;

namespace Lefarma.API.Features.Notifications.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationStreamController : ControllerBase
{
    private readonly ISseService _sseService;
    private readonly ITokenService _tokenService;
    private readonly ISseTicketService _ticketService;
    private readonly ILogger<NotificationStreamController> _logger;

    public NotificationStreamController(
        ISseService sseService,
        ITokenService tokenService,
        ISseTicketService ticketService,
        ILogger<NotificationStreamController> logger)
    {
        _sseService = sseService ?? throw new ArgumentNullException(nameof(sseService));
        _tokenService = tokenService ?? throw new ArgumentNullException(nameof(tokenService));
        _ticketService = ticketService ?? throw new ArgumentNullException(nameof(ticketService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Generates a short-lived ticket for SSE connection.
    /// Avoids passing the full JWT (which can be 10KB+ for admin users) in the URL query string.
    /// </summary>
    [HttpPost("ticket")]
    [Authorize]
    [ProducesResponseType(typeof(SseTicketResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult CreateTicket()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { error = "Invalid user identity" });
        }

        var ticket = _ticketService.GenerateTicket(userId);
        return Ok(new SseTicketResponse { Ticket = ticket });
    }

    [HttpGet("stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task GetStream(string? ticket, string? token, CancellationToken ct)
    {
        try
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            int userId;

            if (!string.IsNullOrWhiteSpace(userIdClaim) && int.TryParse(userIdClaim, out userId))
            {
                _logger.LogDebug("SSE connection using standard JWT authentication for user {UserId}", userId);
            }
            else if (!string.IsNullOrWhiteSpace(ticket))
            {
                var ticketUserId = _ticketService.ValidateAndConsumeTicket(ticket);
                if (ticketUserId == null)
                {
                    _logger.LogWarning("SSE connection attempted with invalid/expired ticket");
                    Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await Response.WriteAsync("Unauthorized: Invalid or expired ticket");
                    return;
                }
                userId = ticketUserId.Value;
                _logger.LogDebug("SSE connection authenticated via ticket for user {UserId}", userId);
            }
            else if (!string.IsNullOrWhiteSpace(token))
            {
                _logger.LogDebug("SSE connection using query parameter token");

                var validationResult = await _tokenService.ValidateAccessTokenAsync(token, ct);

                if (validationResult.IsError)
                {
                    _logger.LogWarning("SSE connection attempted with invalid token: {Error}",
                        string.Join(", ", validationResult.Errors.Select(e => e.Description)));
                    Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await Response.WriteAsync("Unauthorized: Invalid token");
                    return;
                }

                var principal = validationResult.Value;
                var userIdFromToken = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

                if (string.IsNullOrWhiteSpace(userIdFromToken) || !int.TryParse(userIdFromToken, out userId))
                {
                    _logger.LogWarning("SSE connection attempted with token lacking valid user ID claim");
                    Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await Response.WriteAsync("Unauthorized: No valid user ID found in token");
                    return;
                }

                _logger.LogDebug("SSE connection authenticated via query parameter for user {UserId}", userId);
            }
            else
            {
                _logger.LogWarning("SSE connection attempted without authentication");
                Response.StatusCode = StatusCodes.Status401Unauthorized;
                await Response.WriteAsync("Unauthorized: Authentication required");
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
        catch (OperationCanceledException ex)
        {
            // Normal cancellation when client disconnects
            _logger.LogInformation($@"SSE connection cancelled (client disconnect: {ex.Message})");
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
