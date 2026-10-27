using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/rutas")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class RutasAsignacionController : ControllerBase
{
    private readonly IAsignadorEspecialistasService _service;

    public RutasAsignacionController(IAsignadorEspecialistasService service)
    {
        _service = service;
    }

    [HttpPut("visitas/{idRutaVisita:int}/especialista")]
    [HasPermission(Permissions.EducacionMedica.RutasGestionar)]
    [SwaggerOperation(
        Summary = "Asignar especialista a una visita",
        Description = "Asigna/reasigna el especialista de una visita validando elegibilidad por gerencia y capacidad (máximo diario/semanal configurable).")]
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
            var asignada = await _service.AsignarEspecialistaAsync(
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

    [HttpGet("sugerencias")]
    [HasPermission(Permissions.EducacionMedica.RutasVer)]
    [SwaggerOperation(
        Summary = "Sugerir especialistas para visitas sin asignar",
        Description = "Propone un especialista por visita sin asignar, priorizando quien ya tiene visitas en la misma ciudad/día y respetando capacidad.")]
    [SwaggerResponse(200, "Sugerencias obtenidas", typeof(ApiResponse<List<SugerenciaEspecialistaDto>>))]
    public async Task<IActionResult> GetSugerencias(
        [FromQuery] int idSeleccion,
        [FromQuery] DateOnly? desde,
        [FromQuery] DateOnly? hasta,
        CancellationToken ct)
    {
        try
        {
            var sugerencias = await _service.GetSugerenciasAsync(idSeleccion, desde, hasta, ct);
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
}
