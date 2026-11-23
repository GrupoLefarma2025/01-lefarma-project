using System.Collections.Concurrent;

namespace Lefarma.API.Features.Auth;

public class SseTicketService : ISseTicketService
{
    private static readonly TimeSpan VigenciaTicket = TimeSpan.FromMinutes(5);

    private readonly ConcurrentDictionary<string, TicketSse> _tickets = new();
    private readonly ILogger<SseTicketService> _logger;

    public SseTicketService(ILogger<SseTicketService> logger)
    {
        _logger = logger;
    }

    public string GenerateTicket(int userId)
    {
        PurgarExpirados();

        var ticket = Guid.NewGuid().ToString("N"); 
        _tickets[ticket] = new TicketSse(userId, DateTime.UtcNow.Add(VigenciaTicket));

        _logger.LogDebug("Generated SSE ticket for user {UserId}", userId);
        return ticket;
    }

    public int? ValidateAndConsumeTicket(string ticket)
    {
        if (string.IsNullOrWhiteSpace(ticket))
            return null;

        if (!_tickets.TryRemove(ticket, out var entrada))
        {
            _logger.LogWarning("SSE ticket not found or already consumed");
            return null;
        }

        if (entrada.ExpiraEn <= DateTime.UtcNow)
        {
            _logger.LogWarning("SSE ticket expired for user {UserId}", entrada.UserId);
            return null;
        }

        _logger.LogDebug("SSE ticket validated for user {UserId}", entrada.UserId);
        return entrada.UserId;
    }

    private void PurgarExpirados()
    {
        var ahora = DateTime.UtcNow;

        foreach (var par in _tickets)
        {
            if (par.Value.ExpiraEn <= ahora)
            {
                _tickets.TryRemove(par.Key, out _);
            }
        }
    }

    private readonly record struct TicketSse(int UserId, DateTime ExpiraEn);
}
