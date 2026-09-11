using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.EducacionMedica.Services;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/config-ranking")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class ConfigRankingController : ControllerBase
{
    private readonly IConfigRankingService _service;

    public ConfigRankingController(IConfigRankingService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Obtener configuración de ranking activa",
        Description = "Retorna la configuración activa con sus factores y el historial de versiones anteriores.")]
    [SwaggerResponse(200, "Configuración obtenida", typeof(ApiResponse<ConfigRankingConVersionesDto>))]
    [SwaggerResponse(404, "No existe configuración activa")]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var config = await _service.GetActivaAsync(ct);
        if (config is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "No existe una configuración de ranking activa."
            });
        }

        return Ok(new ApiResponse<ConfigRankingConVersionesDto>
        {
            Success = true,
            Message = "Configuración obtenida exitosamente.",
            Data = config
        });
    }

    [HttpGet("listado")]
    [SwaggerOperation(
        Summary = "Listado de configuraciones de ranking",
        Description = "Retorna todas las configuraciones con su estado activo, versión e indicador de uso.")]
    [SwaggerResponse(200, "Listado obtenido", typeof(ApiResponse<List<ConfigRankingResumenDto>>))]
    public async Task<IActionResult> GetListado(CancellationToken ct)
    {
        var listado = await _service.GetListadoAsync(ct);
        return Ok(new ApiResponse<List<ConfigRankingResumenDto>>
        {
            Success = true,
            Message = "Listado obtenido exitosamente.",
            Data = listado
        });
    }

    [HttpGet("{idConfiguracion:int}")]
    [SwaggerOperation(
        Summary = "Obtener configuración de ranking por id",
        Description = "Retorna la configuración con sus factores y el indicador de si ya fue usada.")]
    [SwaggerResponse(200, "Configuración obtenida", typeof(ApiResponse<ConfigRankingDto>))]
    [SwaggerResponse(404, "Configuración no encontrada")]
    public async Task<IActionResult> GetById(int idConfiguracion, CancellationToken ct)
    {
        var config = await _service.GetByIdAsync(idConfiguracion, ct);
        if (config is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "La configuración de ranking solicitada no existe."
            });
        }

        return Ok(new ApiResponse<ConfigRankingDto>
        {
            Success = true,
            Message = "Configuración obtenida exitosamente.",
            Data = config
        });
    }

    [HttpPost("{idConfiguracion:int}/nueva-version")]
    [SwaggerOperation(
        Summary = "Crear nueva versión de la configuración",
        Description = "Copia la configuración indicada en una nueva versión y la deja como activa (V1: una sola activa).")]
    [SwaggerResponse(200, "Nueva versión creada", typeof(ApiResponse<ConfigRankingDto>))]
    [SwaggerResponse(404, "Configuración no encontrada")]
    public async Task<IActionResult> CrearNuevaVersion(int idConfiguracion, CancellationToken ct)
    {
        try
        {
            var config = await _service.CrearNuevaVersionAsync(idConfiguracion, GetUserId(), ct);
            return Ok(new ApiResponse<ConfigRankingDto>
            {
                Success = true,
                Message = "Nueva versión creada exitosamente.",
                Data = config
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{idConfiguracion:int}")]
    [SwaggerOperation(
        Summary = "Editar configuración no usada",
        Description = "Permite modificar una configuración que no haya sido usada en ninguna ejecución de ranking. Valida que los pesos activos sumen 100.")]
    [SwaggerResponse(200, "Configuración actualizada", typeof(ApiResponse<ConfigRankingDto>))]
    [SwaggerResponse(409, "Configuración ya usada, pesos inválidos o datos inconsistentes")]
    public async Task<IActionResult> Update(
        int idConfiguracion,
        [FromBody] UpsertConfigRankingRequest request,
        CancellationToken ct)
    {
        try
        {
            var config = await _service.UpdateAsync(idConfiguracion, request, GetUserId(), ct);
            return Ok(new ApiResponse<ConfigRankingDto>
            {
                Success = true,
                Message = "Configuración actualizada exitosamente.",
                Data = config
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
