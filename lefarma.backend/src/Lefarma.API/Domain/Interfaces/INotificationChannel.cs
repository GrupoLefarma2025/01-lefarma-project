using Lefarma.API.Features.Notifications.DTOs;

namespace Lefarma.API.Domain.Interfaces;

/// <summary>
/// Defines the contract for notification channel implementations.
/// Each channel (Email, SMS, In-App, Push) implements this interface.
/// </summary>
public interface INotificationChannel
{
    /// <summary>
    /// Gets the type identifier for this channel (e.g., "Email", "SMS", "InApp", "Push")
    /// </summary>
    string ChannelType { get; }

    /// <summary>
    /// Sends a notification message through this channel.
    /// </summary>
    /// <param name="message">The notification message to send</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>ChannelResult indicating success/failure and any error details</returns>
    Task<ChannelResult> SendAsync(NotificationMessage message, CancellationToken ct = default);

    /// <summary>
    /// Validates that the recipient identifier is valid for this channel type.
    /// </summary>
    /// <param name="recipients">Comma-separated recipient identifiers</param>
    /// <param name="ct">Cancellation token for async operation</param>
    /// <returns>True if recipients are valid for this channel</returns>
    Task<bool> ValidateRecipientsAsync(string recipients, CancellationToken ct = default);
}
