using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/talleres")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class TalleresVisitaController : ControllerBase
{
    private readonly ITalleresVisitaService _service;

    public TalleresVisitaController(ITalleresVisitaService service)
    {
        _service = service;
    }

    [HttpPost("desde-visita")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Capturar taller desde una visita",
        Description = "Si la fecha del taller cambia respecto a la visita, crea otra visita para el mismo hospital y liga el taller a ella en una sola transacción. Requiere rutas.puede_gestionar y, en rutas cerradas, rutas.puede_ajustar + motivo.")]
    [SwaggerResponse(200, "Taller capturado", typeof(ApiResponse<TallerDto>))]
    [SwaggerResponse(409, "Validación, permiso o candado de edición fallido")]
    public async Task<IActionResult> CrearDesdeVisita(
        [FromBody] CrearTallerRequest request,
        CancellationToken ct)
    {
        try
        {
            var taller = await _service.CrearAsync(request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerDto>
            {
                Success = true,
                Message = "Taller capturado exitosamente.",
                Data = taller,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}
