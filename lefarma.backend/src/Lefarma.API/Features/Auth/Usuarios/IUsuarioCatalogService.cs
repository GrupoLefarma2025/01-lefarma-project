using Lefarma.API.Features.Auth.Usuarios.DTOs;

namespace Lefarma.API.Features.Auth.Usuarios;
public interface IUsuarioCatalogService
{
    Task<List<UsuarioCatalogDto>> GetAllAsync(CancellationToken ct = default);
}
