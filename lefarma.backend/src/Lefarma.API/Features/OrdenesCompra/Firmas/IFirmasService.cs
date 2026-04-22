using ErrorOr;
using Lefarma.API.Features.OrdenesCompra.Firmas.DTOs;

namespace Lefarma.API.Features.OrdenesCompra.Firmas
{
public interface IFirmasService
    {
        Task<ErrorOr<FirmarResponse>> FirmarAsync(int idOrden, FirmarRequest request, int idUsuario);
        Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesAsync(int idOrden, int idUsuario);
        Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(int idOrden, int idAccion, int idUsuario);
        Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialWorkflowAsync(int idOrden);
    }
}
