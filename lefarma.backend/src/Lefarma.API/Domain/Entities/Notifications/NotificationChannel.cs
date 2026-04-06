namespace Lefarma.API.Domain.Entities.Notifications;
public class NotificationChannel
{
    public int Id { get; set; }
    public int NotificationId { get; set; }
    public string ChannelType { get; set; } = string.Empty;  // email, in-app, telegram
    public string Status { get; set; } = "pending";  // pending, sent, failed, retrying
    public string Recipient { get; set; } = string.Empty;  // email;email or chatId;chatId
    public DateTime? SentAt { get; set; }
    public string? ErrorMessage { get; set; }
    public int RetryCount { get; set; } = 0;
    public string? ExternalId { get; set; }  // messageId, telegram_id
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public Notification? Notification { get; set; }
}
