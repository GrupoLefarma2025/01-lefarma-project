using Lefarma.API.Domain.Entities.Asistencias;

namespace Lefarma.API.Domain.Interfaces.Rh.IncidenciasChecado;

public interface IIncidenciasChecadoRepository
{
    IQueryable<VwIncidenciasChecado> GetQueryable();
}
