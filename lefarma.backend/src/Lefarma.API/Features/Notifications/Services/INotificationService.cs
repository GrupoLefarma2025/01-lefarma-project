using Lefarma.API.Features.Notifications.DTOs;

namespace Lefarma.API.Features.Notifications.Services;

/// <summary>
/// Main service interface for orchestrating multi-channel notifications.
/// Coordinates template rendering, channel delivery, and persistence.
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Sends a notification through one or more channels.
    /// </summary>
    /// <param name="request">Notification request with channels, message, and metadata</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Response with notification ID and channel delivery results</returns>
    Task<SendNotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken ct = default);

    /// <summary>
    /// Sends a notification to all configured channels.
    /// </summary>
    /// <param name="title">Notification title</param>
    /// <param name="message">Notification message</param>
    /// <param name="recipients">Semicolon-separated list of recipients</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Response with notification ID and channel delivery results</returns>
    Task<SendNotificationResponse> SendToAllChannelsAsync(string title, string message, string recipients, CancellationToken ct = default);

    /// <summary>
    /// Sends a notification to multiple users in bulk.
    /// </summary>
    /// <param name="request">Bulk notification request with list of user IDs</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Response with aggregated results from all users</returns>
    Task<SendNotificationResponse> SendBulkAsync(BulkNotificationRequest request, CancellationToken ct = default);

    /// <summary>
    /// Sends a notification to all users with specific roles.
    /// </summary>
    /// <param name="request">Role notification request with list of role names</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Response with aggregated results from all role members</returns>
    Task<SendNotificationResponse> SendByRoleAsync(RoleNotificationRequest request, CancellationToken ct = default);

    /// <summary>
    /// Gets notifications for a specific user.
    /// </summary>
    /// <param name="userId">User ID to get notifications for</param>
    /// <param name="unreadOnly">If true, only returns unread notifications</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>List of user notifications</returns>
    Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, bool unreadOnly = false, CancellationToken ct = default);

    /// <summary>
    /// Marks a specific notification as read for a user.
    /// </summary>
    /// <param name="notificationId">Notification ID to mark as read</param>
    /// <param name="userId">User ID marking the notification as read</param>
    /// <param name="ct">Cancellation token</param>
    Task MarkAsReadAsync(int notificationId, int userId, CancellationToken ct = default);

    /// <summary>
    /// Marks all notifications as read for a specific user.
    /// </summary>
    /// <param name="userId">User ID to mark all notifications as read</param>
    /// <param name="ct">Cancellation token</param>
    Task MarkAllAsReadAsync(int userId, CancellationToken ct = default);
}
