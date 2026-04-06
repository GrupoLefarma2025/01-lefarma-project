namespace Lefarma.API.Domain.Interfaces;
/// <summary>
/// Defines the supported template types for notification rendering.
/// Each type corresponds to a specific format optimized for different notification channels.
/// </summary>
public enum TemplateType
{
    /// <summary>
    /// HTML template format for email notifications.
    /// Supports rich text formatting, images, and styling.
    /// </summary>
    Html,

    /// <summary>
    /// Plain text template format for Telegram messages and SMS.
    /// Simple text without formatting or markup.
    /// </summary>
    Text,

    /// <summary>
    /// JSON template format for complex structured data.
    /// Used for API-based notifications and advanced formatting requirements.
    /// </summary>
    Json
}
