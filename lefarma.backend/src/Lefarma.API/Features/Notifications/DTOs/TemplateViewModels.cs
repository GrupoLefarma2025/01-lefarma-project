namespace Lefarma.API.Features.Notifications.DTOs;
public class NotificationTemplateViewModel
{
    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string Priority { get; set; } = "normal";

    public string Category { get; set; } = "system";

    public string Type { get; set; } = "info";

    public string? SenderName { get; set; }

    public string? SenderEmail { get; set; }

    public string? CustomerName { get; set; }

    public string? ActionUrl { get; set; }

    public string? ActionText { get; set; }

    public string? Icon { get; set; }

    public int NotificationId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public Dictionary<string, object>? AdditionalData { get; set; }

    public string? OrderId { get; set; }

    public decimal? TotalAmount { get; set; }

    public List<NotificationItemViewModel>? Items { get; set; }

    public Dictionary<string, object>? CustomData { get; set; }
}

public class NotificationItemViewModel
{
    public string? Name { get; set; }

    public int Quantity { get; set; }
}
