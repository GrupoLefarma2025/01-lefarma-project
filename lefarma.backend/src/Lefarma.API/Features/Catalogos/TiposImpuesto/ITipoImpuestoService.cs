using ErrorOr;
using Lefarma.API.Features.Catalogos.TiposImpuesto.DTOs;

namespace Lefarma.API.Features.Catalogos.TiposImpuesto
{
    public interface ITipoImpuestoService
    {
        Task<ErrorOr<IEnumerable<TipoImpuestoResponse>>> GetAllAsync();
        Task<ErrorOr<TipoImpuestoResponse>> GetByIdAsync(int id);
        Task<ErrorOr<TipoImpuestoResponse>> CreateAsync(CreateTipoImpuestoRequest request);
        Task<ErrorOr<TipoImpuestoResponse>> UpdateAsync(int id, UpdateTipoImpuestoRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
