using Lefarma.API.Domain.Interfaces.EducacionMedica;

namespace Lefarma.API.Features.EducacionMedica;

public interface IEquipoPareoService
{
    Task<List<DTOs.EquipoPareoDto>> GetAllAsync(EquipoPareoFiltro? filtro, CancellationToken ct = default);

    Task<DTOs.EquipoOperacionDto?> ObtenerOperacionAsync(int idEquipo, CancellationToken ct = default);

    Task<DTOs.EquipoPareoDto> CreateAsync(
        DTOs.CrearEquipoPareoRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<DTOs.EquipoPareoDto?> AsignarRegionAsync(
        int idEquipo,
        DTOs.AsignarRegionEquipoRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<DTOs.EquipoPareoDto?> DesactivarAsync(int idEquipo, int idUsuario, CancellationToken ct = default);
}
