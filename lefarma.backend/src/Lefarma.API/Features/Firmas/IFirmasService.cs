using ErrorOr;
using Lefarma.API.Features.Firmas.DTOs;

namespace Lefarma.API.Features.Firmas;

public interface IFirmasService
{
    Task<ErrorOr<List<FirmaUsuarioResponse>>> GetUsuariosConFirmaAsync(CancellationToken cancellationToken = default);
    Task<ErrorOr<bool>> HabilitarCambioFirmaAsync(int idUsuario, int idUsuarioRh, CancellationToken cancellationToken = default);
    Task<ErrorOr<List<FirmaHistorialEventoResponse>>> GetHistorialAsync(int idUsuario, CancellationToken cancellationToken = default);

    /// <summary>
    /// Aprueba la firma en comprobación: la pendiente pasa a ser la vigente,
    /// se borran la firma anterior y la foto de INE, y se notifica al usuario.
    /// </summary>
    Task<ErrorOr<bool>> AprobarFirmaAsync(int idUsuario, int idUsuarioRh, CancellationToken cancellationToken = default);

    /// <summary>
    /// Rechaza la firma en comprobación con motivo: borra la firma pendiente y
    /// la foto de INE, y notifica al usuario (in-app + correo).
    /// </summary>
    Task<ErrorOr<bool>> RechazarFirmaAsync(int idUsuario, int idUsuarioRh, string motivo, CancellationToken cancellationToken = default);

    /// <summary>
    /// Foto de INE de la remisión en comprobación. NotFound si ya fue borrada o no hay remisión.
    /// </summary>
    Task<ErrorOr<IneArchivoResponse>> GetIneAsync(int idUsuario, CancellationToken cancellationToken = default);
}
