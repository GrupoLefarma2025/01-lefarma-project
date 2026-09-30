using ErrorOr;
using Lefarma.API.Features.Profile.DTOs;
using Microsoft.AspNetCore.Http;

namespace Lefarma.API.Features.Profile;
/// <summary>
/// Servicio para operaciones del usuario autenticado sobre su propio perfil
/// </summary>
public interface IProfileService
{
    /// <summary>
    /// Obtiene el perfil del usuario autenticado
    /// </summary>
    Task<ErrorOr<ProfileResponse>> GetProfileAsync(int userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Actualiza el perfil del usuario autenticado
    /// </summary>
    Task<ErrorOr<ProfileResponse>> UpdateProfileAsync(int userId, UpdateProfileRequest request, CancellationToken cancellationToken = default);
    /// <summary>
    /// Verifica si el usuario tiene una firma digital registrada
    /// </summary>
    Task<ErrorOr<bool>> HasFirmaAsync(int userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifica si el usuario tiene una firma en comprobación por RH (remisión sin resolver).
    /// </summary>
    Task<ErrorOr<bool>> TieneFirmaEnComprobacionAsync(int userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Remite una firma (png/jpg ≤2 MB) con foto de INE (png/jpg ≤5 MB) a revisión de RH.
    /// No cambia la firma vigente: eso ocurre solo cuando RH aprueba la remisión.
    /// </summary>
    Task<ErrorOr<string>> UploadSignatureAsync(int userId, IFormFile file, IFormFile ine, string fileName, string contentType, CancellationToken cancellationToken = default);
    Task<ErrorOr<string>> DeleteSignatureAsync(int userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Solicita a RH un cambio de firma. Solo una solicitud pendiente por usuario;
    /// notifica in-app y por correo a los usuarios con permiso de habilitar cambios.
    /// </summary>
    Task<ErrorOr<bool>> SolicitarCambioFirmaAsync(int userId, CancellationToken cancellationToken = default);
}
