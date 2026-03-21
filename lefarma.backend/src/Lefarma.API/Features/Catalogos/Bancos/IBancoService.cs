using ErrorOr;
using Lefarma.API.Features.Catalogos.Bancos.DTOs;

namespace Lefarma.API.Features.Catalogos.Bancos
{
    public interface IBancoService
    {
        Task<ErrorOr<IEnumerable<BancoResponse>>> GetAllAsync();
        Task<ErrorOr<BancoResponse>> GetByIdAsync(int id);
        Task<ErrorOr<BancoResponse>> CreateAsync(CreateBancoRequest request);
        Task<ErrorOr<BancoResponse>> UpdateAsync(int id, UpdateBancoRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
