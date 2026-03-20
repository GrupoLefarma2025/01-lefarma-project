using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Features.Notifications.Services;

namespace Lefarma.API.Features.Notifications.Controllers;

/// <summary>
/// API controller for managing notifications.
/// Provides endpoints for sending, retrieving, and managing notifications across multiple channels.
/// </summary>
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

    /// <summary>
    /// Sends a notification through one or more channels.
    /// </summary>
    /// <param name="request">Notification request with channels, message, and metadata</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Response with notification ID and channel delivery results</returns>
    /// <response code="200">Notification sent successfully</response>
    /// <response code="400">Invalid request data</response>
    /// <response code="500">Internal server error</response>
    [HttpPost("send")]
    [ProducesResponseType(typeof(SendNotificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SendNotificationResponse>> Send(
        [FromBody] SendNotificationRequest request,
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

    /// <summary>
    /// Sends a notification to multiple users in bulk.
    /// </summary>
    /// <param name="request">Bulk notification request with list of user IDs</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Response with aggregated results from all users</returns>
    /// <response code="200">Bulk notification sent successfully</response>
    /// <response code="400">Invalid request data</response>
    /// <response code="500">Internal server error</response>
    [HttpPost("send-bulk")]
    [ProducesResponseType(typeof(SendNotificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SendNotificationResponse>> SendBulk(
        [FromBody] BulkNotificationRequest request,
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

    /// <summary>
    /// Sends a notification to all users with specific roles.
    /// </summary>
    /// <param name="request">Role notification request with list of role names</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Response with aggregated results from all role members</returns>
    /// <response code="200">Role notification sent successfully</response>
    /// <response code="400">Invalid request data</response>
    /// <response code="501">Not implemented yet</response>
    /// <response code="500">Internal server error</response>
    [HttpPost("send-by-role")]
    [ProducesResponseType(typeof(SendNotificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SendNotificationResponse>> SendByRole(
        [FromBody] RoleNotificationRequest request,
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

    /// <summary>
    /// Gets notifications for a specific user.
    /// </summary>
    /// <param name="userId">User ID to get notifications for</param>
    /// <param name="unreadOnly">If true, only returns unread notifications</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>List of user notifications</returns>
    /// <response code="200">Notifications retrieved successfully</response>
    /// <response code="400">Invalid user ID</response>
    /// <response code="500">Internal server error</response>
    [HttpGet("user/{userId}")]
    [ProducesResponseType(typeof(List<NotificationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<NotificationDto>>> GetUserNotifications(
        [FromRoute] int userId,
        [FromQuery] bool unreadOnly = false,
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

    /// <summary>
    /// Marks a specific notification as read for a user.
    /// </summary>
    /// <param name="notificationId">Notification ID to mark as read</param>
    /// <param name="request">Request containing the user ID</param>
    /// <param name="ct">Cancellation token</param>
    /// <response code="200">Notification marked as read successfully</response>
    /// <response code="400">Invalid request data</response>
    /// <response code="404">Notification not found</response>
    /// <response code="500">Internal server error</response>
    [HttpPatch("{notificationId}/read")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult> MarkAsRead(
        [FromRoute] int notificationId,
        [FromBody] MarkReadRequest request,
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

    /// <summary>
    /// Marks all notifications as read for a specific user.
    /// </summary>
    /// <param name="userId">User ID to mark all notifications as read</param>
    /// <param name="ct">Cancellation token</param>
    /// <response code="200">All notifications marked as read successfully</response>
    /// <response code="400">Invalid user ID</response>
    /// <response code="500">Internal server error</response>
    [HttpPatch("user/{userId}/read-all")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult> MarkAllAsRead(
        [FromRoute] int userId,
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

    /// <summary>
    /// Sends a test notification to verify a channel is working.
    /// </summary>
    /// <param name="request">Test notification request with channel and recipient</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Response from the test notification</returns>
    /// <response code="200">Test notification sent successfully</response>
    /// <response code="400">Invalid test request</response>
    /// <response code="500">Internal server error</response>
    [HttpPost("test")]
    [ProducesResponseType(typeof(SendNotificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SendNotificationResponse>> Test(
        [FromBody] TestNotificationRequest request,
        CancellationToken ct)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            _logger.LogInformation(
                "POST /api/notifications/test - Channel: {ChannelType}, Recipient: {Recipient}",
                request.ChannelType,
                request.Recipient);

            // Create a test notification
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
                        Recipients = request.Recipient
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
}
