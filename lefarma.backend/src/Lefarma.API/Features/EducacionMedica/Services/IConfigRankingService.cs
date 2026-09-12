using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica.Services;

public interface IConfigRankingService
{
    Task<ConfigRankingConVersionesDto?> GetActivaAsync(CancellationToken cancellationToken = default);

    Task<List<ConfigRankingResumenDto>> GetListadoAsync(CancellationToken cancellationToken = default);

    Task<ConfigRankingDto?> GetByIdAsync(int idConfiguracion, CancellationToken cancellationToken = default);

    Task<ConfigRankingDto> CrearNuevaVersionAsync(
        int idConfiguracion,
        int idUsuario,
        CancellationToken cancellationToken = default);

    Task<ConfigRankingDto> UpdateAsync(
        int idConfiguracion,
        UpsertConfigRankingRequest request,
        int idUsuario,
        CancellationToken cancellationToken = default);
}
