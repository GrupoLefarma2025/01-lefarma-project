using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.Notifications.DTOs;
/// <summary>
/// Request to send a notification through one or more channels
/// </summary>
public class SendNotificationRequest
{
    /// <summary>
    /// List of channels to send the notification through
    /// </summary>
    [Required]
    public List<NotificationChannelRequest> Channels { get; set; } = new();

    /// <summary>
    /// Title of the notification
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Main message content
    /// </summary>
    [Required]
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Type of notification: info, warning, error, success, alert
    /// </summary>
    [MaxLength(50)]
    public string Type { get; set; } = "info";

    /// <summary>
    /// Priority level: low, normal, high, urgent
    /// </summary>
    [MaxLength(20)]
    public string Priority { get; set; } = "normal";

    /// <summary>
    /// Category for grouping: system, order, payment, catalog, etc.
    /// </summary>
    [MaxLength(100)]
    public string Category { get; set; } = "system";

    /// <summary>
    /// Optional template ID to use for rendering
    /// </summary>
    [MaxLength(100)]
    public string? TemplateId { get; set; }

    /// <summary>
    /// Data to pass to the template for rendering
    /// </summary>
    public Dictionary<string, object>? TemplateData { get; set; }

    /// <summary>
    /// When to send the notification (null = immediate)
    /// </summary>
    public DateTime? ScheduledFor { get; set; }

    /// <summary>
    /// When the notification expires
    /// </summary>
    public DateTime? ExpiresAt { get; set; }
}

/// <summary>
/// Configuration for a single notification channel
/// </summary>
public class NotificationChannelRequest
{
    /// <summary>
    /// Type of channel: email, in-app, telegram
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string ChannelType { get; set; } = string.Empty;

    /// <summary>
    /// List of user IDs to send the notification to
    /// </summary>
    public List<int>? UserIds { get; set; }

    /// <summary>
    /// List of role names to send the notification to all users with those roles
    /// </summary>
    public List<string>? RoleNames { get; set; }

    /// <summary>
    /// Channel-specific configuration data
    /// </summary>
    public Dictionary<string, object>? ChannelSpecificData { get; set; }
}

/// <summary>
/// Request to send notification to multiple specific users
/// </summary>
public class BulkNotificationRequest : SendNotificationRequest
{
    /// <summary>
    /// List of user IDs to send the notification to
    /// </summary>
    [Required]
    public List<int> UserIds { get; set; } = new();
}

/// <summary>
/// Request to send notification to all users with specific roles
/// </summary>
public class RoleNotificationRequest : SendNotificationRequest
{
    /// <summary>
    /// List of role names to send the notification to
    /// </summary>
    [Required]
    public List<string> Roles { get; set; } = new();
}

/// <summary>
/// Response after sending a notification
/// </summary>
public class SendNotificationResponse
{
    /// <summary>
    /// ID of the created notification
    /// </summary>
    public int NotificationId { get; set; }

    /// <summary>
    /// Results for each channel attempted
    /// </summary>
    public Dictionary<string, ChannelResult> ChannelResults { get; set; } = new();

    /// <summary>
    /// When the notification was created
    /// </summary>
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Result of sending a notification through a channel
/// </summary>
public class ChannelResult
{
    /// <summary>
    /// Whether the send operation was successful
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Error or success message
    /// </summary>
    public string? Message { get; set; }

    /// <summary>
    /// List of recipients that received the notification
    /// </summary>
    public List<string>? SentRecipients { get; set; }

    /// <summary>
    /// List of recipients that failed to receive
    /// </summary>
    public List<string>? FailedRecipients { get; set; }

    /// <summary>
    /// External ID from the provider (messageId, telegram_id, etc.)
    /// </summary>
    public string? ExternalId { get; set; }
}

/// <summary>
/// Message format for channel delivery
/// </summary>
public class NotificationMessage
{
    /// <summary>
    /// Title of the message
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Body content of the message
    /// </summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>
    /// Recipients (semicolon-separated)
    /// </summary>
    public string Recipients { get; set; } = string.Empty;

    /// <summary>
    /// Additional data for the message
    /// </summary>
    public Dictionary<string, object>? Data { get; set; }
}

/// <summary>
/// Summary DTO for user notifications
/// </summary>
public class NotificationDto
{
    /// <summary>
    /// Notification ID
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// Title of the notification
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Message content
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Type: info, warning, error, success, alert
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Priority: low, normal, high, urgent
    /// </summary>
    public string Priority { get; set; } = string.Empty;

    /// <summary>
    /// When the notification was created
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Whether the user has read this notification
    /// </summary>
    public bool IsRead { get; set; }

    /// <summary>
    /// Channels through which this notification was received
    /// </summary>
    public List<string> ReceivedVia { get; set; } = new();
}

/// <summary>
/// Detailed DTO with channel information
/// </summary>
public class NotificationDetailDto : NotificationDto
{
    /// <summary>
    /// List of channels and their status
    /// </summary>
    public List<NotificationChannelDto> Channels { get; set; } = new();

    /// <summary>
    /// Template ID used (if any)
    /// </summary>
    public string? TemplateId { get; set; }
}

/// <summary>
/// Channel delivery status
/// </summary>
public class NotificationChannelDto
{
    /// <summary>
    /// Type of channel
    /// </summary>
    public string ChannelType { get; set; } = string.Empty;

    /// <summary>
    /// Delivery status: pending, sent, failed, retrying
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Recipient address/ID
    /// </summary>
    public string Recipient { get; set; } = string.Empty;

    /// <summary>
    /// When it was sent (null if not sent yet)
    /// </summary>
    public DateTime? SentAt { get; set; }
}

/// <summary>
/// Request to mark a notification as read
/// </summary>
public class MarkReadRequest
{
    /// <summary>
    /// User ID marking the notification as read
    /// </summary>
    [Required]
    public int UserId { get; set; }
}

/// <summary>
/// Request to test a notification channel
/// </summary>
public class TestNotificationRequest
{
    /// <summary>
    /// Channel type to test
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string ChannelType { get; set; } = string.Empty;

    /// <summary>
    /// User IDs to send test to (optional, defaults to current user if not provided)
    /// </summary>
    public List<int>? UserIds { get; set; }

    /// <summary>
    /// Role names to send test to (optional)
    /// </summary>
    public List<string>? RoleNames { get; set; }
}
