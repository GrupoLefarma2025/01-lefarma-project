using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface ICalendarioService
{
    Task<List<CalendarioItemDto>> GetCalendarioAsync(
        CalendarioFiltro filtro,
        CancellationToken ct = default);

    Task<CalendarioItemDto?> GetItemAsync(int idRutaVisita, CancellationToken ct = default);
}
