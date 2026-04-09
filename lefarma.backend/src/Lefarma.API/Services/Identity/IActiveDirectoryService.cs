using ErrorOr;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Services.Identity.Models;

namespace Lefarma.API.Services.Identity;
/// <summary>
/// Service for LDAP/Active Directory authentication and user management.
/// </summary>
public interface IActiveDirectoryService
{
    /// <summary>
    /// Authenticates a user against Active Directory via LDAP.
    /// </summary>
    /// <param name="username">The sAMAccountName of the user.</param>
    /// <param name="password">The user's password.</param>
    /// <param name="domain">The domain to authenticate against (e.g., "Asokam", "Artricenter").</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>True if authentication successful, false otherwise.</returns>
    Task<ErrorOr<bool>> AuthenticateAsync(
        string username,
        string password,
        string domain,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets user information from the Active Directory view.
    /// </summary>
    /// <param name="username">The sAMAccountName of the user.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>User information from Active Directory.</returns>
    Task<ErrorOr<ActiveDirectoryUser?>> GetUserAsync(
        string username,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all available domain configurations.
    /// </summary>
    /// <returns>List of configured LDAP domains.</returns>
    IReadOnlyList<LdapDomainOptions> GetConfiguredDomains();

    /// <summary>
    /// Gets domain configuration from database by domain name.
    /// </summary>
    /// <param name="dominio">The domain name.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Domain configuration from database or null if not found.</returns>
    Task<DominioConfig?> GetDominioConfigByDominioAsync(string dominio, CancellationToken cancellationToken = default);
}
