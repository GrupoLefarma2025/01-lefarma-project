namespace Lefarma.API.Shared.Models.Configuracion
{
    public class BackendConfigResponse
    {
        public required JwtSettingsPublic Jwt { get; set; }
        public required EmailSettingsPublic Email { get; set; }
        public required TelegramSettingsPublic Telegram { get; set; }
    }

    public class JwtSettingsPublic
    {
        public int ExpirationMinutes { get; set; }
        public required string Issuer { get; set; }
        public required string Audience { get; set; }
    }

    public class EmailSettingsPublic
    {
        public required string SmtpServer { get; set; }
        public int SmtpPort { get; set; }
        public required string FromEmail { get; set; }
        public required string FromName { get; set; }
        public bool EnableSSL { get; set; }
    }

    public class TelegramSettingsPublic
    {
        public required string ApiUrl { get; set; }
    }
}
