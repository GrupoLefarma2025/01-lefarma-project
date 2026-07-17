using System.Security.Claims;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

[ApiController]
[Route("api/rh")]
[EndpointGroupName("Rh")]
[Authorize]
public class IncidenciasChecadoController : ControllerBase
{
    private readonly IIncidenciasChecadoService _service;
    private readonly IIncidenciasChecadoNotificacionService _notificacionService;

    public IncidenciasChecadoController(
        IIncidenciasChecadoService service,
        IIncidenciasChecadoNotificacionService notificacionService)
    {
        _service = service;
        _notificacionService = notificacionService;
    }

    [HttpGet("mis-incidencias-checado")]
    [SwaggerOperation(
        Summary = "Consultar mis incidencias de checado",
        Description = "Retorna las incidencias de checado del usuario autenticado filtradas por año y mes")]
    [SwaggerResponse(200, "Incidencias obtenidas exitosamente", typeof(ApiResponse<List<IncidenciaChecadoResponse>>))]
    public async Task<IActionResult> GetMisIncidencias(
        [FromQuery] IncidenciasChecadoRequest request,
        CancellationToken cancellationToken)
    {
        var idUsuarioClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(idUsuarioClaim, out var idUsuario) || idUsuario <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "No se pudo identificar al usuario autenticado."
            });
        }

        var result = await _service.GetMisIncidenciasAsync(request, idUsuario, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<List<IncidenciaChecadoResponse>>
        {
            Success = true,
            Message = "Incidencias de checado obtenidas exitosamente.",
            Data = data
        }));
    }

    [HttpGet("incidencias-checado")]
    [SwaggerOperation(
        Summary = "Consultar todas las incidencias de checado",
        Description = "Retorna todas las incidencias de checado filtradas por año, mes, nómina, nombre, empresa, departamento y puesto")]
    [SwaggerResponse(200, "Incidencias obtenidas exitosamente", typeof(ApiResponse<PagedResult<IncidenciaChecadoResponse>>))]
    public async Task<IActionResult> GetAll(
        [FromQuery] IncidenciasChecadoConsultaRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.GetAllAsync(request, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<PagedResult<IncidenciaChecadoResponse>>
        {
            Success = true,
            Message = "Incidencias de checado obtenidas exitosamente.",
            Data = data
        }));
    }

    [HttpGet("incidencias-checado/empleado/{nomina}")]
    [SwaggerOperation(
        Summary = "Consultar incidencias de checado de un empleado",
        Description = "Retorna las incidencias de checado de un empleado específico filtradas por rango de fechas sin paginación ni conteo")]
    [SwaggerResponse(200, "Incidencias obtenidas exitosamente", typeof(ApiResponse<List<IncidenciaChecadoResponse>>))]
    public async Task<IActionResult> GetIncidenciasPorEmpleado(
        long nomina,
        [FromQuery] DateTime fechaInicio,
        [FromQuery] DateTime fechaFin,
        [FromQuery] int limite = 100,
        CancellationToken cancellationToken = default)
    {
        var result = await _service.GetIncidenciasPorEmpleadoAsync(nomina, fechaInicio, fechaFin, limite, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<List<IncidenciaChecadoResponse>>
        {
            Success = true,
            Message = "Incidencias de checado del empleado obtenidas exitosamente.",
            Data = data
        }));
    }

    [HttpGet("incidencias-checado/resumen-empleados")]
    [SwaggerOperation(
        Summary = "Consultar resumen de incidencias por empleado",
        Description = "Retorna un resumen de incidencias agrupadas por empleado para el período seleccionado")]
    [SwaggerResponse(200, "Resumen obtenido exitosamente", typeof(ApiResponse<PagedResult<IncidenciasChecadoResumenEmpleadoResponse>>))]
    public async Task<IActionResult> GetResumenPorEmpleado(
        [FromQuery] IncidenciasChecadoResumenEmpleadoRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.GetResumenPorEmpleadoAsync(request, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<PagedResult<IncidenciasChecadoResumenEmpleadoResponse>>
        {
            Success = true,
            Message = "Resumen de incidencias por empleado obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpGet("incidencias-checado/plantillas")]
    [SwaggerOperation(
        Summary = "Consultar plantillas de notificación de incidencias de checado",
        Description = "Retorna la lista de plantillas activas para notificaciones de incidencias de checado")]
    [SwaggerResponse(200, "Plantillas obtenidas exitosamente", typeof(ApiResponse<List<PlantillaIncidenciaChecadoResponse>>))]
    public async Task<IActionResult> GetPlantillas(CancellationToken cancellationToken)
    {
        var result = await _notificacionService.GetPlantillasAsync(cancellationToken);

        if (result.IsFailure)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = result.Error ?? string.Empty
            });
        }

        return Ok(new ApiResponse<List<PlantillaIncidenciaChecadoResponse>>
        {
            Success = true,
            Message = "Plantillas obtenidas exitosamente.",
            Data = result.Value
        });
    }

    [HttpPost("incidencias-checado/notificar-resumen")]
    [SwaggerOperation(
        Summary = "Enviar notificaciones masivas desde resumen por empleado",
        Description = "Envía un correo personalizado por empleado con sus incidencias del período filtrado")]
    [SwaggerResponse(200, "Notificaciones enviadas", typeof(ApiResponse<NotificarIncidenciasResumenResponse>))]
    public async Task<IActionResult> NotificarResumen(
        [FromBody] NotificarIncidenciasResumenRequest request,
        CancellationToken cancellationToken)
    {
        var idUsuarioClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int? idUsuarioEnviador = int.TryParse(idUsuarioClaim, out var id) && id > 0 ? id : null;

        var result = await _notificacionService.NotificarResumenAsync(request, idUsuarioEnviador, cancellationToken);

        if (result.IsFailure)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = result.Error ?? string.Empty
            });
        }

        return Ok(new ApiResponse<NotificarIncidenciasResumenResponse>
        {
            Success = true,
            Message = "Notificaciones de resumen enviadas.",
            Data = result.Value
        });
    }
}
