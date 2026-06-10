using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Entities.Rh;

namespace Lefarma.API.Domain.Interfaces.SolicitudesPersonal
{
    public interface ISolicitudPersonalRepository : IBaseRepository<SolicitudPersonal>
    {
        Task<TipoSolicitud?> GetTipoSolicitudAsync(int idTipoSolicitud);
        Task<string> GenerarFolioAsync(CategoriaSolicitud categoria);
    }
}
