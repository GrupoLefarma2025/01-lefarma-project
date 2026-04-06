using ErrorOr;
using Lefarma.API.Features.Catalogos.MediosPago.DTOs;

namespace Lefarma.API.Features.Catalogos.MediosPago
{
public interface IMedioPagoService
    {
        Task<ErrorOr<IEnumerable<MedioPagoResponse>>> GetAllAsync();
        Task<ErrorOr<MedioPagoResponse>> GetByIdAsync(int id);
        Task<ErrorOr<MedioPagoResponse>> CreateAsync(CreateMedioPagoRequest request);
        Task<ErrorOr<MedioPagoResponse>> UpdateAsync(int id, UpdateMedioPagoRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
