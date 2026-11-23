using Lefarma.API.Domain.Entities.Notifications;

namespace Lefarma.API.Domain.Interfaces;
public interface INotificationRepository
{
    Task<Notification> CreateAsync(Notification notification, CancellationToken ct = default);

    Task<Notification?> GetByIdAsync(int id, CancellationToken ct = default);

    Task<List<Notification>> GetByUserIdAsync(int userId, bool unreadOnly = false, CancellationToken ct = default);

    Task<UserNotification?> GetUserNotificationAsync(int notificationId, int userId, CancellationToken ct = default);

    Task<UserNotification> CreateUserNotificationAsync(UserNotification userNotification, CancellationToken ct = default);

    Task UpdateAsync(Notification notification, CancellationToken ct = default);

    Task UpdateUserNotificationAsync(UserNotification userNotification, CancellationToken ct = default);
}
