using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface ICostosRutaService
{
    Task<CostosRutaResponse> CalcularAsync(CostosRutaRequest request, CancellationToken ct = default);
}
