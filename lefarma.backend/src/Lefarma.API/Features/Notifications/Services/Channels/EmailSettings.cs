namespace Lefarma.API.Features.Notifications.Services.Channels;
public class EmailSettings
{
    public string SmtpServer { get; set; } = string.Empty;

    public int SmtpPort { get; set; } = 587;

    public string SmtpUser { get; set; } = string.Empty;

    public string SmtpPassword { get; set; } = string.Empty;

    public string FromEmail { get; set; } = string.Empty;

    public string FromName { get; set; } = string.Empty;

    public bool UseSsl { get; set; } = true;

    public bool AcceptInvalidCertificates { get; set; } = false;

    public int Timeout { get; set; } = 30000;
}
