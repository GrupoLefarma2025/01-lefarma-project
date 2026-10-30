using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface ICalendarioService
{
    Task<List<CalendarioItemDto>> GetCalendarioAsync(
        CalendarioFiltro filtro,
        int idUsuario,
        bool verTodas,
        CancellationToken ct = default);

    Task<CalendarioItemDto?> GetItemAsync(
        int idRutaVisita,
        int idUsuario,
        bool verTodas,
        CancellationToken ct = default);

    Task<ActividadVisitaDto?> GetActividadVisitaAsync(
        int idRutaVisita,
        int idUsuario,
        bool verTodas,
        CancellationToken ct = default);
}
