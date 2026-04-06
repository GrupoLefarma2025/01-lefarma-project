using Lefarma.API.Features.Auth.Usuarios.DTOs;

namespace Lefarma.API.Features.Auth.Usuarios;
/// <summary>
/// Service interface for Usuario catalog operations
/// </summary>
public interface IUsuarioCatalogService
{
    /// <summary>
    /// Gets all active usuarios for catalog selection
    /// </summary>
    Task<List<UsuarioCatalogDto>> GetAllAsync(CancellationToken ct = default);
}
