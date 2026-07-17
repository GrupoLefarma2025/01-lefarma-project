using ErrorOr;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Lefarma.API.Shared.Models;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal
{
    public interface ISolicitudPersonalService
    {
        Task<ErrorOr<PagedResult<SolicitudPersonalResponse>>> GetAllAsync(SolicitudPersonalRequest query, int idUsuario, IEnumerable<int> rolesUsuario, bool puedeVerTodas);
        Task<ErrorOr<SolicitudPersonalResponse>> GetByIdAsync(int id);
        Task<ErrorOr<SolicitudPersonalResponse>> CreateAsync(CreateSolicitudPersonalRequest request, int idUsuario, CancellationToken ct = default);
        Task<ErrorOr<bool>> DeleteAsync(int id);
        Task<ErrorOr<SolicitudPersonalResponse>> UpdateAsync(int id, CreateSolicitudPersonalRequest request, int idUsuario, CancellationToken ct = default);
        Task<ErrorOr<MisLimitesResponse>> ObtenerLimitesSolicitudesAsync(int idUsuario, int idUsuarioObjetivo, bool puedeVerTodas);
        Task<ErrorOr<IEnumerable<CalendarioGlobalEvento>>> ObtenerCalendarioAsync(
            CalendarioGlobalRequest request, int idUsuarioActual);
    }
}
