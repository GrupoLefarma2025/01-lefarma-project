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
[Route("api/educacion-medica/ajustes")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class AjustesPostCierreController : ControllerBase
{
    private readonly IAjustePostCierreService _service;

    public AjustesPostCierreController(IAjustePostCierreService service)
    {
        _service = service;
    }

    [HttpGet]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Historial de ajustes post-cierre",
        Description = "Bitácora de ajustes (fecha/hora/logística) de una entidad: RUTA_VISITA, RUTA_VERSION o TALLER. Valida en servicio el permiso de ver del módulo (rutas.puede_ver / talleres.puede_ver; ADR-00010).")]
    [SwaggerResponse(200, "Ajustes", typeof(ApiResponse<List<AjustePostCierreDto>>))]
    [SwaggerResponse(409, "Entidad desconocida o sin permiso")]
    public async Task<IActionResult> Listar(
        [FromQuery] string entidadTipo,
        [FromQuery] int idEntidad,
        CancellationToken ct)
    {
        try
        {
            var ajustes = await _service.ListarAsync(entidadTipo, idEntidad, GetUserId(), ct);
            return Ok(new ApiResponse<List<AjustePostCierreDto>>
            {
                Success = true,
                Message = "Ajustes obtenidos exitosamente.",
                Data = ajustes
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    private int GetUserId() =>
        int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
}
