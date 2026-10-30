using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/calendario")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class CalendarioController : ControllerBase
{
    private readonly ICalendarioService _service;
    private readonly IAsignadorEspecialistasService _asignador;

    public CalendarioController(
        ICalendarioService service,
        IAsignadorEspecialistasService asignador)
    {
        _service = service;
        _asignador = asignador;
    }

    [HttpGet]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Calendario unificado de visitas y talleres",
        Description = "Retorna visitas con su taller, nombres, estado, candado y conflictos. Rango máximo 45 días.")]
    [SwaggerResponse(200, "Calendario obtenido", typeof(ApiResponse<List<CalendarioItemDto>>))]
    public async Task<IActionResult> Get(
        [FromQuery] CalendarioFiltro filtro,
        CancellationToken ct)
    {
        try
        {
            var items = await _service.GetCalendarioAsync(
                filtro,
                User.GetUserId(),
                PuedeVerTodas(),
                ct);
            return Ok(new ApiResponse<List<CalendarioItemDto>>
            {
                Success = true,
                Message = "Calendario obtenido exitosamente.",
                Data = items,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idRutaVisita:int}")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Detalle de una visita/taller del calendario",
        Description = "Retorna la misma ficha del calendario para una visita concreta.")]
    [SwaggerResponse(200, "Detalle obtenido", typeof(ApiResponse<CalendarioItemDto>))]
    [SwaggerResponse(404, "Visita no encontrada")]
    public async Task<IActionResult> GetItem(int idRutaVisita, CancellationToken ct)
    {
        var item = await _service.GetItemAsync(
            idRutaVisita,
            User.GetUserId(),
            PuedeVerTodas(),
            ct);
        if (item is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"Visita {idRutaVisita} no encontrada.",
            });
        }

        return Ok(new ApiResponse<CalendarioItemDto>
        {
            Success = true,
            Message = "Detalle obtenido exitosamente.",
            Data = item,
        });
    }

    [HttpGet("visitas/{idRutaVisita:int}/actividad")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Actividad de una visita",
        Description = "Historial de la visita, sus talleres, solicitudes de cambio y ajustes post-cierre.")]
    [SwaggerResponse(200, "Actividad obtenida", typeof(ApiResponse<ActividadVisitaDto>))]
    [SwaggerResponse(404, "Visita no encontrada")]
    public async Task<IActionResult> GetActividadVisita(int idRutaVisita, CancellationToken ct)
    {
        var actividad = await _service.GetActividadVisitaAsync(
            idRutaVisita, User.GetUserId(), PuedeVerTodas(), ct);
        if (actividad is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"Visita {idRutaVisita} no encontrada.",
            });
        }

        return Ok(new ApiResponse<ActividadVisitaDto>
        {
            Success = true,
            Message = "Actividad obtenida exitosamente.",
            Data = actividad,
        });
    }

    [HttpGet("sugerencias")]
    [HasPermission(Permissions.EducacionMedica.RutasVer)]
    [SwaggerOperation(
        Summary = "Sugerir especialistas para el calendario",
        Description = "Propone especialistas para visitas sin asignar priorizando ciudad/día y respetando capacidad.")]
    [SwaggerResponse(200, "Sugerencias obtenidas", typeof(ApiResponse<List<SugerenciaEspecialistaDto>>))]
    public async Task<IActionResult> GetSugerencias(
        [FromQuery] int idSeleccion,
        [FromQuery] DateOnly? desde,
        [FromQuery] DateOnly? hasta,
        CancellationToken ct)
    {
        try
        {
            var sugerencias = await _asignador.GetSugerenciasAsync(idSeleccion, desde, hasta, ct);
            return Ok(new ApiResponse<List<SugerenciaEspecialistaDto>>
            {
                Success = true,
                Message = "Sugerencias obtenidas exitosamente.",
                Data = sugerencias,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("visitas/{idRutaVisita:int}/especialista")]
    [HasPermission(Permissions.EducacionMedica.RutasGestionar)]
    [SwaggerOperation(
        Summary = "Asignar especialista desde el calendario",
        Description = "Asigna/reasigna el especialista validando elegibilidad por gerencia y capacidad.")]
    [SwaggerResponse(200, "Especialista asignado", typeof(ApiResponse<object>))]
    [SwaggerResponse(404, "Visita no encontrada")]
    [SwaggerResponse(409, "Validación de elegibilidad o capacidad fallida")]
    public async Task<IActionResult> AsignarEspecialista(
        int idRutaVisita,
        [FromBody] AsignarEspecialistaVisitaRequest request,
        CancellationToken ct)
    {
        try
        {
            var asignada = await _asignador.AsignarEspecialistaAsync(
                idRutaVisita, request, User.GetUserId(), ct);
            if (!asignada)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Visita {idRutaVisita} no encontrada.",
                });
            }

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Especialista asignado a la visita exitosamente.",
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    private bool PuedeVerTodas() =>
        User.TienePermiso(Permissions.EducacionMedica.CalendarioVerTodos)
        || User.TienePermiso(Permissions.EducacionMedica.RutasVer);
}
