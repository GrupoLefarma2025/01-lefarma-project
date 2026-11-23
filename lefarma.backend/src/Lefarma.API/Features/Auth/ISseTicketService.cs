namespace Lefarma.API.Features.Auth;

public interface ISseTicketService
{
    string GenerateTicket(int userId);

    int? ValidateAndConsumeTicket(string ticket);
}
