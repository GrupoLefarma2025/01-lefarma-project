namespace Lefarma.API.Domain.Entities.Notifications;
public class NotificationChannel
{
    public int Id { get; set; }
    public int NotificationId { get; set; }
    public string ChannelType { get; set; } = string.Empty;  
    public string Status { get; set; } = "pending";  
    public string Recipient { get; set; } = string.Empty;  
    public DateTime? SentAt { get; set; }
    public string? ErrorMessage { get; set; }
    public int RetryCount { get; set; } = 0;
    public string? ExternalId { get; set; }  
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Notification? Notification { get; set; }
}
