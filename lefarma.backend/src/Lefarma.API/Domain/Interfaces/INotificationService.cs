using Lefarma.API.Features.Notifications.DTOs;

namespace Lefarma.API.Domain.Interfaces;
public interface INotificationService
{
    Task<SendNotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken ct = default);

    Task<SendNotificationResponse> SendBulkAsync(BulkNotificationRequest request, CancellationToken ct = default);

    Task<SendNotificationResponse> SendByRoleAsync(RoleNotificationRequest request, CancellationToken ct = default);

    Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, bool unreadOnly = false, CancellationToken ct = default);

    Task MarkAsReadAsync(int notificationId, int userId, CancellationToken ct = default);

    Task MarkAllAsReadAsync(int userId, CancellationToken ct = default);

}
