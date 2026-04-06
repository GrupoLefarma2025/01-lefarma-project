namespace Lefarma.API.Features.Notifications.DTOs;
/// <summary>
/// View model for notification templates (Razor)
/// </summary>
public class NotificationTemplateViewModel
{
    /// <summary>
    /// Notification title
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Notification message body
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Notification priority (low, normal, high, urgent)
    /// </summary>
    public string Priority { get; set; } = "normal";

    /// <summary>
    /// Notification category (system, order, payment, alert)
    /// </summary>
    public string Category { get; set; } = "system";

    /// <summary>
    /// Notification type (info, warning, error, success)
    /// </summary>
    public string Type { get; set; } = "info";

    /// <summary>
    /// Sender name
    /// </summary>
    public string? SenderName { get; set; }

    /// <summary>
    /// Sender email
    /// </summary>
    public string? SenderEmail { get; set; }

    /// <summary>
    /// Customer or user name for personalization
    /// </summary>
    public string? CustomerName { get; set; }

    /// <summary>
    /// Action URL for button/link
    /// </summary>
    public string? ActionUrl { get; set; }

    /// <summary>
    /// Action text for button
    /// </summary>
    public string? ActionText { get; set; }

    /// <summary>
    /// Icon name/class for the notification
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Notification ID
    /// </summary>
    public int NotificationId { get; set; }

    /// <summary>
    /// Created timestamp
    /// </summary>
    public DateTime? CreatedAt { get; set; }

    /// <summary>
    /// Additional custom data for the template
    /// </summary>
    public Dictionary<string, object>? AdditionalData { get; set; }

    // Legacy properties for backward compatibility
    /// <summary>
    /// Order or reference ID
    /// </summary>
    public string? OrderId { get; set; }

    /// <summary>
    /// Total amount for orders/payments
    /// </summary>
    public decimal? TotalAmount { get; set; }

    /// <summary>
    /// List of items in the notification
    /// </summary>
    public List<NotificationItemViewModel>? Items { get; set; }

    /// <summary>
    /// Custom data (alias for AdditionalData)
    /// </summary>
    public Dictionary<string, object>? CustomData { get; set; }
}

/// <summary>
/// View model for items in notification templates
/// </summary>
public class NotificationItemViewModel
{
    /// <summary>
    /// Name of the item
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// Quantity of the item
    /// </summary>
    public int Quantity { get; set; }
}
