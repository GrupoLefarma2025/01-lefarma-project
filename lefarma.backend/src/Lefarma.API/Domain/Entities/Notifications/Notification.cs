namespace Lefarma.API.Domain.Entities.Notifications;
public class Notification
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "info";  // info, warning, error, success, alert
    public string Priority { get; set; } = "normal";  // low, normal, high, urgent
    public string Category { get; set; } = "system";
    public string? TemplateId { get; set; }
    public string? TemplateData { get; set; }  // JSON
    public string CreatedBy { get; set; } = "system";
    public DateTime? ScheduledFor { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int RetryCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<NotificationChannel> Channels { get; set; } = new List<NotificationChannel>();
    public ICollection<UserNotification> UserNotifications { get; set; } = new List<UserNotification>();
}
