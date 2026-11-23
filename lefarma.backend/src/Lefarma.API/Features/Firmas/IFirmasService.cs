using ErrorOr;
using Lefarma.API.Features.Firmas.DTOs;

namespace Lefarma.API.Features.Firmas;

public interface IFirmasService
{
    Task<ErrorOr<List<FirmaUsuarioResponse>>> GetUsuariosConFirmaAsync(CancellationToken cancellationToken = default);
    Task<ErrorOr<bool>> HabilitarCambioFirmaAsync(int idUsuario, int idUsuarioRh, CancellationToken cancellationToken = default);
    Task<ErrorOr<List<FirmaHistorialEventoResponse>>> GetHistorialAsync(int idUsuario, CancellationToken cancellationToken = default);

    Task<ErrorOr<bool>> AprobarFirmaAsync(int idUsuario, int idUsuarioRh, CancellationToken cancellationToken = default);

    Task<ErrorOr<bool>> RechazarFirmaAsync(int idUsuario, int idUsuarioRh, string motivo, CancellationToken cancellationToken = default);

    Task<ErrorOr<ArchivoProtegidoResponse>> GetIneAsync(int idUsuario, string? archivo = null, CancellationToken cancellationToken = default);

    Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaPendienteAsync(int idUsuario, CancellationToken cancellationToken = default);

    Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaVigenteAsync(int idUsuario, CancellationToken cancellationToken = default);

    Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaVigenteConLegacyAsync(int idUsuario, CancellationToken cancellationToken = default);

    Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaBitacoraAsync(
        int idEvento, int idUsuarioActual, IReadOnlyCollection<string> permisos, CancellationToken cancellationToken = default);

    Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaSolicitanteAsync(
        int idSolicitud, int idUsuarioActual, IReadOnlyCollection<string> permisos, CancellationToken cancellationToken = default);
}
