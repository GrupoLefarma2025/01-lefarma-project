using Lefarma.API.Features.Notifications.DTOs;

namespace Lefarma.API.Domain.Interfaces;
public interface INotificationChannel
{
    string ChannelType { get; }

    Task<ChannelResult> SendAsync(NotificationMessage message, CancellationToken ct = default);

    Task<bool> ValidateRecipientsAsync(string recipients, CancellationToken ct = default);
}
