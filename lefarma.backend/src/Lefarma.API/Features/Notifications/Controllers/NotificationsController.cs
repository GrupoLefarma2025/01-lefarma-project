using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Features.Auth;

namespace Lefarma.API.Features.Notifications.Controllers;
[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(
        INotificationService notificationService,
        ILogger<NotificationsController> logger)
    {
        _notificationService = notificationService ?? throw new ArgumentNullException(nameof(notificationService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpPost("send")]
    [ProducesResponseType(typeof(SendNotificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SendNotificationResponse>> Send(
         SendNotificationRequest request,
        CancellationToken ct)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            _logger.LogInformation(
                "POST /api/notifications/send - Title: {Title}, Channels: {ChannelCount}",
                request.Title,
                request.Channels.Count);

            var response = await _notificationService.SendAsync(request, ct);

            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid notification request");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending notification");
            return StatusCode(500, new { error = "An error occurred while sending the notification" });
        }
    }

    [HttpPost("send-bulk")]
    [ProducesResponseType(typeof(SendNotificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SendNotificationResponse>> SendBulk(
         BulkNotificationRequest request,
        CancellationToken ct)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            _logger.LogInformation(
                "POST /api/notifications/send-bulk - UserCount: {UserCount}, Title: {Title}",
                request.UserIds.Count,
                request.Title);

            var response = await _notificationService.SendBulkAsync(request, ct);

            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid bulk notification request");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending bulk notification");
            return StatusCode(500, new { error = "An error occurred while sending the bulk notification" });
        }
    }

    [HttpPost("send-by-role")]
    [ProducesResponseType(typeof(SendNotificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SendNotificationResponse>> SendByRole(
         RoleNotificationRequest request,
        CancellationToken ct)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            _logger.LogInformation(
                "POST /api/notifications/send-by-role - Roles: {Roles}, Title: {Title}",
                string.Join(", ", request.Roles),
                request.Title);

            var response = await _notificationService.SendByRoleAsync(request, ct);

            return Ok(response);
        }
        catch (NotImplementedException ex)
        {
            _logger.LogWarning(ex, "Send by role not implemented");
            return StatusCode(501, new { error = "Send by role is not yet implemented" });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid role notification request");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending role notification");
            return StatusCode(500, new { error = "An error occurred while sending the role notification" });
        }
    }

    [HttpGet("user/{userId}")]
    [ProducesResponseType(typeof(List<NotificationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<NotificationDto>>> GetUserNotifications(
         int userId,
        bool unreadOnly = false,
        CancellationToken ct = default)
    {
        try
        {
            if (userId <= 0)
            {
                _logger.LogWarning("Invalid user ID: {UserId}", userId);
                return BadRequest(new { error = "Invalid user ID" });
            }

            _logger.LogDebug(
                "GET /api/notifications/user/{UserId} - UnreadOnly: {UnreadOnly}",
                userId,
                unreadOnly);

            var notifications = await _notificationService.GetUserNotificationsAsync(userId, unreadOnly, ct);

            return Ok(notifications);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting notifications for user {UserId}", userId);
            return StatusCode(500, new { error = "An error occurred while retrieving notifications" });
        }
    }

    [HttpPatch("{notificationId}/read")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult> MarkAsRead(
         int notificationId,
         MarkReadRequest request,
        CancellationToken ct)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (notificationId <= 0)
            {
                _logger.LogWarning("Invalid notification ID: {NotificationId}", notificationId);
                return BadRequest(new { error = "Invalid notification ID" });
            }

            _logger.LogDebug(
                "PATCH /api/notifications/{NotificationId}/read - UserId: {UserId}",
                notificationId,
                request.UserId);

            await _notificationService.MarkAsReadAsync(notificationId, request.UserId, ct);

            return Ok(new { message = "Notification marked as read" });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error marking notification {NotificationId} as read for user {UserId}",
                notificationId,
                request.UserId);
            return StatusCode(500, new { error = "An error occurred while marking the notification as read" });
        }
    }

    [HttpPatch("user/{userId}/read-all")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult> MarkAllAsRead(
         int userId,
        CancellationToken ct)
    {
        try
        {
            if (userId <= 0)
            {
                _logger.LogWarning("Invalid user ID: {UserId}", userId);
                return BadRequest(new { error = "Invalid user ID" });
            }

            _logger.LogInformation(
                "PATCH /api/notifications/user/{UserId}/read-all",
                userId);

            await _notificationService.MarkAllAsReadAsync(userId, ct);

            return Ok(new { message = "All notifications marked as read" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking all notifications as read for user {UserId}", userId);
            return StatusCode(500, new { error = "An error occurred while marking notifications as read" });
        }
    }

    [HttpPost("test")]
    [ProducesResponseType(typeof(SendNotificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SendNotificationResponse>> Test(
         TestNotificationRequest request,
        CancellationToken ct)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if ((request.UserIds == null || !request.UserIds.Any()) &&
                (request.RoleNames == null || !request.RoleNames.Any()))
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (int.TryParse(userIdClaim, out var currentUserId))
                {
                    request.UserIds = new List<int> { currentUserId };
                }
            }

            _logger.LogInformation(
                "POST /api/notifications/test - Channel: {ChannelType}, UserIds: {UserIds}, RoleNames: {RoleNames}",
                request.ChannelType,
                request.UserIds != null ? string.Join(",", request.UserIds) : "none",
                request.RoleNames != null ? string.Join(",", request.RoleNames) : "none");

            var testRequest = new SendNotificationRequest
            {
                Title = $"Test Notification - {request.ChannelType}",
                Message = "This is a test notification to verify the channel is working correctly.",
                Type = "info",
                Priority = "normal",
                Category = "system",
                Channels = new List<NotificationChannelRequest>
                {
                    new()
                    {
                        ChannelType = request.ChannelType,
                        UserIds = request.UserIds,
                        RoleNames = request.RoleNames
                    }
                }
            };

            var response = await _notificationService.SendAsync(testRequest, ct);

            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid test notification request");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending test notification");
            return StatusCode(500, new { error = "An error occurred while sending the test notification" });
        }
    }

    [HttpPost("test-sse")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult> TestSse(CancellationToken ct)
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { error = "No valid user ID found" });
            }

            _logger.LogInformation("POST /api/notifications/test-sse - Testing SSE for user {UserId}", userId);

            var sseService = HttpContext.RequestServices.GetRequiredService<ISseService>();

            await sseService.NotifyAsync(userId, "test", new
            {
                message = "SSE connection test successful!",
                timestamp = DateTime.UtcNow,
                userId = userId
            }, ct);

            return Ok(new
            {
                message = "SSE test event sent",
                userId,
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending SSE test");
            return StatusCode(500, new { error = "Error sending SSE test" });
        }
    }
}
