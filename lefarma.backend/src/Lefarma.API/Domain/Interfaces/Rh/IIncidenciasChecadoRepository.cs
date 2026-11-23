using Lefarma.API.Domain.Entities.Asistencias;

namespace Lefarma.API.Domain.Interfaces.Rh;

public interface IIncidenciasChecadoRepository
{
    IQueryable<IncidenciasChecado> GetQueryable();

    Task<bool> EmpleadoTieneChecaDeshabilitadaAsync(long nomina, CancellationToken cancellationToken = default);
}
