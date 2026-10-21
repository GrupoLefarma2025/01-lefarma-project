using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/dashboard")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
[HasPermission(Permissions.EducacionMedica.HubVerModulo)]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _service;

    public DashboardController(IDashboardService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Resumen del dashboard de Educación Médica",
        Description = "Agrega pendientes, visitas, mis talleres, matrices, talleres del periodo y solicitudes. "
            + "Solo consulta las fuentes que el usuario puede ver (talleres.puede_ver / talleres.puede_capturar).")]
    [SwaggerResponse(200, "Resumen del dashboard", typeof(ApiResponse<DashboardResumenDto>))]
    public async Task<IActionResult> GetResumen(
        [FromQuery] string? periodo,
        CancellationToken ct)
    {
        var resumen = await _service.GetResumenAsync(
            User.GetUserId(),
            periodo,
            User.TienePermiso(Permissions.EducacionMedica.TalleresVer),
            User.TienePermiso(Permissions.EducacionMedica.TalleresCapturar),
            ct);

        return Ok(new ApiResponse<DashboardResumenDto>
        {
            Success = true,
            Message = "Resumen del dashboard obtenido exitosamente.",
            Data = resumen
        });
    }
}
