using System.Security.Claims;
using Lefarma.API.Features.Firmas.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Firmas;

/// <summary>
/// Gestión de firmas digitales: comprobación por RH (permiso usuarios.firma.habilitar_cambio)
/// y servicio autenticado de imágenes (mi firma, firma por documento, INE).
/// </summary>
[Route("api/[controller]")]
[ApiController]
[EndpointGroupName("Firmas")]
public class FirmasController : ControllerBase
{
    private readonly IFirmasService _firmasService;

    public FirmasController(IFirmasService firmasService)
    {
        _firmasService = firmasService;
    }

    [HttpGet("usuarios")]
    [HasPermission(Permissions.Usuarios.HabilitarCambioFirma)]
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
    [HasPermission(Permissions.Usuarios.HabilitarCambioFirma)]
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
    [HasPermission(Permissions.Usuarios.HabilitarCambioFirma)]
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

    [HttpPost("usuarios/{idUsuario:int}/aprobar")]
    [HasPermission(Permissions.Usuarios.HabilitarCambioFirma)]
    [SwaggerOperation(Summary = "Aprobar la firma en comprobación de un usuario (conserva versión anterior e INE)")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AprobarFirma(int idUsuario, CancellationToken cancellationToken = default)
    {
        var rhUserId = GetAuthenticatedUserId();
        if (rhUserId == null)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Usuario no autenticado" });

        var result = await _firmasService.AprobarFirmaAsync(idUsuario, rhUserId.Value, cancellationToken);
        return result.ToActionResult(this, data => Ok(new ApiResponse<bool>
        {
            Success = true,
            Data = data,
            Message = "Firma aprobada"
        }));
    }

    [HttpPost("usuarios/{idUsuario:int}/rechazar")]
    [HasPermission(Permissions.Usuarios.HabilitarCambioFirma)]
    [SwaggerOperation(Summary = "Rechazar (con motivo) la firma en comprobación de un usuario (elimina firma candidata e INE)")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RechazarFirma(
        int idUsuario,
        [FromBody] RechazarFirmaRequest request,
        CancellationToken cancellationToken = default)
    {
        var rhUserId = GetAuthenticatedUserId();
        if (rhUserId == null)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Usuario no autenticado" });

        var result = await _firmasService.RechazarFirmaAsync(idUsuario, rhUserId.Value, request.Motivo, cancellationToken);
        return result.ToActionResult(this, data => Ok(new ApiResponse<bool>
        {
            Success = true,
            Data = data,
            Message = "Firma rechazada"
        }));
    }

    [HttpGet("usuarios/{idUsuario:int}/ine")]
    [HasPermission(Permissions.Usuarios.HabilitarCambioFirma)]
    [SwaggerOperation(Summary = "Foto del INE de la última remisión/aprobación (opcional: ?archivo= para una versión autorizada anterior)")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetIne(int idUsuario, [FromQuery] string? archivo = null, CancellationToken cancellationToken = default)
    {
        var result = await _firmasService.GetIneAsync(idUsuario, archivo, cancellationToken);
        return result.ToActionResult(this, ine => File(ine.Contenido, ine.ContentType, ine.NombreArchivo));
    }

    [HttpGet("usuarios/{idUsuario:int}/pendiente")]
    [HasPermission(Permissions.Usuarios.HabilitarCambioFirma)]
    [SwaggerOperation(Summary = "Firma candidata en comprobación de un usuario (para el modal de comprobación)")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFirmaPendiente(int idUsuario, CancellationToken cancellationToken = default)
    {
        var result = await _firmasService.GetFirmaPendienteAsync(idUsuario, cancellationToken);
        return result.ToActionResult(this, firma => File(firma.Contenido, firma.ContentType, firma.NombreArchivo));
    }

    [HttpGet("mi-firma")]
    [Authorize]
    [SwaggerOperation(Summary = "Mi firma vigente (solo el propio usuario)")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMiFirma(CancellationToken cancellationToken = default)
    {
        var userId = GetAuthenticatedUserId();
        if (userId == null)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Usuario no autenticado" });

        var result = await _firmasService.GetFirmaVigenteAsync(userId.Value, cancellationToken);
        return result.ToActionResult(this, firma => File(firma.Contenido, firma.ContentType, firma.NombreArchivo));
    }

    [HttpGet("usuarios/{idUsuario:int}/firma")]
    [Authorize]
    [SwaggerOperation(Summary = "Firma vigente de un usuario (RH o usuarios del concentrado de órdenes)")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFirmaUsuario(int idUsuario, CancellationToken cancellationToken = default)
    {
        // Listado RH o concentrado de OC ("revisó"); el dueño usa /mi-firma.
        if (!TienePermiso(Permissions.Usuarios.HabilitarCambioFirma) && !TienePermiso("ordenes.envio_concentrado"))
            return StatusCode(StatusCodes.Status403Forbidden, new ApiResponse<object>
            {
                Success = false,
                Message = "No tiene permiso para consultar la firma de otros usuarios."
            });

        var result = await _firmasService.GetFirmaVigenteAsync(idUsuario, cancellationToken);
        return result.ToActionResult(this, firma => File(firma.Contenido, firma.ContentType, firma.NombreArchivo));
    }

    [HttpGet("bitacora/{idEvento:int}/imagen")]
    [Authorize]
    [SwaggerOperation(Summary = "Firma usada en un evento del workflow (solo quien puede ver el documento; fallback a la firma vigente del actor)")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFirmaBitacora(int idEvento, CancellationToken cancellationToken = default)
    {
        var userId = GetAuthenticatedUserId();
        if (userId == null)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Usuario no autenticado" });

        var permisos = User.Claims
            .Where(c => c.Type == "permission")
            .Select(c => c.Value)
            .ToList();

        var result = await _firmasService.GetFirmaBitacoraAsync(idEvento, userId.Value, permisos, cancellationToken);
        return result.ToActionResult(this, firma => File(firma.Contenido, firma.ContentType, firma.NombreArchivo));
    }

    [HttpGet("solicitud-personal/{idSolicitud:int}/solicitante")]
    [Authorize]
    [SwaggerOperation(Summary = "Firma vigente del solicitante de una solicitud de personal (solo quien puede ver la solicitud)")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFirmaSolicitante(int idSolicitud, CancellationToken cancellationToken = default)
    {
        var userId = GetAuthenticatedUserId();
        if (userId == null)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Usuario no autenticado" });

        var permisos = User.Claims
            .Where(c => c.Type == "permission")
            .Select(c => c.Value)
            .ToList();

        var result = await _firmasService.GetFirmaSolicitanteAsync(idSolicitud, userId.Value, permisos, cancellationToken);
        return result.ToActionResult(this, firma => File(firma.Contenido, firma.ContentType, firma.NombreArchivo));
    }

    private bool TienePermiso(string permiso) =>
        User.Claims.Any(c => c.Type == "permission" && c.Value == permiso);

    private int? GetAuthenticatedUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("userId")?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}
