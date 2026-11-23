using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface ITalleresService
{
    Task<MisTalleresResponse> GetMisTalleresAsync(int idUsuario, string? periodo, CancellationToken ct = default);

    Task<TallerDto> CrearAsync(CrearTallerRequest request, int idUsuario, CancellationToken ct = default);

    Task<List<TallerDto>> GetByVisitaAsync(
        int idRutaVisita,
        int idUsuario,
        bool verTodas,
        CancellationToken ct = default);

    Task<TallerDto> ActualizarAsync(int idTaller, ActualizarTallerRequest request, int idUsuario, CancellationToken ct = default);
    Task EliminarAsync(int idTaller, int idUsuario, CancellationToken ct = default);

    Task<TallerSolicitudCambioDto> CrearSolicitudCambioAsync(
        int idTaller,
        CrearSolicitudCambioRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<TallerSolicitudCambioDto> ResolverSolicitudCambioAsync(
        int idSolicitud,
        ResolverSolicitudCambioRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<List<TallerSolicitudCambioDto>> GetSolicitudesCambioAsync(int idTaller, CancellationToken ct = default);
}
