using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Features.Notifications.Services.Channels;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Options;
using System.Globalization;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;

namespace Lefarma.API.Features.Notifications.Services.Channels;
public class EmailNotificationChannel : INotificationChannel
{
    private readonly EmailSettings _settings;
    private readonly ITemplateService _templateService;
    private readonly ILogger<EmailNotificationChannel> _logger;

    public string ChannelType => "email";

    public EmailNotificationChannel(
        IOptions<EmailSettings> settings,
        ITemplateService templateService,
        ILogger<EmailNotificationChannel> logger)
    {
        _settings = settings?.Value ?? throw new ArgumentNullException(nameof(settings));
        _templateService = templateService ?? throw new ArgumentNullException(nameof(templateService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<ChannelResult> SendAsync(NotificationMessage message, CancellationToken ct = default)
    {
        _logger.LogInformation("Sending email notification to {Recipients}", message.Recipients);

        var result = new ChannelResult
        {
            Success = false,
            SentRecipients = new List<string>(),
            FailedRecipients = new List<string>()
        };

        try
        {
            if (string.IsNullOrWhiteSpace(_settings.SmtpServer))
            {
                _logger.LogError("SMTP server is not configured");
                result.Message = "SMTP server is not configured";
                return result;
            }

            if (string.IsNullOrWhiteSpace(_settings.FromEmail))
            {
                _logger.LogError("From email is not configured");
                result.Message = "From email is not configured";
                return result;
            }

            var recipients = ParseRecipients(message.Recipients);
            if (recipients.Count == 0)
            {
                _logger.LogWarning("No valid recipients found in: {Recipients}", message.Recipients);
                result.Message = "No valid recipients found";
                return result;
            }

            var emailMessage = new MimeMessage();

            var fromName = message.Data != null && message.Data.TryGetValue("fromName", out var fromNameObj)
                && fromNameObj?.ToString() is { Length: > 0 } overrideName
                ? overrideName
                : _settings.FromName;
            emailMessage.From.Add(new MailboxAddress(fromName, _settings.FromEmail));

            foreach (var recipient in recipients)
            {
                emailMessage.To.Add(new MailboxAddress(string.Empty, recipient));
            }

            if (message.Data != null && message.Data.TryGetValue("cc", out var ccObj))
            {
                var ccRecipients = ParseRecipients(ccObj.ToString() ?? string.Empty);
                foreach (var ccRecipient in ccRecipients)
                {
                    emailMessage.Cc.Add(new MailboxAddress(string.Empty, ccRecipient));
                }
            }

            if (message.Data != null && message.Data.TryGetValue("bcc", out var bccObj))
            {
                var bccRecipients = ParseRecipients(bccObj.ToString() ?? string.Empty);
                foreach (var bccRecipient in bccRecipients)
                {
                    emailMessage.Bcc.Add(new MailboxAddress(string.Empty, bccRecipient));
                }
            }

            emailMessage.Subject = message.Title;

            var bodyBuilder = new BodyBuilder();

            string htmlBody;
            if (message.Data != null &&
                message.Data.TryGetValue("templateId", out var templateIdObj) &&
                !string.IsNullOrWhiteSpace(templateIdObj?.ToString()))
            {
                var templateId = templateIdObj.ToString()!;
                var templateData = message.Data.TryGetValue("templateData", out var dataObj)
                    ? dataObj as Dictionary<string, object> ?? new Dictionary<string, object>()
                    : new Dictionary<string, object>();

                _logger.LogDebug("Rendering email template: {TemplateId}", templateId);
                htmlBody = await _templateService.RenderAsync(templateId, templateData, ct);
            }
            else
            {
                htmlBody = message.Body;
            }

            bodyBuilder.HtmlBody = htmlBody;

            if (message.Data != null && message.Data.TryGetValue("plainText", out var plainTextObj))
            {
                bodyBuilder.TextBody = plainTextObj.ToString();
            }
            else
            {
                bodyBuilder.TextBody = StripHtml(htmlBody);
            }

            if (message.Data != null && message.Data.TryGetValue("attachments", out var attachmentsObj))
            {
                AdjuntarArchivos(bodyBuilder, attachmentsObj);
            }

            emailMessage.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            client.Timeout = _settings.Timeout;

            client.ServerCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) =>
            {
                if (_settings.AcceptInvalidCertificates)
                {
                    _logger.LogWarning("Accepting potentially invalid SSL certificate (AcceptInvalidCertificates=true)");
                    return true;
                }

                if (sslPolicyErrors == SslPolicyErrors.None)
                {
                    return true;
                }

                _logger.LogError("SSL Certificate validation failed: {SslPolicyErrors}", sslPolicyErrors);
                return false;
            };

            try
            {
                _logger.LogInformation("Connecting to SMTP server: {Server}:{Port} (SSL: {UseSsl})", _settings.SmtpServer, _settings.SmtpPort, _settings.UseSsl);

                SecureSocketOptions secureSocketOptions;

                if (!_settings.UseSsl)
                {
                    secureSocketOptions = SecureSocketOptions.None;
                    _logger.LogDebug("Using unencrypted connection");
                }
                else if (_settings.SmtpPort == 465)
                {
                    secureSocketOptions = SecureSocketOptions.SslOnConnect;
                    _logger.LogDebug("Using SSL implicit (port 465)");
                }
                else
                {
                    secureSocketOptions = SecureSocketOptions.StartTls;
                    _logger.LogDebug("Using STARTTLS (port {Port})", _settings.SmtpPort);
                }

                await client.ConnectAsync(_settings.SmtpServer, _settings.SmtpPort, secureSocketOptions, ct);
                _logger.LogInformation("Successfully connected to SMTP server");

                if (!string.IsNullOrWhiteSpace(_settings.SmtpUser) && !string.IsNullOrWhiteSpace(_settings.SmtpPassword))
                {
                    _logger.LogInformation("Authenticating to SMTP server as: {User}", _settings.SmtpUser);
                    await client.AuthenticateAsync(_settings.SmtpUser, _settings.SmtpPassword, ct);
                    _logger.LogInformation("SMTP authentication successful");
                }
                else
                {
                    _logger.LogWarning("No SMTP credentials provided, attempting anonymous send");
                }

                _logger.LogDebug("Sending email message");
                var smtpResponse = await client.SendAsync(emailMessage, ct);

                _logger.LogInformation("Email sent successfully. Server response: {Response}", smtpResponse);

                await client.DisconnectAsync(true, ct);

                result.SentRecipients = recipients;
                result.Success = true;
                result.Message = "Email sent successfully";
                result.ExternalId = emailMessage.MessageId;

                return result;
            }
            catch (AuthenticationException ex)
            {
                _logger.LogError(ex, "SMTP authentication failed for user {User}. Check credentials.", _settings.SmtpUser);
                result.FailedRecipients = recipients;
                result.Message = $"SMTP authentication failed: {ex.Message}";
                return result;
            }
            catch (MailKit.Security.SslHandshakeException ex)
            {
                _logger.LogError(ex, "SSL/TLS handshake failed with {Server}:{Port}. If using self-signed certificates, set AcceptInvalidCertificates=true.", _settings.SmtpServer, _settings.SmtpPort);
                result.FailedRecipients = recipients;
                result.Message = $"SSL/TLS handshake failed: {ex.Message}. If using self-signed certificates, set AcceptInvalidCertificates=true in EmailSettings.";
                return result;
            }
            catch (MailKit.ServiceNotConnectedException ex)
            {
                _logger.LogError(ex, "SMTP connection failed to {Server}:{Port}", _settings.SmtpServer, _settings.SmtpPort);
                result.FailedRecipients = recipients;
                result.Message = $"Failed to connect to SMTP server: {ex.Message}";
                return result;
            }
            catch (MailKit.ProtocolException ex)
            {
                _logger.LogError(ex, "SMTP protocol error with {Server}:{Port}", _settings.SmtpServer, _settings.SmtpPort);
                result.FailedRecipients = recipients;
                result.Message = $"SMTP protocol error: {ex.Message}";
                return result;
            }
            catch (IOException ex)
            {
                _logger.LogError(ex, "Network I/O error while sending email to {Server}:{Port}", _settings.SmtpServer, _settings.SmtpPort);
                result.FailedRecipients = recipients;
                result.Message = $"Network error: {ex.Message}";
                return result;
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Email sending operation was cancelled (timeout or cancellation token)");
                result.FailedRecipients = recipients;
                result.Message = "Operation cancelled or timed out";
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error sending email via SMTP to {Recipients}", message.Recipients);
                result.FailedRecipients = recipients;
                result.Message = $"Unexpected error: {ex.Message}";
                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing email notification");

            result.Message = $"Error processing email notification: {ex.Message}";
            result.FailedRecipients = ParseRecipients(message.Recipients);

            return result;
        }
    }

    public Task<bool> ValidateRecipientsAsync(string recipients, CancellationToken ct = default)
    {
        try
        {
            var emailList = ParseRecipients(recipients);

            if (emailList.Count == 0)
            {
                return Task.FromResult(false);
            }

            foreach (var email in emailList)
            {
                try
                {
                    var mailboxAddress = new MailboxAddress(string.Empty, email);
                    if (string.IsNullOrWhiteSpace(mailboxAddress.Address))
                    {
                        return Task.FromResult(false);
                    }
                }
                catch
                {
                    return Task.FromResult(false);
                }
            }

            return Task.FromResult(true);
        }
        catch
        {
            return Task.FromResult(false);
        }
    }

    private static List<string> ParseRecipients(string recipients)
    {
        if (string.IsNullOrWhiteSpace(recipients))
        {
            return new List<string>();
        }

        return recipients
            .Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(email => email.Trim())
            .Where(email => !string.IsNullOrWhiteSpace(email))
            .Distinct()
            .ToList();
    }

    private static string StripHtml(string html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        var plainText = System.Text.RegularExpressions.Regex.Replace(html, "<[^>]*>", string.Empty);

        plainText = System.Net.WebUtility.HtmlDecode(plainText);

        var lines = plainText.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        plainText = string.Join(Environment.NewLine, lines.Select(line => line.Trim()));

        return plainText.Trim();
    }

    private void AdjuntarArchivos(BodyBuilder bodyBuilder, object? valor)
    {
        switch (valor)
        {
            case null:
                return;
            case NotificationAttachment adjunto:
                AgregarAdjunto(bodyBuilder, adjunto);
                return;
            case string ruta:
                AgregarAdjuntoDesdeRuta(bodyBuilder, ruta);
                return;
            case System.Collections.IEnumerable elementos:
                foreach (var elemento in elementos)
                {
                    switch (elemento)
                    {
                        case NotificationAttachment adjunto:
                            AgregarAdjunto(bodyBuilder, adjunto);
                            break;
                        case string rutaElemento:
                            AgregarAdjuntoDesdeRuta(bodyBuilder, rutaElemento);
                            break;
                    }
                }
                return;
        }

        _logger.LogWarning("Data[\"attachments\"] con un tipo no soportado: {Tipo}", valor.GetType().Name);
    }

    private static void AgregarAdjunto(BodyBuilder bodyBuilder, NotificationAttachment adjunto)
    {
        if (adjunto.Content is not { Length: > 0 })
        {
            return;
        }

        var content = new MemoryStream(adjunto.Content, writable: false);
        var nombre = string.IsNullOrWhiteSpace(adjunto.FileName) ? "adjunto.pdf" : adjunto.FileName;

        ContentType tipoContenido;
        try
        {
            tipoContenido = ContentType.Parse(string.IsNullOrWhiteSpace(adjunto.ContentType) ? "application/pdf" : adjunto.ContentType);
        }
        catch (FormatException)
        {
            tipoContenido = new ContentType("application", "pdf");
        }

        bodyBuilder.Attachments.Add(nombre, content, tipoContenido);
    }

    private void AgregarAdjuntoDesdeRuta(BodyBuilder bodyBuilder, string ruta)
    {
        try
        {
            if (!File.Exists(ruta))
            {
                _logger.LogWarning("No se adjuntó el archivo {Ruta}: no existe", ruta);
                return;
            }

            bodyBuilder.Attachments.Add(Path.GetFileName(ruta), File.ReadAllBytes(ruta));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo adjuntar el archivo {Ruta}", ruta);
        }
    }
}

public sealed record NotificationAttachment(string FileName, byte[] Content, string? ContentType = "application/pdf");
