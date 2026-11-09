using Lefarma.API.Features.Configuracion.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Sincronización de variables de configuración para el frontend.
/// </summary>
[ApiController]
[Route("api/configuracion/frontend")]
[EndpointGroupName("Configuracion")]
[Authorize]
public class ConfiguracionFrontendController : ControllerBase
{
    private readonly IConfiguracionService _service;

    public ConfiguracionFrontendController(IConfiguracionService service)
    {
        _service = service;
    }

    /// <summary>Consulta puntual del estado actual de un conjunto de claves.</summary>
    [HttpPost("consultar")]
    [SwaggerOperation(
        Summary = "Consultar variables para frontend",
        Description = "Devuelve el estado vigente de cada clave solicitada. Las claves inexistentes, inactivas o sin disponibilidad para frontend se devuelven en 'eliminadas'.")]
    [SwaggerResponse(200, "Variables consultadas", typeof(ApiResponse<FrontendSyncResponse>))]
    public async Task<IActionResult> Consultar(
        [FromBody] FrontendConsultarRequest request,
        CancellationToken ct)
    {
        var result = await _service.ConsultarFrontendAsync(request, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<FrontendSyncResponse>
        {
            Success = true,
            Message = "Variables consultadas exitosamente.",
            Data = data
        }));
    }

    /// <summary>Sincronización incremental desde una revisión.</summary>
    [HttpPost("sync")]
    [SwaggerOperation(
        Summary = "Sincronizar variables para frontend",
        Description = "Devuelve las variables solicitadas que cambiaron después de 'desde', con su revisión actual, y las claves que dejaron de estar disponibles.")]
    [SwaggerResponse(200, "Sincronización realizada", typeof(ApiResponse<FrontendSyncResponse>))]
    public async Task<IActionResult> Sync(
        [FromBody] FrontendSyncRequest request,
        CancellationToken ct)
    {
        var result = await _service.SincronizarFrontendAsync(request, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<FrontendSyncResponse>
        {
            Success = true,
            Message = "Sincronización realizada exitosamente.",
            Data = data
        }));
    }
}
