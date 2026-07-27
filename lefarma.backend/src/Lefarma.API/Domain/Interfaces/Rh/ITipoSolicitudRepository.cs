using Lefarma.API.Domain.Entities.Rh;

namespace Lefarma.API.Domain.Interfaces.Rh
{
    public interface ITipoSolicitudRepository
    {
        Task<List<TipoSolicitud>> GetTiposActivosAsync();
        Task<TipoSolicitud?> GetByIdAsync(int idTipoSolicitud);
        Task<IQueryable<TipoSolicitud>> GetQueryableAsync();
        Task<bool> ExistePorClaveAsync(string clave, int? excluirId = null);
        Task<bool> TieneSolicitudesAsociadasAsync(int idTipoSolicitud);
        Task<int> ContarSolicitudesCerradasEnPeriodoAsync(
            int idUsuario,
            int idTipoSolicitud,
            DateTime fechaInicio,
            DateTime fechaFin,
            string estadoCerrado,
            int? excluirIdSolicitud = null);
        Task<TipoSolicitud> AddAsync(TipoSolicitud tipo);
        Task UpdateAsync(TipoSolicitud tipo);
        Task DeleteAsync(TipoSolicitud tipo);
    }
}
