using Lefarma.API.Domain.Entities.Rh;

namespace Lefarma.API.Domain.Interfaces.Rh.IncidenciasChecado;

public interface IIncidenciasChecadoPlantillaRepository
{
    Task<List<IncidenciaChecadoPlantilla>> GetActivosAsync(CancellationToken cancellationToken = default);
}
