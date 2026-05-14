namespace Lefarma.API.Features.Auth;

/// <summary>
/// Service for generating and validating short-lived SSE connection tickets.
/// Tickets replace full JWT tokens in SSE URLs to avoid exceeding URL length limits
/// for users with many permissions (admin users with 50+ permission claims).
/// </summary>
public interface ISseTicketService
{
    /// <summary>
    /// Generates a short-lived ticket that can be used once to establish an SSE connection.
    /// The ticket is a GUID mapped to a userId in an in-memory cache.
    /// </summary>
    /// <param name="userId">The authenticated user's ID</param>
    /// <returns>A short GUID ticket string</returns>
    string GenerateTicket(int userId);

    /// <summary>
    /// Validates a ticket and returns the associated userId.
    /// The ticket is consumed (removed from cache) after validation — single use.
    /// </summary>
    /// <param name="ticket">The ticket GUID</param>
    /// <returns>The userId if valid, null if expired or already consumed</returns>
    int? ValidateAndConsumeTicket(string ticket);
}
