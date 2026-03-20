using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using System.Globalization;

namespace Lefarma.API.Features.Notifications.Services.Channels;

/// <summary>
/// Email notification channel implementation using MailKit.
/// Supports HTML templates, multiple recipients, CC/BCC, and SMTP authentication.
/// </summary>
public class EmailNotificationChannel : INotificationChannel
{
    private readonly EmailSettings _settings;
    private readonly ITemplateService _templateService;
    private readonly ILogger<EmailNotificationChannel> _logger;

    /// <inheritdoc/>
    public string ChannelType => "email";

    public EmailNotificationChannel(
        EmailSettings settings,
        ITemplateService templateService,
        ILogger<EmailNotificationChannel> logger)
    {
        _settings = settings ?? throw new ArgumentNullException(nameof(settings));
        _templateService = templateService ?? throw new ArgumentNullException(nameof(templateService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc/>
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
            // Validate configuration
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

            // Parse recipients
            var recipients = ParseRecipients(message.Recipients);
            if (recipients.Count == 0)
            {
                _logger.LogWarning("No valid recipients found in: {Recipients}", message.Recipients);
                result.Message = "No valid recipients found";
                return result;
            }

            // Create email message
            var emailMessage = new MimeMessage();
            emailMessage.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));

            // Add recipients
            foreach (var recipient in recipients)
            {
                emailMessage.To.Add(new MailboxAddress(string.Empty, recipient));
            }

            // Add CC if provided in channel data
            if (message.Data != null && message.Data.TryGetValue("cc", out var ccObj))
            {
                var ccRecipients = ParseRecipients(ccObj.ToString() ?? string.Empty);
                foreach (var ccRecipient in ccRecipients)
                {
                    emailMessage.Cc.Add(new MailboxAddress(string.Empty, ccRecipient));
                }
            }

            // Add BCC if provided in channel data
            if (message.Data != null && message.Data.TryGetValue("bcc", out var bccObj))
            {
                var bccRecipients = ParseRecipients(bccObj.ToString() ?? string.Empty);
                foreach (var bccRecipient in bccRecipients)
                {
                    emailMessage.Bcc.Add(new MailboxAddress(string.Empty, bccRecipient));
                }
            }

            // Set subject
            emailMessage.Subject = message.Title;

            // Build email body
            var bodyBuilder = new BodyBuilder();

            // Check if we should use a template
            string htmlBody;
            if (message.Data != null &&
                message.Data.TryGetValue("templateId", out var templateIdObj) &&
                !string.IsNullOrWhiteSpace(templateIdObj?.ToString()))
            {
                // Render template
                var templateId = templateIdObj.ToString()!;
                var templateData = message.Data.TryGetValue("templateData", out var dataObj)
                    ? dataObj as Dictionary<string, object> ?? new Dictionary<string, object>()
                    : new Dictionary<string, object>();

                _logger.LogDebug("Rendering email template: {TemplateId}", templateId);
                htmlBody = await _templateService.RenderAsync(templateId, templateData, ct);
            }
            else
            {
                // Use message body as-is (assuming HTML)
                htmlBody = message.Body;
            }

            bodyBuilder.HtmlBody = htmlBody;

            // Add plain text version if provided
            if (message.Data != null && message.Data.TryGetValue("plainText", out var plainTextObj))
            {
                bodyBuilder.TextBody = plainTextObj.ToString();
            }
            else
            {
                // Generate basic plain text from HTML
                bodyBuilder.TextBody = StripHtml(htmlBody);
            }

            emailMessage.Body = bodyBuilder.ToMessageBody();

            // Send email via SMTP
            using var client = new SmtpClient();
            client.Timeout = _settings.Timeout;

            try
            {
                _logger.LogDebug("Connecting to SMTP server: {Server}:{Port}", _settings.SmtpServer, _settings.SmtpPort);

                // Connect to SMTP server
                var secureSocketOptions = _settings.UseSsl
                    ? SecureSocketOptions.StartTls
                    : SecureSocketOptions.None;

                await client.ConnectAsync(_settings.SmtpServer, _settings.SmtpPort, secureSocketOptions, ct);

                // Authenticate if credentials provided
                if (!string.IsNullOrWhiteSpace(_settings.SmtpUser) && !string.IsNullOrWhiteSpace(_settings.SmtpPassword))
                {
                    _logger.LogDebug("Authenticating to SMTP server as: {User}", _settings.SmtpUser);
                    await client.AuthenticateAsync(_settings.SmtpUser, _settings.SmtpPassword, ct);
                }

                // Send message
                _logger.LogDebug("Sending email message");
                var smtpResponse = await client.SendAsync(emailMessage, ct);

                _logger.LogInformation("Email sent successfully. Response: {Response}", smtpResponse.Response);

                // Disconnect
                await client.DisconnectAsync(true, ct);

                // Mark all recipients as successfully sent
                result.SentRecipients = recipients;
                result.Success = true;
                result.Message = "Email sent successfully";
                result.ExternalId = smtpResponse.MessageId;

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email via SMTP");

                // On failure, mark all recipients as failed
                result.FailedRecipients = recipients;
                result.Message = $"Failed to send email: {ex.Message}";

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

    /// <inheritdoc/>
    public Task<bool> ValidateRecipientsAsync(string recipients, CancellationToken ct = default)
    {
        try
        {
            var emailList = ParseRecipients(recipients);

            if (emailList.Count == 0)
            {
                return Task.FromResult(false);
            }

            // Basic email validation using MailKit's parser
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

    /// <summary>
    /// Parses semicolon-separated recipients string into a list of email addresses.
    /// </summary>
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

    /// <summary>
    /// Strips HTML tags from a string to generate plain text.
    /// Simple implementation for fallback plain text generation.
    /// </summary>
    private static string StripHtml(string html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        // Remove HTML tags
        var plainText = System.Text.RegularExpressions.Regex.Replace(html, "<[^>]*>", string.Empty);

        // Decode HTML entities
        plainText = System.Net.WebUtility.HtmlDecode(plainText);

        // Clean up whitespace
        var lines = plainText.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        plainText = string.Join(Environment.NewLine, lines.Select(line => line.Trim()));

        return plainText.Trim();
    }
}
