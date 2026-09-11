using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica.Services;

public interface IRankingHospitalesService
{
    Task<RankingEjecucionDto> GenerarRankingAsync(
        int idSeleccionMensual,
        GenerarRankingRequest request,
        int idUsuario,
        CancellationToken cancellationToken = default);

    Task<RankingEjecucionDto?> GetByIdAsync(
        int idRankingEjecucion,
        CancellationToken cancellationToken = default);

    Task<RankingEjecucionDto?> GetUltimaEjecucionAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default);

    Task<FiltrosDisponiblesDto> GetFiltrosDisponiblesAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default);

    Task<List<SeleccionHospitalDto>> AplicarSugerenciasAsync(
        int idSeleccionMensual,
        AgregarHospitalesLoteRequest request,
        int idUsuario,
        CancellationToken cancellationToken = default);
}
