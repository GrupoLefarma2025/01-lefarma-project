using Lefarma.API.Domain.Entities.Notifications;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Auth;
using Lefarma.API.Features.Notifications.DTOs;
using System.Text.Json;

namespace Lefarma.API.Features.Notifications.Services.Channels;
/// <summary>
/// In-App notification channel implementation using Server-Sent Events (SSE).
/// Creates UserNotification records and sends real-time notifications to connected users.
/// </summary>
public class InAppNotificationChannel : INotificationChannel
{
    private readonly ISseService _sseService;
    private readonly INotificationRepository _notificationRepository;
    private readonly ILogger<InAppNotificationChannel> _logger;

    /// <inheritdoc/>
    public string ChannelType => "in-app";

    public InAppNotificationChannel(
        ISseService sseService,
        INotificationRepository notificationRepository,
        ILogger<InAppNotificationChannel> logger)
    {
        _sseService = sseService ?? throw new ArgumentNullException(nameof(sseService));
        _notificationRepository = notificationRepository ?? throw new ArgumentNullException(nameof(notificationRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc/>
    public async Task<ChannelResult> SendAsync(NotificationMessage message, CancellationToken ct = default)
    {
        _logger.LogInformation("Sending in-app notification to recipients: {Recipients}", message.Recipients);

        var result = new ChannelResult
        {
            Success = false,
            SentRecipients = new List<string>(),
            FailedRecipients = new List<string>()
        };

        try
        {
            // Parse userIds from recipients string (semicolon-separated)
            var userIds = ParseUserIds(message.Recipients);
            if (userIds.Count == 0)
            {
                _logger.LogWarning("No valid user IDs found in: {Recipients}", message.Recipients);
                result.Message = "No valid user IDs found";
                return result;
            }

            // Extract notification ID from message data
            if (!TryGetNotificationId(message, out var notificationId))
            {
                _logger.LogError("Notification ID not found in message data");
                result.Message = "Notification ID is required for in-app notifications";
                return result;
            }

            // Create UserNotification records for each user
            var receivedViaJson = JsonSerializer.Serialize(new[] { "in-app" });

            foreach (var userId in userIds)
            {
                try
                {
                    // Check if user notification already exists
                    var existingUserNotification = await _notificationRepository.GetUserNotificationAsync(
                        notificationId.Value, userId, ct);

                    if (existingUserNotification != null)
                    {
                        // Update existing user notification - append "in-app" to ReceivedVia
                        var existingReceivedVia = JsonSerializer.Deserialize<List<string>>(existingUserNotification.ReceivedVia) ?? new List<string>();
                        if (!existingReceivedVia.Contains("in-app"))
                        {
                            existingReceivedVia.Add("in-app");
                            existingUserNotification.ReceivedVia = JsonSerializer.Serialize(existingReceivedVia);
                            await _notificationRepository.UpdateUserNotificationAsync(existingUserNotification, ct);
                        }
                    }
                    else
                    {
                        // Create new user notification
                        var userNotification = new UserNotification
                        {
                            NotificationId = notificationId.Value,
                            UserId = userId,
                            IsRead = false,
                            ReceivedVia = receivedViaJson,
                            CreatedAt = DateTime.UtcNow
                        };

                        await _notificationRepository.CreateUserNotificationAsync(userNotification, ct);
                    }

                    // Send SSE notification to connected user
                    if (_sseService.IsUserConnected(userId))
                    {
                        var notificationData = new
                        {
                            Id = notificationId.Value,
                            message.Title,
                            message.Body,
                            Type = message.Data?.TryGetValue("type", out var typeObj) == true ? typeObj?.ToString() : "info",
                            Priority = message.Data?.TryGetValue("priority", out var priorityObj) == true ? priorityObj?.ToString() : "normal",
                            CreatedAt = DateTime.UtcNow
                        };

                        await _sseService.NotifyAsync(userId, "notification.received", notificationData, ct);
                        result.SentRecipients.Add(userId.ToString());
                        _logger.LogDebug("In-app notification sent to user {UserId}", userId);
                    }
                    else
                    {
                        // User is not connected, but notification is stored
                        result.SentRecipients.Add(userId.ToString());
                        _logger.LogDebug("User {UserId} is not connected, notification stored only", userId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send in-app notification to user {UserId}", userId);
                    result.FailedRecipients.Add(userId.ToString());
                }
            }

            result.Success = result.FailedRecipients.Count == 0;
            result.Message = result.Success
                ? $"In-app notification sent to {result.SentRecipients.Count} user(s)"
                : $"Partially sent: {result.SentRecipients.Count} succeeded, {result.FailedRecipients.Count} failed";

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing in-app notification");
            result.Message = $"Error processing in-app notification: {ex.Message}";
            result.FailedRecipients = ParseUserIds(message.Recipients).Select(id => id.ToString()).ToList();
            return result;
        }
    }

    /// <inheritdoc/>
    public Task<bool> ValidateRecipientsAsync(string recipients, CancellationToken ct = default)
    {
        try
        {
            var userIds = ParseUserIds(recipients);

            if (userIds.Count == 0)
            {
                return Task.FromResult(false);
            }

            // Validate that all user IDs are positive integers
            var allValid = userIds.All(id => id > 0);

            return Task.FromResult(allValid);
        }
        catch
        {
            return Task.FromResult(false);
        }
    }

    /// <summary>
    /// Parses semicolon-separated user IDs string into a list of integers.
    /// </summary>
    private static List<int> ParseUserIds(string recipients)
    {
        if (string.IsNullOrWhiteSpace(recipients))
        {
            return new List<int>();
        }

        return recipients
            .Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(id => id.Trim())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id =>
            {
                int.TryParse(id, out var userId);
                return userId;
            })
            .Where(userId => userId > 0)
            .Distinct()
            .ToList();
    }

    /// <summary>
    /// Extracts notification ID from message data.
    /// </summary>
    private bool TryGetNotificationId(NotificationMessage message, out int? notificationId)
    {
        notificationId = null;

        if (message.Data != null &&
            message.Data.TryGetValue("notificationId", out var notificationIdObj))
        {
            if (int.TryParse(notificationIdObj?.ToString(), out var id))
            {
                notificationId = id;
                return true;
            }
        }

        return false;
    }
}
