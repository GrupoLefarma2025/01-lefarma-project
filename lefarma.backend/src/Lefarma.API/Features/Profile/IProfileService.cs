using ErrorOr;
using Lefarma.API.Features.Profile.DTOs;

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
}
