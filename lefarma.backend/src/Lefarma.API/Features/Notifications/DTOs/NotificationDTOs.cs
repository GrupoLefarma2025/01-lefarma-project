using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.Notifications.DTOs;

public class SseTicketResponse
{
    public string Ticket { get; set; } = string.Empty;
}

public class SendNotificationRequest
{
    [Required]
    public List<NotificationChannelRequest> Channels { get; set; } = new();

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Message { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Type { get; set; } = "info";

    [MaxLength(20)]
    public string Priority { get; set; } = "normal";

    [MaxLength(100)]
    public string Category { get; set; } = "system";

    [MaxLength(100)]
    public string? TemplateId { get; set; }

    public Dictionary<string, object>? TemplateData { get; set; }

    public DateTime? ScheduledFor { get; set; }

    public DateTime? ExpiresAt { get; set; }
}

public class NotificationChannelRequest
{
    [Required]
    [MaxLength(50)]
    public string ChannelType { get; set; } = string.Empty;

    public List<int>? UserIds { get; set; }

    public List<string>? RoleNames { get; set; }

    public List<string>? Emails { get; set; }

    public Dictionary<string, object>? ChannelSpecificData { get; set; }
}

public class BulkNotificationRequest : SendNotificationRequest
{
    [Required]
    public List<int> UserIds { get; set; } = new();
}

public class RoleNotificationRequest : SendNotificationRequest
{
    [Required]
    public List<string> Roles { get; set; } = new();
}

public class SendNotificationResponse
{
    public int NotificationId { get; set; }

    public Dictionary<string, ChannelResult> ChannelResults { get; set; } = new();

    public DateTime CreatedAt { get; set; }
}

public class ChannelResult
{
    public bool Success { get; set; }

    public string? Message { get; set; }

    public List<string>? SentRecipients { get; set; }

    public List<string>? FailedRecipients { get; set; }

    public string? ExternalId { get; set; }
}

public class NotificationMessage
{
    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Recipients { get; set; } = string.Empty;

    public Dictionary<string, object>? Data { get; set; }
}

public class NotificationDto
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public string Priority { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public bool IsRead { get; set; }

    public List<string> ReceivedVia { get; set; } = new();
}

public class NotificationDetailDto : NotificationDto
{
    public List<NotificationChannelDto> Channels { get; set; } = new();

    public string? TemplateId { get; set; }
}

public class NotificationChannelDto
{
    public string ChannelType { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Recipient { get; set; } = string.Empty;

    public DateTime? SentAt { get; set; }
}

public class MarkReadRequest
{
    [Required]
    public int UserId { get; set; }
}

public class TestNotificationRequest
{
    [Required]
    [MaxLength(50)]
    public string ChannelType { get; set; } = string.Empty;

    public List<int>? UserIds { get; set; }

    public List<string>? RoleNames { get; set; }
}
