using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/parametros-anestesias")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class ParametrosAnestesiasController : ControllerBase
{
    private readonly IParametroAnestesiaService _parametroService;
    private readonly IHospitalService _hospitalService;

    public ParametrosAnestesiasController(
        IParametroAnestesiaService parametroService,
        IHospitalService hospitalService)
    {
        _parametroService = parametroService;
        _hospitalService = hospitalService;
    }

    [HttpGet("{anio}")]
    [SwaggerOperation(
        Summary = "Obtener parametros de anestesias por anio",
        Description = "Retorna los factores configurables del calculo de anestesias para el anio indicado.")]
    [SwaggerResponse(200, "Parametros obtenidos", typeof(ApiResponse<List<ParametroAnestesiaDto>>))]
    public async Task<IActionResult> GetByAnio(int anio, CancellationToken ct)
    {
        var parametros = await _parametroService.GetByAnioAsync(anio, ct);
        return Ok(new ApiResponse<List<ParametroAnestesiaDto>>
        {
            Success = true,
            Message = "Parametros obtenidos exitosamente.",
            Data = parametros
        });
    }

    [HttpGet("actual")]
    [SwaggerOperation(
        Summary = "Obtener parametros de anestesias activos",
        Description = "Retorna los factores configurables del anio mas reciente.")]
    [SwaggerResponse(200, "Parametros obtenidos", typeof(ApiResponse<List<ParametroAnestesiaDto>>))]
    public async Task<IActionResult> GetActual(CancellationToken ct)
    {
        var parametros = await _parametroService.GetActualAsync(ct);
        return Ok(new ApiResponse<List<ParametroAnestesiaDto>>
        {
            Success = true,
            Message = "Parametros activos obtenidos exitosamente.",
            Data = parametros
        });
    }

    [HttpPut("{anio}")]
    [SwaggerOperation(
        Summary = "Guardar parametros de anestesias",
        Description = "Actualiza o crea los factores configurables para el anio indicado.")]
    [SwaggerResponse(200, "Parametros guardados", typeof(ApiResponse<List<ParametroAnestesiaDto>>))]
    public async Task<IActionResult> Upsert(
        int anio,
        [FromBody] UpsertParametrosAnestesiasRequest request,
        CancellationToken ct)
    {
        var idUsuario = GetUserId();
        var parametros = await _parametroService.UpsertAsync(anio, request, idUsuario, ct);
        return Ok(new ApiResponse<List<ParametroAnestesiaDto>>
        {
            Success = true,
            Message = "Parametros guardados exitosamente.",
            Data = parametros
        });
    }

    [HttpPost("{anio}/recalcular")]
    [SwaggerOperation(
        Summary = "Recalcular anestesias",
        Description = "Recalcula las columnas de anestesias de todas las hospital_extension usando los parametros del anio indicado.")]
    [SwaggerResponse(200, "Anestesias recalculadas", typeof(ApiResponse<RecalcularAnestesiasResponse>))]
    public async Task<IActionResult> Recalcular(int anio, CancellationToken ct)
    {
        var registrosActualizados = await _hospitalService.RecalcularAnestesiasAsync(anio, ct);
        return Ok(new ApiResponse<RecalcularAnestesiasResponse>
        {
            Success = true,
            Message = "Anestesias recalculadas exitosamente.",
            Data = new RecalcularAnestesiasResponse
            {
                Anio = anio,
                RegistrosActualizados = registrosActualizados
            }
        });
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}
