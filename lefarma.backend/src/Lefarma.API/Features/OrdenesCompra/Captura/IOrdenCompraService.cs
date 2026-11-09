using ErrorOr;
using Lefarma.API.Features.OrdenesCompra.Captura.DTOs;
using Lefarma.API.Features.OrdenesCompra.Visibilidad;

namespace Lefarma.API.Features.OrdenesCompra.Captura
{
    public interface IOrdenCompraService
    {
        Task<ErrorOr<IEnumerable<OrdenCompraResponse>>> GetAllAsync(OrdenCompraRequest query, int idUsuario, AlcanceOrdenCompra alcance, CancellationToken ct = default);
        Task<ErrorOr<OrdenCompraResponse>> GetByIdAsync(int id);
        Task<ErrorOr<OrdenCompraResponse>> CreateAsync(CreateOrdenCompraRequest request, int idUsuario, CancellationToken ct = default);
        Task<ErrorOr<bool>> DeleteAsync(int id);
        Task<ErrorOr<OrdenCompraResponse>> UpdateAsync(int id, CreateOrdenCompraRequest request, int idUsuario, CancellationToken ct = default);
    }
}
