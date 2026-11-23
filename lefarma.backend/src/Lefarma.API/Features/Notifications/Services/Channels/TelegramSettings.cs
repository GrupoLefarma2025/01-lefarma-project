namespace Lefarma.API.Features.Notifications.Services.Channels;
public class TelegramSettings
{
    public string BotToken { get; set; } = string.Empty;

    public string ApiUrl { get; set; } = "https://api.telegram.org/bot";

    public int Timeout { get; set; } = 30000;

    public string? DefaultParseMode { get; set; }
}
