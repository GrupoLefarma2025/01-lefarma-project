using System.Text;
using System.Text.Json;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;

namespace Lefarma.API.Features.Notifications.Services.Channels;

/// <summary>
/// Telegram notification channel implementation using HttpClient.
/// Supports multiple recipients, Markdown/HTML formatting, and message tracking.
/// </summary>
public class TelegramNotificationChannel : INotificationChannel
{
    private readonly TelegramSettings _settings;
    private readonly HttpClient _httpClient;
    private readonly ILogger<TelegramNotificationChannel> _logger;

    /// <inheritdoc/>
    public string ChannelType => "telegram";

    public TelegramNotificationChannel(
        TelegramSettings settings,
        IHttpClientFactory httpClientFactory,
        ILogger<TelegramNotificationChannel> logger)
    {
        _settings = settings ?? throw new ArgumentNullException(nameof(settings));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        // Create HttpClient with configured timeout
        _httpClient = httpClientFactory.CreateClient();
        _httpClient.Timeout = TimeSpan.FromMilliseconds(_settings.Timeout);
    }

    /// <inheritdoc/>
    public async Task<ChannelResult> SendAsync(NotificationMessage message, CancellationToken ct = default)
    {
        _logger.LogInformation("Sending Telegram notification to {Recipients}", message.Recipients);

        var result = new ChannelResult
        {
            Success = false,
            SentRecipients = new List<string>(),
            FailedRecipients = new List<string>()
        };

        try
        {
            // Validate configuration
            if (string.IsNullOrWhiteSpace(_settings.BotToken))
            {
                _logger.LogError("Telegram BotToken is not configured");
                result.Message = "Telegram BotToken is not configured";
                return result;
            }

            // Parse recipients (chat IDs)
            var chatIds = ParseChatIds(message.Recipients);
            if (chatIds.Count == 0)
            {
                _logger.LogWarning("No valid chat IDs found in: {Recipients}", message.Recipients);
                result.Message = "No valid chat IDs found";
                return result;
            }

            // Determine parse mode
            var parseMode = _settings.DefaultParseMode;
            if (message.Data != null && message.Data.TryGetValue("parseMode", out var parseModeObj))
            {
                parseMode = parseModeObj?.ToString();
            }

            // Send message to each chat ID
            foreach (var chatId in chatIds)
            {
                try
                {
                    var messageId = await SendMessageAsync(
                        chatId,
                        message.Body,
                        parseMode,
                        ct);

                    if (messageId.HasValue)
                    {
                        result.SentRecipients.Add(chatId);
                        _logger.LogDebug("Telegram message sent successfully to chat {ChatId}, message_id: {MessageId}",
                            chatId, messageId);

                        // Store the message_id from the first successful recipient
                        if (string.IsNullOrWhiteSpace(result.ExternalId))
                        {
                            result.ExternalId = messageId.ToString();
                        }
                    }
                    else
                    {
                        result.FailedRecipients.Add(chatId);
                        _logger.LogWarning("Failed to send Telegram message to chat {ChatId}", chatId);
                    }
                }
                catch (Exception ex)
                {
                    result.FailedRecipients.Add(chatId);
                    _logger.LogError(ex, "Error sending Telegram message to chat {ChatId}", chatId);
                }
            }

            // Determine overall success
            result.Success = result.SentRecipients.Count > 0;
            result.Message = result.Success
                ? $"Telegram messages sent to {result.SentRecipients.Count} recipient(s)"
                : "Failed to send Telegram messages to any recipient";

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Telegram notification");

            result.Message = $"Error processing Telegram notification: {ex.Message}";
            result.FailedRecipients = ParseChatIds(message.Recipients);

            return result;
        }
    }

    /// <inheritdoc/>
    public Task<bool> ValidateRecipientsAsync(string recipients, CancellationToken ct = default)
    {
        try
        {
            var chatIds = ParseChatIds(recipients);

            if (chatIds.Count == 0)
            {
                return Task.FromResult(false);
            }

            // Validate that each chat ID is a valid number or username
            foreach (var chatId in chatIds)
            {
                // Chat ID can be:
                // 1. Numeric string (e.g., "123456789")
                // 2. Username (e.g., "@username")
                // 3. Channel username (e.g., "@channelname")

                if (!IsValidChatId(chatId))
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
    /// Sends a message to a specific Telegram chat.
    /// </summary>
    /// <param name="chatId">Target chat ID (numeric or username)</param>
    /// <param name="text">Message text</param>
    /// <param name="parseMode">Optional parse mode (Markdown, MarkdownV2, HTML)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Message ID if successful, null otherwise</returns>
    private async Task<long?> SendMessageAsync(
        string chatId,
        string text,
        string? parseMode,
        CancellationToken ct)
    {
        var apiUrl = $"{_settings.ApiUrl}{_settings.BotToken}/sendMessage";

        // Build request payload
        var payload = new Dictionary<string, object>
        {
            ["chat_id"] = chatId,
            ["text"] = text
        };

        // Add parse_mode if specified
        if (!string.IsNullOrWhiteSpace(parseMode))
        {
            payload["parse_mode"] = parseMode;
        }

        // Disable link preview by default (can be overridden in channel data)
        var disableWebPagePreview = true;
        payload["disable_web_page_preview"] = disableWebPagePreview;

        // Serialize payload
        var jsonPayload = JsonSerializer.Serialize(payload);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        // Send request
        var response = await _httpClient.PostAsync(apiUrl, content, ct);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Telegram API error: {StatusCode}, Content: {Content}",
                response.StatusCode, errorContent);
            return null;
        }

        // Parse response
        var responseContent = await response.Content.ReadAsStringAsync(ct);
        var telegramResponse = JsonSerializer.Deserialize<TelegramResponse>(responseContent);

        if (telegramResponse?.Ok == true && telegramResponse.Result != null)
        {
            return telegramResponse.Result.MessageId;
        }

        _logger.LogError("Telegram API returned unsuccessful response: {Response}", responseContent);
        return null;
    }

    /// <summary>
    /// Parses semicolon-separated recipients string into a list of chat IDs.
    /// </summary>
    private static List<string> ParseChatIds(string recipients)
    {
        if (string.IsNullOrWhiteSpace(recipients))
        {
            return new List<string>();
        }

        return recipients
            .Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(chatId => chatId.Trim())
            .Where(chatId => !string.IsNullOrWhiteSpace(chatId))
            .Distinct()
            .ToList();
    }

    /// <summary>
    /// Validates if a chat ID is in a valid format.
    /// </summary>
    private static bool IsValidChatId(string chatId)
    {
        if (string.IsNullOrWhiteSpace(chatId))
        {
            return false;
        }

        // Check if it's a username (starts with @)
        if (chatId.StartsWith("@"))
        {
            // Username must be at least 2 characters after @
            return chatId.Length >= 2;
        }

        // Check if it's a numeric chat ID
        if (long.TryParse(chatId, out _))
        {
            return true;
        }

        return false;
    }

    /// <summary>
    /// Telegram API response structure.
    /// </summary>
    private class TelegramResponse
    {
        public bool Ok { get; set; }
        public TelegramMessageResult? Result { get; set; }
        public int? ErrorCode { get; set; }
        public string? Description { get; set; }
    }

    /// <summary>
    /// Telegram message result structure.
    /// </summary>
    private class TelegramMessageResult
    {
        public long MessageId { get; set; }
        public object? From { get; set; }
        public object? Chat { get; set; }
        public long? Date { get; set; }
        public string? Text { get; set; }
    }
}
