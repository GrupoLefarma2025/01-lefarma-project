using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface IRegionService
{
    Task<List<RegionDto>> GetRegionesAsync(CancellationToken ct = default);

    Task<RegionDto> CreateRegionAsync(UpsertRegionRequest request, int idUsuario, CancellationToken ct = default);

    Task<RegionDto> UpdateRegionAsync(int idRegion, UpsertRegionRequest request, int idUsuario, CancellationToken ct = default);

    Task<List<EstadoCatalogoDto>> GetEstadosCatalogoAsync(CancellationToken ct = default);

    Task<SugerenciaRegionResponseDto> GetSugerenciaAsync(int codigoContacto, CancellationToken ct = default);

    Task<AplicarMapeoResponseDto> PreviewAplicarMapeoAsync(CancellationToken ct = default);

    Task<AplicarMapeoResultadoDto> AplicarMapeoAsync(int idUsuario, CancellationToken ct = default);

    Task<HospitalExtensionDto> AsignarRegionHospitalAsync(
        int codigoContacto,
        AsignarRegionHospitalRequest request,
        int idUsuario,
        CancellationToken ct = default);

    // Métodos del mapeo estado -> región.
    Task<List<RegionEstadoDto>> GetMapeoEstadosAsync(CancellationToken ct = default);

    Task<RegionEstadoDto> UpsertMapeoEstadoAsync(
        int codigoEstado,
        UpsertRegionEstadoRequest request,
        int idUsuario,
        CancellationToken ct = default);
}
