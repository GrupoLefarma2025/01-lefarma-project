namespace Lefarma.API.Domain.Entities.Notifications;
public class Notification
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "info";  
    public string Priority { get; set; } = "normal";  
    public string Category { get; set; } = "system";
    public string? TemplateId { get; set; }
    public string? TemplateData { get; set; }  
    public string CreatedBy { get; set; } = "system";
    public DateTime? ScheduledFor { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int RetryCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<NotificationChannel> Channels { get; set; } = new List<NotificationChannel>();
    public ICollection<UserNotification> UserNotifications { get; set; } = new List<UserNotification>();
}
