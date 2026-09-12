using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.EducacionMedica.Services;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/selecciones-mensuales")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class RankingHospitalesController : ControllerBase
{
    private readonly IRankingHospitalesService _rankingService;

    public RankingHospitalesController(IRankingHospitalesService rankingService)
    {
        _rankingService = rankingService;
    }

    [HttpPost("{idSeleccionMensual:int}/ranking")]
    [SwaggerOperation(
        Summary = "Generar ranking de hospitales",
        Description = "Ejecuta el motor de scoring sobre el catálogo de hospitales y persiste el ranking sugerido para la selección.")]
    [SwaggerResponse(200, "Ranking generado", typeof(ApiResponse<RankingEjecucionDto>))]
    [SwaggerResponse(409, "Selección no editable, sin configuración activa o sin candidatos")]
    public async Task<IActionResult> Generar(
        int idSeleccionMensual,
        [FromBody] GenerarRankingRequest request,
        CancellationToken ct)
    {
        try
        {
            var ranking = await _rankingService.GenerarRankingAsync(idSeleccionMensual, request, GetUserId(), ct);
            return Ok(new ApiResponse<RankingEjecucionDto>
            {
                Success = true,
                Message = "Ranking generado exitosamente.",
                Data = ranking
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idSeleccionMensual:int}/ranking/ultimo")]
    [SwaggerOperation(
        Summary = "Obtener último ranking generado",
        Description = "Retorna la ejecución más reciente del ranking para la selección.")]
    [SwaggerResponse(200, "Ranking obtenido", typeof(ApiResponse<RankingEjecucionDto>))]
    [SwaggerResponse(404, "No existe ningún ranking para la selección")]
    public async Task<IActionResult> GetUltimo(int idSeleccionMensual, CancellationToken ct)
    {
        var ranking = await _rankingService.GetUltimaEjecucionAsync(idSeleccionMensual, ct);
        if (ranking is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"No existe un ranking para la selección {idSeleccionMensual}."
            });
        }

        return Ok(new ApiResponse<RankingEjecucionDto>
        {
            Success = true,
            Message = "Ranking obtenido exitosamente.",
            Data = ranking
        });
    }

    [HttpGet("{idSeleccionMensual:int}/ranking/{idRankingEjecucion:int}")]
    [SwaggerOperation(
        Summary = "Obtener ejecución histórica de ranking",
        Description = "Retorna una ejecución específica del ranking en modo solo lectura.")]
    [SwaggerResponse(200, "Ranking obtenido", typeof(ApiResponse<RankingEjecucionDto>))]
    [SwaggerResponse(404, "Ranking no encontrado")]
    public async Task<IActionResult> GetById(int idSeleccionMensual, int idRankingEjecucion, CancellationToken ct)
    {
        var ranking = await _rankingService.GetByIdAsync(idRankingEjecucion, ct);
        if (ranking is null || ranking.IdSeleccionMensual != idSeleccionMensual)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"La ejecución {idRankingEjecucion} no existe para la selección {idSeleccionMensual}."
            });
        }

        return Ok(new ApiResponse<RankingEjecucionDto>
        {
            Success = true,
            Message = "Ranking obtenido exitosamente.",
            Data = ranking
        });
    }

    [HttpGet("{idSeleccionMensual:int}/ranking/filtros-disponibles")]
    [SwaggerOperation(
        Summary = "Obtener filtros opcionales disponibles",
        Description = "Retorna los estados y conteos de local/foráneo de los hospitales candidatos para la selección.")]
    [SwaggerResponse(200, "Filtros disponibles", typeof(ApiResponse<FiltrosDisponiblesDto>))]
    [SwaggerResponse(409, "Selección no editable o sin gerencia")]
    public async Task<IActionResult> GetFiltrosDisponibles(int idSeleccionMensual, CancellationToken ct)
    {
        try
        {
            var filtros = await _rankingService.GetFiltrosDisponiblesAsync(idSeleccionMensual, ct);
            return Ok(new ApiResponse<FiltrosDisponiblesDto>
            {
                Success = true,
                Message = "Filtros disponibles obtenidos exitosamente.",
                Data = filtros
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idSeleccionMensual:int}/hospitales/lote")]
    [SwaggerOperation(
        Summary = "Agregar hospitales sugeridos desde un ranking",
        Description = "Agrega a la selección los hospitales indicados de la ejecución más reciente (o de la ejecución explícita, siempre que sea la última).")]
    [SwaggerResponse(200, "Hospitales agregados", typeof(ApiResponse<List<SeleccionHospitalDto>>))]
    [SwaggerResponse(409, "Selección no editable, hospital duplicado o ejecución no válida")]
    public async Task<IActionResult> AgregarLote(
        int idSeleccionMensual,
        [FromBody] AgregarHospitalesLoteRequest request,
        CancellationToken ct)
    {
        try
        {
            var hospitales = await _rankingService.AplicarSugerenciasAsync(idSeleccionMensual, request, GetUserId(), ct);
            return Ok(new ApiResponse<List<SeleccionHospitalDto>>
            {
                Success = true,
                Message = "Hospitales agregados exitosamente.",
                Data = hospitales
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
