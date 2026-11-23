using ErrorOr;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Services.Identity.Models;

namespace Lefarma.API.Services.Identity;
public interface IActiveDirectoryService
{
    Task<ErrorOr<bool>> AuthenticateAsync(
        string username,
        string password,
        string domain,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<ActiveDirectoryUser?>> GetUserAsync(
        string username,
        CancellationToken cancellationToken = default);

    IReadOnlyList<LdapDomainOptions> GetConfiguredDomains();

    Task<DominioConfig?> GetDominioConfigByDominioAsync(string dominio, CancellationToken cancellationToken = default);
}
