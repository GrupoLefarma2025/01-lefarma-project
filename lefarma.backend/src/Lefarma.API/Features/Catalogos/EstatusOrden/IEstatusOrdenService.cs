using ErrorOr;
using Lefarma.API.Features.Catalogos.EstatusOrden.DTOs;

namespace Lefarma.API.Features.Catalogos.EstatusOrden
{
public interface IEstatusOrdenService
    {
        Task<ErrorOr<IEnumerable<EstatusOrdenResponse>>> GetAllAsync(EstatusOrdenRequest query);
        Task<ErrorOr<EstatusOrdenResponse>> GetByIdAsync(int id);
    }
}
