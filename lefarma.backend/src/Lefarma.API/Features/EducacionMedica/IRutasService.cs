namespace Lefarma.API.Features.EducacionMedica;

public interface IRutasService
{
    Task<DTOs.GenerarRutasResponse> GenerarAsync(
        int idSeleccionMensual,
        int idUsuario,
        DTOs.GenerarRutasRequest? request = null,
        CancellationToken ct = default);

    Task<List<DTOs.RutaDto>> GetBySeleccionAsync(int idSeleccionMensual, int? version, CancellationToken ct = default);

    Task<DTOs.RutaVisitaDto> MoverVisitaAsync(
        int idRuta,
        int idRutaVisita,
        DTOs.MoverVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<DTOs.RutaVisitaDto> AgregarVisitaAsync(
        int idRuta,
        DTOs.AgregarVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task QuitarVisitaAsync(int idRuta, int idRutaVisita, int idUsuario, CancellationToken ct = default);

    Task<List<DTOs.RutaDto>> ConfirmarAsync(int idSeleccionMensual, int idUsuario, CancellationToken ct = default);

    Task<List<DTOs.RutaDto>> CancelarAsync(
        int idSeleccionMensual,
        DTOs.CancelarRutasRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<List<DTOs.AsignacionDto>> GetAsignacionesAsync(int idUsuario, CancellationToken ct = default);
}
