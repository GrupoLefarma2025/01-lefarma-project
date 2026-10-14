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

    /// <summary>Edición de horas de la visita: normal en Creada; ajuste auditado en Cerrada (ADR-00010).</summary>
    Task<DTOs.RutaVisitaDto> EditarHorasVisitaAsync(
        int idRuta,
        int idRutaVisita,
        DTOs.EditarHorasVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<DTOs.RutaVisitaDto> AgregarVisitaAsync(
        int idRuta,
        DTOs.AgregarVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default);

    /// <summary>Alta de visita extraordinaria (hospital del catálogo fuera de la selección; ADR-00011).</summary>
    Task<DTOs.RutaVisitaDto> AgregarVisitaExtraordinariaAsync(
        int idSeleccionMensual,
        DTOs.VisitaExtraordinariaRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task QuitarVisitaAsync(int idRuta, int idRutaVisita, string? motivo, int idUsuario, CancellationToken ct = default);

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

    /// <summary>Hospitales de la selección del equipo con ruta Cerrada (captura asistida; ADR-00011).</summary>
    Task<List<DTOs.HospitalElegibleDto>> GetHospitalesElegiblesAsync(int idEquipo, CancellationToken ct = default);
}
