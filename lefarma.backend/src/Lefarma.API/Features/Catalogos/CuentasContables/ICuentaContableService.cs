using ErrorOr;
using Lefarma.API.Features.Catalogos.CuentasContables.DTOs;

namespace Lefarma.API.Features.Catalogos.CuentasContables
{
public interface ICuentaContableService
    {
        Task<ErrorOr<IEnumerable<CuentaContableResponse>>> GetAllAsync(CuentaContableRequest query);
        Task<ErrorOr<CuentaContableResponse>> GetByIdAsync(int id);
        Task<ErrorOr<CuentaContableResponse>> CreateAsync(CreateCuentaContableRequest request);
        Task<ErrorOr<CuentaContableResponse>> UpdateAsync(int id, UpdateCuentaContableRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
