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
    Task<ErrorOr<string>> UploadSignatureAsync(int userId, IFormFile file, string fileName, string contentType, CancellationToken cancellationToken = default);
    Task<ErrorOr<string>> DeleteSignatureAsync(int userId, CancellationToken cancellationToken = default);
}
