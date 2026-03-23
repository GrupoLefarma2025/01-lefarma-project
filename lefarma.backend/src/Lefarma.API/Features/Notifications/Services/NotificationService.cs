using System.Security.Claims;
using System.Text.Json;
using Lefarma.API.Domain.Entities.Notifications;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.API.Features.Notifications.Services;

/// <summary>
/// Main service for orchestrating multi-channel notifications.
/// Coordinates template rendering, channel delivery, and persistence.
/// </summary>
public class NotificationService : INotificationService
{
    private readonly INotificationRepository _repository;
    private readonly ITemplateService _templateService;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<NotificationService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public NotificationService(
        INotificationRepository repository,
        ITemplateService templateService,
        IServiceProvider serviceProvider,
        ILogger<NotificationService> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _templateService = templateService ?? throw new ArgumentNullException(nameof(templateService));
        _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
    }

    /// <inheritdoc/>
    public async Task<SendNotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken ct = default)
    {
        _logger.LogInformation("Sending notification: {Title} to {ChannelCount} channels",
            request.Title, request.Channels.Count);

        // Step 1: Create Notification entity
        var notification = new Notification
        {
            Title = request.Title,
            Message = request.Message,
            Type = request.Type,
            Priority = request.Priority,
            Category = request.Category,
            TemplateId = request.TemplateId,
            TemplateData = request.TemplateData != null
                ? JsonSerializer.Serialize(request.TemplateData)
                : null,
            ScheduledFor = request.ScheduledFor,
            ExpiresAt = request.ExpiresAt,
            CreatedBy = "system" // TODO: Get from current user context
        };

        // Step 2: Save to database
        notification = await _repository.CreateAsync(notification, ct);

        _logger.LogDebug("Notification created with ID: {NotificationId}", notification.Id);

        // Step 3: Process each channel
        var channelResults = new Dictionary<string, ChannelResult>();
        var notificationChannels = new List<NotificationChannel>();

        foreach (var channelRequest in request.Channels)
        {
            _logger.LogDebug("Processing channel: {ChannelType}", channelRequest.ChannelType);

            try
            {
                // Step 3a: Get channel implementation (keyed service)
                var channel = GetChannelByKey(channelRequest.ChannelType);
                if (channel == null)
                {
                    _logger.LogWarning("Channel not found: {ChannelType}", channelRequest.ChannelType);
                    channelResults[channelRequest.ChannelType] = new ChannelResult
                    {
                        Success = false,
                        Message = $"Channel '{channelRequest.ChannelType}' not registered"
                    };
                    continue;
                }

                // Step 3b: Render template if TemplateId provided
                string messageBody = request.Message;
                if (!string.IsNullOrWhiteSpace(request.TemplateId))
                {
                    _logger.LogDebug("Rendering template: {TemplateId}", request.TemplateId);
                    messageBody = await _templateService.RenderAsync(
                        request.TemplateId,
                        request.TemplateData ?? new Dictionary<string, object>(),
                        ct);
                }

                // Step 3c: Create NotificationMessage with data
                var notificationMessage = new NotificationMessage
                {
                    Title = request.Title,
                    Body = messageBody,
                    Recipients = channelRequest.Recipients,
                    Data = channelRequest.ChannelSpecificData ?? new Dictionary<string, object>()
                };

                // Add template info to data for channels that need it
                if (!string.IsNullOrWhiteSpace(request.TemplateId))
                {
                    notificationMessage.Data["templateId"] = request.TemplateId;
                    notificationMessage.Data["templateData"] = request.TemplateData ?? new Dictionary<string, object>();
                }

                // Step 3d: Call channel.SendAsync()
                var channelResult = await channel.SendAsync(notificationMessage, ct);

                // Step 3e: Create NotificationChannel record with result
                var notificationChannel = new NotificationChannel
                {
                    NotificationId = notification.Id,
                    ChannelType = channelRequest.ChannelType,
                    Status = channelResult.Success ? "sent" : "failed",
                    Recipient = channelRequest.Recipients,
                    SentAt = channelResult.Success ? DateTime.UtcNow : null,
                    ErrorMessage = channelResult.Success ? null : channelResult.Message,
                    ExternalId = channelResult.ExternalId
                };
                notificationChannels.Add(notificationChannel);

                channelResults[channelRequest.ChannelType] = channelResult;

                _logger.LogInformation(
                    "Channel {ChannelType} processing completed. Success: {Success}",
                    channelRequest.ChannelType,
                    channelResult.Success);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing channel: {ChannelType}", channelRequest.ChannelType);

                channelResults[channelRequest.ChannelType] = new ChannelResult
                {
                    Success = false,
                    Message = $"Error: {ex.Message}"
                };

                // Create failed channel record
                notificationChannels.Add(new NotificationChannel
                {
                    NotificationId = notification.Id,
                    ChannelType = channelRequest.ChannelType,
                    Status = "failed",
                    Recipient = channelRequest.Recipients,
                    ErrorMessage = ex.Message
                });
            }
        }

        // Step 4: Create UserNotification records for in-app channel
        var inAppChannelRequest = request.Channels.FirstOrDefault(c => c.ChannelType == "in-app");
        if (inAppChannelRequest != null)
        {
            await CreateUserNotificationsAsync(notification, inAppChannelRequest, ct);
        }

        // Step 5: Update notification in database with channels
        notification.Channels = notificationChannels;
        await _repository.UpdateAsync(notification, ct);

        _logger.LogInformation(
            "Notification {NotificationId} sent successfully to {SuccessCount}/{TotalCount} channels",
            notification.Id,
            channelResults.Count(r => r.Value.Success),
            channelResults.Count);

        // Step 6: Return response
        return new SendNotificationResponse
        {
            NotificationId = notification.Id,
            ChannelResults = channelResults,
            CreatedAt = notification.CreatedAt
        };
    }

    /// <inheritdoc/>
    public async Task<SendNotificationResponse> SendBulkAsync(BulkNotificationRequest request, CancellationToken ct = default)
    {
        _logger.LogInformation("Sending bulk notification to {UserCount} users", request.UserIds.Count);

        // For bulk, we create individual notifications for each user
        // This allows for better tracking and personalization

        var results = new Dictionary<string, ChannelResult>();
        int successCount = 0;
        int firstNotificationId = 0;

        foreach (var userId in request.UserIds)
        {
            try
            {
                // Create a personalized request for this user
                var userRequest = new SendNotificationRequest
                {
                    Channels = request.Channels,
                    Title = request.Title,
                    Message = request.Message,
                    Type = request.Type,
                    Priority = request.Priority,
                    Category = request.Category,
                    TemplateId = request.TemplateId,
                    TemplateData = request.TemplateData,
                    ScheduledFor = request.ScheduledFor,
                    ExpiresAt = request.ExpiresAt
                };

                // Add userId to channel data for personalization
                foreach (var channel in userRequest.Channels)
                {
                    channel.ChannelSpecificData ??= new Dictionary<string, object>();
                    channel.ChannelSpecificData["userId"] = userId;
                }

                var response = await SendAsync(userRequest, ct);

                if (firstNotificationId == 0)
                {
                    firstNotificationId = response.NotificationId;
                }

                successCount++;

                // Aggregate results
                foreach (var kvp in response.ChannelResults)
                {
                    if (!results.ContainsKey(kvp.Key))
                    {
                        results[kvp.Key] = new ChannelResult
                        {
                            Success = true,
                            SentRecipients = new List<string>(),
                            FailedRecipients = new List<string>()
                        };
                    }

                    if (kvp.Value.Success)
                    {
                        results[kvp.Key].SentRecipients?.AddAll(kvp.Value.SentRecipients ?? new List<string>());
                    }
                    else
                    {
                        results[kvp.Key].FailedRecipients?.AddAll(kvp.Value.FailedRecipients ?? new List<string>());
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending bulk notification to user {UserId}", userId);
            }
        }

        _logger.LogInformation(
            "Bulk notification completed: {SuccessCount}/{UserCount} users successful",
            successCount,
            request.UserIds.Count);

        return new SendNotificationResponse
        {
            NotificationId = firstNotificationId,
            ChannelResults = results,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <inheritdoc/>
    public async Task<SendNotificationResponse> SendByRoleAsync(RoleNotificationRequest request, CancellationToken ct = default)
    {
        _logger.LogInformation("Sending notification to roles: {Roles}", string.Join(", ", request.Roles));

        // TODO: Implement role-based user lookup
        // For now, this is a placeholder that would need to query the user/role system

        throw new NotImplementedException(
            "SendByRoleAsync is not yet implemented. " +
            "Requires integration with the role/user management system.");
    }

    /// <inheritdoc/>
    public async Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, bool unreadOnly = false, CancellationToken ct = default)
    {
        _logger.LogDebug(
            "Getting notifications for user {UserId}, unreadOnly: {UnreadOnly}",
            userId,
            unreadOnly);

        var notifications = await _repository.GetByUserIdAsync(userId, unreadOnly, ct);

        var dtos = notifications.Select(n => new NotificationDto
        {
            Id = n.Id,
            Title = n.Title,
            Message = n.Message,
            Type = n.Type,
            Priority = n.Priority,
            CreatedAt = n.CreatedAt,
            IsRead = false, // Will be set below
            ReceivedVia = n.Channels.Select(c => c.ChannelType).ToList()
        }).ToList();

        // Update IsRead from UserNotifications
        foreach (var dto in dtos)
        {
            var userNotification = await _repository.GetUserNotificationAsync(dto.Id, userId, ct);
            if (userNotification != null)
            {
                dto.IsRead = userNotification.IsRead;
            }
        }

        return dtos;
    }

    /// <inheritdoc/>
    public async Task MarkAsReadAsync(int notificationId, int userId, CancellationToken ct = default)
    {
        _logger.LogDebug(
            "Marking notification {NotificationId} as read for user {UserId}",
            notificationId,
            userId);

        var userNotification = await _repository.GetUserNotificationAsync(notificationId, userId, ct);

        if (userNotification == null)
        {
            _logger.LogWarning(
                "User notification not found: NotificationId={NotificationId}, UserId={UserId}",
                notificationId,
                userId);
            return;
        }

        if (userNotification.IsRead)
        {
            _logger.LogDebug("Notification already marked as read");
            return;
        }

        userNotification.IsRead = true;
        userNotification.ReadAt = DateTime.UtcNow;

        await _repository.UpdateUserNotificationAsync(userNotification, ct);

        _logger.LogInformation(
            "Notification {NotificationId} marked as read for user {UserId}",
            notificationId,
            userId);
    }

    /// <inheritdoc/>
    public async Task MarkAllAsReadAsync(int userId, CancellationToken ct = default)
    {
        _logger.LogInformation("Marking all notifications as read for user {UserId}", userId);

        var notifications = await _repository.GetByUserIdAsync(userId, false, ct);

        int markedCount = 0;
        foreach (var notification in notifications)
        {
            var userNotification = await _repository.GetUserNotificationAsync(notification.Id, userId, ct);
            if (userNotification != null && !userNotification.IsRead)
            {
                userNotification.IsRead = true;
                userNotification.ReadAt = DateTime.UtcNow;
                await _repository.UpdateUserNotificationAsync(userNotification, ct);
                markedCount++;
            }
        }

        _logger.LogInformation(
            "Marked {MarkedCount} notifications as read for user {UserId}",
            markedCount,
            userId);
    }

    /// <inheritdoc/>
    public async Task<SendNotificationResponse> SendToAllChannelsAsync(string title, string message, string recipients, CancellationToken ct = default)
    {
        _logger.LogInformation("Sending notification to all channels: {Title}", title);

        var request = new SendNotificationRequest
        {
            Title = title,
            Message = message,
            Channels = new List<NotificationChannelRequest>
            {
                new() { ChannelType = "email", Recipients = recipients },
                new() { ChannelType = "telegram", Recipients = recipients },
                new() { ChannelType = "in-app", Recipients = recipients }
            }
        };

        return await SendAsync(request, ct);
    }

    /// <summary>
    /// Gets a notification channel by its key from the DI container.
    /// Uses keyed services to support multiple channel implementations.
    /// </summary>
    private INotificationChannel? GetChannelByKey(string channelType)
    {
        return _serviceProvider.GetKeyedService<INotificationChannel>(channelType);
    }

    /// <summary>
    /// Creates UserNotification records for in-app channel recipients.
    /// </summary>
    private async Task CreateUserNotificationsAsync(
        Notification notification,
        NotificationChannelRequest inAppChannelRequest,
        CancellationToken ct)
    {
        _logger.LogDebug("Creating user notifications for in-app channel");

        // Parse recipients (user IDs)
        var userIds = ParseRecipientUserIds(inAppChannelRequest.Recipients, getCurrentUserId());

        // If no user IDs found (e.g., "test" without authenticated user), skip
        if (userIds.Count == 0)
        {
            _logger.LogWarning(
                "No valid user IDs found for recipients: {Recipients}. Skipping UserNotification creation.",
                inAppChannelRequest.Recipients);
            return;
        }

        foreach (var userId in userIds)
        {
            try
            {
                var userNotification = new UserNotification
                {
                    NotificationId = notification.Id,
                    UserId = userId,
                    IsRead = false,
                    ReceivedVia = JsonSerializer.Serialize(new[] { "in-app" })
                };

                await _repository.CreateUserNotificationAsync(userNotification, ct);

                _logger.LogDebug(
                    "User notification created: UserId={UserId}, NotificationId={NotificationId}",
                    userId,
                    notification.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error creating user notification: UserId={UserId}, NotificationId={NotificationId}",
                    userId,
                    notification.Id);
            }
        }
    }

    /// <summary>
    /// Gets the current authenticated user ID from HTTP context.
    /// </summary>
    private int? getCurrentUserId()
    {
        try
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext?.User == null)
            {
                return null;
            }

            var userIdClaim = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Parses semicolon-separated recipient string into user IDs.
    /// Handles special case "test" by using the current authenticated user.
    /// </summary>
    private List<int> ParseRecipientUserIds(string recipients, int? currentUserId)
    {
        if (string.IsNullOrWhiteSpace(recipients))
        {
            return new List<int>();
        }

        // Special case: "test" means use current authenticated user
        if (recipients.Equals("test", StringComparison.OrdinalIgnoreCase))
        {
            if (currentUserId.HasValue)
            {
                _logger.LogDebug("Using current authenticated user ID for 'test' recipient: {UserId}", currentUserId.Value);
                return new List<int> { currentUserId.Value };
            }
            else
            {
                _logger.LogWarning("Recipient is 'test' but no authenticated user found");
                return new List<int>();
            }
        }

        // Normal case: parse semicolon or comma separated user IDs
        return recipients
            .Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(id => id.Trim())
            .Where(id => int.TryParse(id, out _))
            .Select(int.Parse)
            .Distinct()
            .ToList();
    }
}

/// <summary>
/// Extension methods for collections.
/// </summary>
internal static class CollectionExtensions
{
    public static void AddAll<T>(this ICollection<T> collection, IEnumerable<T> items)
    {
        foreach (var item in items)
        {
            collection.Add(item);
        }
    }
}
