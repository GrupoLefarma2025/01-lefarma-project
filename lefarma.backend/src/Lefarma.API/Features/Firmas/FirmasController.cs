using System.Security.Claims;
using Lefarma.API.Features.Firmas.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Firmas;

/// <summary>
/// Gestión de firmas digitales de usuarios por parte de RH.
/// </summary>
[Route("api/[controller]")]
[ApiController]
[EndpointGroupName("Firmas")]
[HasPermission(Permissions.Usuarios.HabilitarCambioFirma)]
public class FirmasController : ControllerBase
{
    private readonly IFirmasService _firmasService;

    public FirmasController(IFirmasService firmasService)
    {
        _firmasService = firmasService;
    }

    [HttpGet("usuarios")]
    [SwaggerOperation(Summary = "Listar usuarios con firma y su estado de cambio")]
    [ProducesResponseType(typeof(ApiResponse<List<FirmaUsuarioResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsuariosConFirma(CancellationToken cancellationToken = default)
    {
        var result = await _firmasService.GetUsuariosConFirmaAsync(cancellationToken);
        return result.ToActionResult(this, data => Ok(new ApiResponse<List<FirmaUsuarioResponse>>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpGet("usuarios/{idUsuario:int}/historial")]
    [SwaggerOperation(Summary = "Historial de eventos de la firma de un usuario")]
    [ProducesResponseType(typeof(ApiResponse<List<FirmaHistorialEventoResponse>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHistorial(int idUsuario, CancellationToken cancellationToken = default)
    {
        var result = await _firmasService.GetHistorialAsync(idUsuario, cancellationToken);
        return result.ToActionResult(this, data => Ok(new ApiResponse<List<FirmaHistorialEventoResponse>>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpPost("usuarios/{idUsuario:int}/habilitar-cambio")]
    [SwaggerOperation(Summary = "Habilitar (un solo uso) el cambio de firma de un usuario")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> HabilitarCambio(int idUsuario, CancellationToken cancellationToken = default)
    {
        var rhUserId = GetAuthenticatedUserId();
        if (rhUserId == null)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Usuario no autenticado" });

        var result = await _firmasService.HabilitarCambioFirmaAsync(idUsuario, rhUserId.Value, cancellationToken);
        return result.ToActionResult(this, data => Ok(new ApiResponse<bool>
        {
            Success = true,
            Data = data,
            Message = "Cambio de firma habilitado"
        }));
    }

    private int? GetAuthenticatedUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("userId")?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}
