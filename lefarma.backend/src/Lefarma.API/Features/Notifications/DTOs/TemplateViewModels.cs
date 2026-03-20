namespace Lefarma.API.Features.Notifications.DTOs;

/// <summary>
/// View model for notification templates (Razor)
/// </summary>
public class NotificationTemplateViewModel
{
    /// <summary>
    /// Customer or user name
    /// </summary>
    public string? CustomerName { get; set; }

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
    /// Custom message to display
    /// </summary>
    public string? Message { get; set; }

    /// <summary>
    /// Additional custom data for the template
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
