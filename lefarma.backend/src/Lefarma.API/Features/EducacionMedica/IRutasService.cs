using ErrorOr;
using Lefarma.API.Features.Config.Workflows.DTOs;

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

    /// <summary>Estado de autorización de la versión de rutas (paso actual y acciones disponibles para el usuario).</summary>
    Task<DTOs.RutaVersionDto?> GetVersionInfoAsync(
        int idSeleccionMensual,
        int? version,
        int idUsuario,
        CancellationToken ct = default);

    /// <summary>Ejecuta una acción del workflow sobre la versión (enviar, firmar GV/CA/DC, devolver, cancelar).</summary>
    Task<DTOs.RutaVersionDto> FirmarVersionAsync(
        int idRutaVersion,
        DTOs.FirmarWorkflowRequest request,
        int idUsuario,
        CancellationToken ct = default);

    /// <summary>Historial (bitácora) del workflow de la versión.</summary>
    Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialVersionAsync(
        int idRutaVersion,
        CancellationToken ct = default);

    Task<List<DTOs.RutaDto>> CancelarAsync(
        int idSeleccionMensual,
        DTOs.CancelarRutasRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<List<DTOs.AsignacionDto>> GetAsignacionesAsync(int idUsuario, CancellationToken ct = default);
}
