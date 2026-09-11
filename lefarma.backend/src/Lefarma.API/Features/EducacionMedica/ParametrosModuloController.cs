using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/parametros-modulo")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class ParametrosModuloController : ControllerBase
{
    private readonly IParametroModuloService _service;

    public ParametrosModuloController(IParametroModuloService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Obtener parámetros del módulo",
        Description = "Retorna los parámetros configurables de planificación (radio de clustering, topes de capacidad, límite de viajes foráneos).")]
    [SwaggerResponse(200, "Parámetros obtenidos", typeof(ApiResponse<List<ParametroModuloDto>>))]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var parametros = await _service.GetAllAsync(ct);
        return Ok(new ApiResponse<List<ParametroModuloDto>>
        {
            Success = true,
            Message = "Parámetros obtenidos exitosamente.",
            Data = parametros
        });
    }

    [HttpPut]
    [SwaggerOperation(
        Summary = "Guardar parámetros del módulo",
        Description = "Actualiza (o crea) los valores por clave; se aplican sin tocar código.")]
    [SwaggerResponse(200, "Parámetros guardados", typeof(ApiResponse<List<ParametroModuloDto>>))]
    [SwaggerResponse(409, "Valores inválidos")]
    public async Task<IActionResult> Upsert([FromBody] List<UpsertParametroModuloRequest> request, CancellationToken ct)
    {
        try
        {
            var idUsuario = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
            var parametros = await _service.UpsertAsync(request, idUsuario, ct);
            return Ok(new ApiResponse<List<ParametroModuloDto>>
            {
                Success = true,
                Message = "Parámetros guardados exitosamente.",
                Data = parametros
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }
}
