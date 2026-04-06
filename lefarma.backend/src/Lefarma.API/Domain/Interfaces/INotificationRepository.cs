using Lefarma.API.Domain.Entities.Notifications;

namespace Lefarma.API.Domain.Interfaces;
/// <summary>
/// Repository interface for notification data access.
/// Manages persistence of notifications and user notification relationships.
/// </summary>
public interface INotificationRepository
{
    /// <summary>
    /// Creates a new notification in the database.
    /// </summary>
    /// <param name="notification">Notification entity to create</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>Created notification with ID populated</returns>
    Task<Notification> CreateAsync(Notification notification, CancellationToken ct = default);

    /// <summary>
    /// Retrieves a notification by its ID.
    /// </summary>
    /// <param name="id">Notification ID</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>Notification if found, null otherwise</returns>
    Task<Notification?> GetByIdAsync(int id, CancellationToken ct = default);

    /// <summary>
    /// Retrieves all notifications for a specific user.
    /// </summary>
    /// <param name="userId">User ID to retrieve notifications for</param>
    /// <param name="unreadOnly">If true, only return unread notifications</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>List of notifications for the user</returns>
    Task<List<Notification>> GetByUserIdAsync(int userId, bool unreadOnly = false, CancellationToken ct = default);

    /// <summary>
    /// Retrieves a user-notification relationship record.
    /// </summary>
    /// <param name="notificationId">Notification ID</param>
    /// <param name="userId">User ID</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>UserNotification if found, null otherwise</returns>
    Task<UserNotification?> GetUserNotificationAsync(int notificationId, int userId, CancellationToken ct = default);

    /// <summary>
    /// Creates a new user-notification relationship.
    /// </summary>
    /// <param name="userNotification">UserNotification entity to create</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>Created user notification with ID populated</returns>
    Task<UserNotification> CreateUserNotificationAsync(UserNotification userNotification, CancellationToken ct = default);

    /// <summary>
    /// Updates an existing notification.
    /// </summary>
    /// <param name="notification">Notification entity with updated values</param>
    /// <param name="ct">Cancellation token for async operation</param>
    Task UpdateAsync(Notification notification, CancellationToken ct = default);

    /// <summary>
    /// Updates a user-notification relationship (e.g., marking as read).
    /// </summary>
    /// <param name="userNotification">UserNotification entity with updated values</param>
    /// <param name="ct">Cancellation token for async operation</param>
    Task UpdateUserNotificationAsync(UserNotification userNotification, CancellationToken ct = default);
}
