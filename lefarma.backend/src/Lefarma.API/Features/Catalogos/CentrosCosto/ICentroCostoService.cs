using ErrorOr;
using Lefarma.API.Features.Catalogos.CentrosCosto.DTOs;

namespace Lefarma.API.Features.Catalogos.CentrosCosto
{
public interface ICentroCostoService
    {
        Task<ErrorOr<IEnumerable<CentroCostoResponse>>> GetAllAsync(CentroCostoRequest query);
        Task<ErrorOr<CentroCostoResponse>> GetByIdAsync(int id);
        Task<ErrorOr<CentroCostoResponse>> CreateAsync(CreateCentroCostoRequest request);
        Task<ErrorOr<CentroCostoResponse>> UpdateAsync(int id, UpdateCentroCostoRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
