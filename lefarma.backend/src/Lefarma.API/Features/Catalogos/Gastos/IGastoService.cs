using ErrorOr;
using Lefarma.API.Features.Catalogos.Gastos.DTOs;

namespace Lefarma.API.Features.Catalogos.Gastos
{
    public interface IGastoService
    {
        Task<ErrorOr<IEnumerable<GastoResponse>>> GetAllAsync();
        Task<ErrorOr<GastoResponse>> GetByIdAsync(int id);
        Task<ErrorOr<GastoResponse>> CreateAsync(CreateGastoRequest request);
        Task<ErrorOr<GastoResponse>> UpdateAsync(int id, UpdateGastoRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
