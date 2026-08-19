using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;

namespace Lefarma.API.Domain.Interfaces.Rh;

public interface IIncidenciaChecadoConfigService
{
    Task EnriquecerDescuentosAsync(
        List<IncidenciaChecadoResponse> items,
        CancellationToken cancellationToken = default);

    Task EnriquecerDescuentosAsync(
        List<NotificarIncidenciaItemRequest> items,
        CancellationToken cancellationToken = default);
}
