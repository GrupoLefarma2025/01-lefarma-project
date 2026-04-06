using ErrorOr;
using Lefarma.API.Features.Catalogos.RegimenesFiscales.DTOs;

namespace Lefarma.API.Features.Catalogos.RegimenesFiscales
{
public interface IRegimenFiscalService
    {
        Task<ErrorOr<IEnumerable<RegimenFiscalResponse>>> GetAllAsync(RegimenFiscalRequest query);
        Task<ErrorOr<RegimenFiscalResponse>> GetByIdAsync(int id);
        Task<ErrorOr<RegimenFiscalResponse>> CreateAsync(CreateRegimenFiscalRequest request);
        Task<ErrorOr<RegimenFiscalResponse>> UpdateAsync(int id, UpdateRegimenFiscalRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
