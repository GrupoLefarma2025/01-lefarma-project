using ErrorOr;
using Lefarma.API.Features.Catalogos.FormasPago.DTOs;

namespace Lefarma.API.Domain.Interfaces.Catalogos
{
    public interface IFormaPagoService
    {
        Task<ErrorOr<IEnumerable<FormaPagoResponse>>> GetAllAsync();
        Task<ErrorOr<FormaPagoResponse>> GetByIdAsync(int id);
        Task<ErrorOr<FormaPagoResponse>> CreateAsync(CreateFormaPagoRequest request);
        Task<ErrorOr<FormaPagoResponse>> UpdateAsync(int id, UpdateFormaPagoRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
