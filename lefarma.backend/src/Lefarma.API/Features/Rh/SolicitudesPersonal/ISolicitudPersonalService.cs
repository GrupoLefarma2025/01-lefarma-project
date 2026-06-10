using ErrorOr;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal
{
    public interface ISolicitudPersonalService
    {

        Task<ErrorOr<IEnumerable<SolicitudPersonalResponse>>> GetAllAsync(SolicitudPersonalRequest query, int idUsuario, IEnumerable<int> rolesUsuario, bool puedeVerTodas);
        Task<ErrorOr<SolicitudPersonalResponse>> GetByIdAsync(int id);
        Task<ErrorOr<SolicitudPersonalResponse>> CreateAsync(CreateSolicitudPersonalRequest request, int idUsuario, CancellationToken ct = default);
        Task<ErrorOr<bool>> DeleteAsync(int id);
        Task<ErrorOr<SolicitudPersonalResponse>> UpdateAsync(int id, CreateSolicitudPersonalRequest request, int idUsuario, CancellationToken ct = default);
        Task<ErrorOr<IEnumerable<TipoSolicitudResponse>>> ListarTiposAsync();
    }
}
