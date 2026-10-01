using ErrorOr;
using Lefarma.API.Features.Firmas.DTOs;

namespace Lefarma.API.Features.Firmas;

public interface IFirmasService
{
    Task<ErrorOr<List<FirmaUsuarioResponse>>> GetUsuariosConFirmaAsync(CancellationToken cancellationToken = default);
    Task<ErrorOr<bool>> HabilitarCambioFirmaAsync(int idUsuario, int idUsuarioRh, CancellationToken cancellationToken = default);
    Task<ErrorOr<List<FirmaHistorialEventoResponse>>> GetHistorialAsync(int idUsuario, CancellationToken cancellationToken = default);

    /// <summary>
    /// Aprueba la firma en comprobación: la candidata pasa a ser la vigente.
    /// No se borra nada: la versión anterior y la foto de INE quedan como evidencia autorizada.
    /// </summary>
    Task<ErrorOr<bool>> AprobarFirmaAsync(int idUsuario, int idUsuarioRh, CancellationToken cancellationToken = default);

    /// <summary>
    /// Rechaza la firma en comprobación con motivo: elimina la firma candidata y
    /// la foto de INE (la remisión queda en el historial como registro del proceso).
    /// </summary>
    Task<ErrorOr<bool>> RechazarFirmaAsync(int idUsuario, int idUsuarioRh, string motivo, CancellationToken cancellationToken = default);

    /// <summary>
    /// Foto de INE de la última remisión/aprobación del usuario. Con ?archivo= sirve una
    /// versión autorizada anterior (solo nombres referenciados en el historial).
    /// </summary>
    Task<ErrorOr<ArchivoProtegidoResponse>> GetIneAsync(int idUsuario, string? archivo = null, CancellationToken cancellationToken = default);

    /// <summary>Firma candidata en comprobación (para el modal de comprobación de RH).</summary>
    Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaPendienteAsync(int idUsuario, CancellationToken cancellationToken = default);

    /// <summary>
    /// Firma vigente del usuario en el sistema RH: solo el puntero firma_path_cifrada.
    /// </summary>
    Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaVigenteAsync(int idUsuario, CancellationToken cancellationToken = default);

    /// <summary>
    /// Firma usada en un evento de la bitácora del workflow, con autorización estricta
    /// por documento (SP/OC). Fallback a la firma vigente del actor si el evento no
    /// tiene firmaArchivo capturado.
    /// </summary>
    Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaBitacoraAsync(
        int idEvento, int idUsuarioActual, IReadOnlyCollection<string> permisos, CancellationToken cancellationToken = default);

    /// <summary>
    /// Firma vigente del solicitante de una solicitud de personal, con autorización
    /// por documento (quien puede ver la solicitud). Se usa para el cuadro SOLICITA
    /// cuando el solicitante no tiene eventos en la bitácora (p. ej. RH crea por él).
    /// </summary>
    Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaSolicitanteAsync(
        int idSolicitud, int idUsuarioActual, IReadOnlyCollection<string> permisos, CancellationToken cancellationToken = default);
}
