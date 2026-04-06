namespace Lefarma.API.Features.Notifications.DTOs;
public class NotificationSettings
{
    public int MaxRetryCount { get; set; } = 3;
    public int RetryDelaySeconds { get; set; } = 60;
    public string TemplatePath { get; set; } = "Views/Notifications";
}
