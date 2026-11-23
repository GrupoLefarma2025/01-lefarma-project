using Lefarma.API.Features.Auth.Roles.DTOs;

namespace Lefarma.API.Features.Auth.Roles;
public interface IRolCatalogService
{
    Task<List<RolCatalogDto>> GetAllAsync(CancellationToken ct = default);
}
