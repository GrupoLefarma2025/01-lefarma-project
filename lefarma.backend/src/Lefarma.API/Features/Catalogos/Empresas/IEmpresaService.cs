using ErrorOr;
using Lefarma.API.Features.Catalogos.Empresas.DTOs;

namespace Lefarma.API.Features.Catalogos.Empresas
{
public interface IEmpresaService
    {
        Task<ErrorOr<IEnumerable<EmpresaResponse>>> GetAllAsync(EmpresaRequest query);
        Task<ErrorOr<EmpresaResponse>> GetByIdAsync(int id);
        Task<ErrorOr<EmpresaResponse>> CreateAsync(CreateEmpresaRequest request);
        Task<ErrorOr<EmpresaResponse>> UpdateAsync(int id, UpdateEmpresaRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
