namespace Lefarma.API.Features.Notifications.Services.Channels;

/// <summary>
/// Configuration settings for email notification channel.
/// Maps to EmailSettings section in appsettings.json.
/// </summary>
public class EmailSettings
{
    /// <summary>
    /// SMTP server host address (e.g., smtp.gmail.com, mail.grupolefarma.com.mx)
    /// </summary>
    public string SmtpServer { get; set; } = string.Empty;

    /// <summary>
    /// SMTP server port (typically 587 for TLS, 465 for SSL, 25 for non-secure)
    /// </summary>
    public int SmtpPort { get; set; } = 587;

    /// <summary>
    /// Username for SMTP authentication
    /// </summary>
    public string SmtpUser { get; set; } = string.Empty;

    /// <summary>
    /// Password for SMTP authentication
    /// </summary>
    public string SmtpPassword { get; set; } = string.Empty;

    /// <summary>
    /// From email address for sent emails
    /// </summary>
    public string FromEmail { get; set; } = string.Empty;

    /// <summary>
    /// From display name for sent emails
    /// </summary>
    public string FromName { get; set; } = string.Empty;

    /// <summary>
    /// Whether to use SSL/TLS for the connection
    /// </summary>
    public bool UseSsl { get; set; } = true;

    /// <summary>
    /// Accept SSL certificates that cannot be validated (e.g., self-signed certificates).
    /// WARNING: Only enable this for development or internal corporate SMTP servers.
    /// </summary>
    public bool AcceptInvalidCertificates { get; set; } = false;

    /// <summary>
    /// Connection timeout in milliseconds
    /// </summary>
    public int Timeout { get; set; } = 30000;
}
