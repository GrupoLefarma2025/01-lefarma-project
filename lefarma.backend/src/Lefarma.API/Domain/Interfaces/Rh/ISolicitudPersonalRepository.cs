using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;

namespace Lefarma.API.Domain.Interfaces.Rh
{
    public interface ISolicitudPersonalRepository : IBaseRepository<SolicitudPersonal>
    {
        Task<SolicitudPersonal?> GetWithDetalleAsync(int idSolicitud);
        Task<string> GenerarFolioAsync(CategoriaSolicitud categoria);
        IQueryable<SolicitudPersonal> GetQueryableConDetalles();
    }
}
