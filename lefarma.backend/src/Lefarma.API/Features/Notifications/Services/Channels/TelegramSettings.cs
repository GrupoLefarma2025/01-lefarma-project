namespace Lefarma.API.Features.Notifications.Services.Channels;
/// <summary>
/// Configuration settings for Telegram notification channel.
/// Maps to TelegramSettings section in appsettings.json.
/// </summary>
public class TelegramSettings
{
    /// <summary>
    /// Telegram Bot Token obtained from BotFather.
    /// Format: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
    /// </summary>
    public string BotToken { get; set; } = string.Empty;

    /// <summary>
    /// Base URL for Telegram Bot API.
    /// Default: "https://api.telegram.org/bot"
    /// </summary>
    public string ApiUrl { get; set; } = "https://api.telegram.org/bot";

    /// <summary>
    /// Request timeout in milliseconds.
    /// Default: 30000 (30 seconds)
    /// </summary>
    public int Timeout { get; set; } = 30000;

    /// <summary>
    /// Default parse mode for messages.
    /// Options: "Markdown", "MarkdownV2", "HTML", null (plain text)
    /// Default: null (plain text)
    /// </summary>
    public string? DefaultParseMode { get; set; }
}
