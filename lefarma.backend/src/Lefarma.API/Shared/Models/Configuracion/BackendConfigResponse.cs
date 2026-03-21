namespace Lefarma.API.Shared.Models.Configuracion
{
    public class BackendConfigResponse
    {
        public JwtSettingsPublic Jwt { get; set; }
        public EmailSettingsPublic Email { get; set; }
        public TelegramSettingsPublic Telegram { get; set; }
    }

    public class JwtSettingsPublic
    {
        public int ExpirationMinutes { get; set; }
        public string Issuer { get; set; }
        public string Audience { get; set; }
    }

    public class EmailSettingsPublic
    {
        public string SmtpServer { get; set; }
        public int SmtpPort { get; set; }
        public string FromEmail { get; set; }
        public string FromName { get; set; }
        public bool EnableSSL { get; set; }
    }

    public class TelegramSettingsPublic
    {
        public string ApiUrl { get; set; }
    }
}
