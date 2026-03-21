using Lefarma.API.Features.Notifications.DTOs;

namespace Lefarma.API.Domain.Interfaces;

/// <summary>
/// Main service contract for notification operations.
/// Provides methods for sending notifications and managing user notifications.
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Sends a single notification to specified recipients through configured channels.
    /// </summary>
    /// <param name="request">Notification request with details</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>Response indicating success and created notification IDs</returns>
    Task<SendNotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken ct = default);

    /// <summary>
    /// Sends notifications to multiple recipients with personalized content.
    /// </summary>
    /// <param name="request">Bulk notification request with recipient-specific data</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>Response indicating success and created notification IDs</returns>
    Task<SendNotificationResponse> SendBulkAsync(BulkNotificationRequest request, CancellationToken ct = default);

    /// <summary>
    /// Sends a notification to all users with a specific role.
    /// </summary>
    /// <param name="request">Role-based notification request</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>Response indicating success and created notification IDs</returns>
    Task<SendNotificationResponse> SendByRoleAsync(RoleNotificationRequest request, CancellationToken ct = default);

    /// <summary>
    /// Retrieves notifications for a specific user.
    /// </summary>
    /// <param name="userId">User ID to retrieve notifications for</param>
    /// <param name="unreadOnly">If true, only return unread notifications</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>List of notifications for the user</returns>
    Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, bool unreadOnly = false, CancellationToken ct = default);

    /// <summary>
    /// Marks a specific notification as read for a user.
    /// </summary>
    /// <param name="notificationId">Notification ID to mark as read</param>
    /// <param name="userId">User ID marking the notification</param>
    /// <param name="ct">Cancellation token for async operation</param>
    Task MarkAsReadAsync(int notificationId, int userId, CancellationToken ct = default);

    /// <summary>
    /// Marks all notifications as read for a specific user.
    /// </summary>
    /// <param name="userId">User ID to mark all notifications as read</param>
    /// <param name="ct">Cancellation token for async operation</param>
    Task MarkAllAsReadAsync(int userId, CancellationToken ct = default);

    /// <summary>
    /// Sends a notification to all configured channels.
    /// This method broadcasts the same message to all active notification channels.
    /// </summary>
    /// <param name="title">Notification title</param>
    /// <param name="message">Notification message content</param>
    /// <param name="recipients">Comma-separated list of recipients (user IDs, emails, phone numbers, etc.)</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>Response indicating success and created notification IDs</returns>
    Task<SendNotificationResponse> SendToAllChannelsAsync(string title, string message, string recipients, CancellationToken ct = default);
}
