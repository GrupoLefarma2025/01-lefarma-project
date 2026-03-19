using ErrorOr;
using Lefarma.API.Features.Catalogos.Medidas.DTOs;

namespace Lefarma.API.Features.Catalogos.Medidas
{
    public interface IMedidaService
    {
        Task<ErrorOr<IEnumerable<MedidaResponse>>> GetAllAsync();
        Task<ErrorOr<MedidaResponse>> GetByIdAsync(int id);
        Task<ErrorOr<MedidaResponse>> CreateAsync(CreateMedidaRequest request);
        Task<ErrorOr<MedidaResponse>> UpdateAsync(int id, UpdateMedidaRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
