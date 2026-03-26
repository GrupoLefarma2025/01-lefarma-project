using System.Security.Claims;
using Lefarma.API.Features.Profile.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Profile;

/// <summary>
/// Controller para operaciones del usuario autenticado sobre su propio perfil
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize] // Requiere autenticación
[EndpointGroupName("Profile")]
public class ProfileController : ControllerBase
{
    private readonly IProfileService _profileService;

    public ProfileController(IProfileService profileService)
    {
        _profileService = profileService;
    }

    /// <summary>
    /// Obtiene el perfil del usuario autenticado
    /// </summary>
    [HttpGet]
    [SwaggerOperation(Summary = "Obtener mi perfil")]
    [ProducesResponseType(typeof(ApiResponse<ProfileResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProfile(CancellationToken cancellationToken = default)
    {
        var userId = GetAuthenticatedUserId();
        if (userId == null)
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Usuario no autenticado"
            });

        var result = await _profileService.GetProfileAsync(userId.Value, cancellationToken);
        return result.ToActionResult(this, data => Ok(new ApiResponse<ProfileResponse>
        {
            Success = true,
            Data = data
        }));
    }

    /// <summary>
    /// Actualiza el perfil del usuario autenticado
    /// </summary>
    [HttpPut]
    [SwaggerOperation(Summary = "Actualizar mi perfil")]
    [ProducesResponseType(typeof(ApiResponse<ProfileResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateProfile(
        [FromBody] UpdateProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = GetAuthenticatedUserId();
        if (userId == null)
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Usuario no autenticado"
            });

        var result = await _profileService.UpdateProfileAsync(userId.Value, request, cancellationToken);
        return result.ToActionResult(this, data => Ok(new ApiResponse<ProfileResponse>
        {
            Success = true,
            Data = data,
            Message = "Perfil actualizado exitosamente"
        }));
    }

    /// <summary>
    /// Extrae el ID del usuario autenticado desde los claims del JWT
    /// </summary>
    private int? GetAuthenticatedUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("userId")?.Value;
        if (int.TryParse(userIdClaim, out var userId))
            return userId;

        return null;
    }
}
