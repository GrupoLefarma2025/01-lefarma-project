using ErrorOr;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;

namespace Lefarma.API.Features.Catalogos.Proveedores
{
public interface IProveedorService
    {
        Task<ErrorOr<IEnumerable<ProveedorResponse>>> GetAllAsync(ProveedorRequest query);
        Task<ErrorOr<ProveedorResponse>> GetByIdAsync(int id);
        Task<ErrorOr<ProveedorResponse>> CreateAsync(CreateProveedorRequest request);
        Task<ErrorOr<ProveedorResponse>> UpdateAsync(int id, UpdateProveedorRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
        Task<ErrorOr<ProveedorResponse>> AutorizarAsync(int id, int idUsuario);
        Task<ErrorOr<ProveedorResponse>> RechazarAsync(int id, string motivo, int idUsuario);
        Task<ErrorOr<bool>> UpdateCaratulaAsync(int id, string caratulaPath);
        Task<ErrorOr<bool>> DeleteCaratulaAsync(int id);
    }
}
