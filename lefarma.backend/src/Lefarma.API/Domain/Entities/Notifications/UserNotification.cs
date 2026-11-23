namespace Lefarma.API.Domain.Entities.Notifications;
public class UserNotification
{
    public int Id { get; set; }
    public int NotificationId { get; set; }
    public int UserId { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime? ReadAt { get; set; }
    public string ReceivedVia { get; set; } = "[]";  
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Notification? Notification { get; set; }
}
