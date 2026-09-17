using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/aprobaciones")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class AprobacionesController : ControllerBase
{
    private readonly IAprobacionesService _service;

    public AprobacionesController(IAprobacionesService service)
    {
        _service = service;
    }

    [HttpGet("documentos")]
    [HttpGet("pendientes")]
    [SwaggerOperation(
        Summary = "Documentos de la Bandeja de Autorizaciones",
        Description = "filtro: 'pendientes' (default; pasos de firma donde el usuario participa), 'mios' (creados por el usuario) o 'todos' (sin filtro de usuario; requiere educacion_medica.aprobaciones.puede_ver_todos).")]
    [SwaggerResponse(200, "Documentos", typeof(ApiResponse<List<PendienteAprobacionDto>>))]
    [SwaggerResponse(403, "Sin permiso para el filtro 'todos'.")]
    public async Task<IActionResult> GetDocumentos([FromQuery] string? filtro, CancellationToken ct)
    {
        var filtroNormalizado = (filtro ?? AprobacionesService.FiltroPendientes).Trim().ToLowerInvariant();
        if (filtroNormalizado == AprobacionesService.FiltroTodos && !TienePermiso(Permissions.EducacionMedica.BandejaVerTodos))
        {
            return StatusCode(403, new ApiResponse<object>
            {
                Success = false,
                Message = $"No tiene permiso para ver todos los documentos ({Permissions.EducacionMedica.BandejaVerTodos}).",
                Data = null
            });
        }

        var documentos = await _service.GetDocumentosAsync(GetUserId(), filtro, ct);
        return Ok(new ApiResponse<List<PendienteAprobacionDto>>
        {
            Success = true,
            Message = "Documentos obtenidos exitosamente.",
            Data = documentos
        });
    }

    private int GetUserId() =>
        int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;

    private bool TienePermiso(string permiso) =>
        User.Claims.Any(c => c.Type == "permission" && c.Value == permiso);
}
