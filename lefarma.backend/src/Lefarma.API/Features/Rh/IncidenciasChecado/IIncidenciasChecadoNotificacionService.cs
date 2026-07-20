using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Shared.Models;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

public interface IIncidenciasChecadoNotificacionService
{
    Task<Result<List<PlantillaIncidenciaChecadoResponse>>> GetPlantillasAsync(CancellationToken cancellationToken = default);

    Task<Result<NotificarIncidenciasResumenResponse>> NotificarResumenAsync(
        NotificarIncidenciasResumenRequest request,
        int? idUsuarioEnviador,
        CancellationToken cancellationToken = default);
}
