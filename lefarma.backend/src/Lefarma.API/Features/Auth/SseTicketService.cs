using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.Auth;

public class SseTicketService : ISseTicketService
{
    private readonly IMemoryCache _cache;
    private readonly ILogger<SseTicketService> _logger;

    public SseTicketService(IMemoryCache cache, ILogger<SseTicketService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public string GenerateTicket(int userId)
    {
        var ticket = Guid.NewGuid().ToString("N"); // 32 chars, no hyphens
        var cacheKey = $"sse-ticket:{ticket}";

        _cache.Set(cacheKey, userId, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30),
            SlidingExpiration = TimeSpan.FromSeconds(10)
        });

        _logger.LogDebug("Generated SSE ticket for user {UserId}", userId);
        return ticket;
    }

    public int? ValidateAndConsumeTicket(string ticket)
    {
        if (string.IsNullOrWhiteSpace(ticket))
            return null;

        var cacheKey = $"sse-ticket:{ticket}";

        if (_cache.TryGetValue(cacheKey, out int userId))
        {
            _cache.Remove(cacheKey);
            _logger.LogDebug("SSE ticket consumed for user {UserId}", userId);
            return userId;
        }

        _logger.LogWarning("SSE ticket not found or expired: {Ticket}", ticket);
        return null;
    }
}
