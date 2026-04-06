using Lefarma.API.Features.Auth.Roles.DTOs;

namespace Lefarma.API.Features.Auth.Roles;
/// <summary>
/// Service interface for Rol catalog operations
/// </summary>
public interface IRolCatalogService
{
    /// <summary>
    /// Gets all roles for catalog selection
    /// </summary>
    Task<List<RolCatalogDto>> GetAllAsync(CancellationToken ct = default);
}
