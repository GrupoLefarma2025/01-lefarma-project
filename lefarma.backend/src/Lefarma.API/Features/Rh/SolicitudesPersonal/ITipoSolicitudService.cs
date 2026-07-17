using ErrorOr;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal
{
    public interface ITipoSolicitudService
    {
        Task<ErrorOr<IEnumerable<TipoSolicitudResponse>>> GetAllAsync(TipoSolicitudRequest query);
        Task<ErrorOr<TipoSolicitudResponse>> GetByIdAsync(int id);
        Task<ErrorOr<TipoSolicitudResponse>> CreateAsync(CreateTipoSolicitudRequest request);
        Task<ErrorOr<TipoSolicitudResponse>> UpdateAsync(int id, UpdateTipoSolicitudRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
        Task<ErrorOr<IEnumerable<TipoSolicitudResponse>>> GetActivosAsync();
    }
}
