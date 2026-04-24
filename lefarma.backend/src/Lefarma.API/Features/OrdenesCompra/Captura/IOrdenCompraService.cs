using ErrorOr;
using Lefarma.API.Features.OrdenesCompra.Captura.DTOs;

namespace Lefarma.API.Features.OrdenesCompra.Captura
{
public interface IOrdenCompraService
    {
        Task<ErrorOr<IEnumerable<OrdenCompraResponse>>> GetAllAsync(OrdenCompraRequest query, int idUsuario, IEnumerable<int> rolesUsuario, bool puedeVerTodas);
        Task<ErrorOr<OrdenCompraResponse>> GetByIdAsync(int id);
        Task<ErrorOr<OrdenCompraResponse>> CreateAsync(CreateOrdenCompraRequest request, int idUsuario, CancellationToken ct = default);
        Task<ErrorOr<bool>> DeleteAsync(int id);
        Task<ErrorOr<OrdenCompraResponse>> UpdateAsync(int id, CreateOrdenCompraRequest request, int idUsuario, CancellationToken ct = default);
    }
}
