using System.Security.Claims;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/matrices-talleres")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
[HasPermission(Permissions.EducacionMedica.TalleresVer)]
public class MatrizTalleresController : ControllerBase
{
    private readonly IMatrizTalleresService _service;

    public MatrizTalleresController(IMatrizTalleresService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Matrices generales (resumen)",
        Description = "Lista por gerencia y/o periodo (YYYY-MM), con paso/estado del workflow, número de talleres y costo total.")]
    [SwaggerResponse(200, "Matrices", typeof(ApiResponse<List<MatrizGeneralResumenDto>>))]
    public async Task<IActionResult> GetMatrices([FromQuery] int? gerencia, [FromQuery] string? periodo, CancellationToken ct)
    {
        try
        {
            var matrices = await _service.GetMatricesAsync(gerencia, periodo, ct);
            return Ok(new ApiResponse<List<MatrizGeneralResumenDto>>
            {
                Success = true,
                Message = "Matrices obtenidas exitosamente.",
                Data = matrices
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idMatrizGeneral:int}")]
    [SwaggerOperation(
        Summary = "Detalle de la matriz general",
        Description = "Talleres con recursos, costo total (SUM de subtotales), paso/estado del workflow y acciones disponibles para el usuario.")]
    [SwaggerResponse(200, "Detalle", typeof(ApiResponse<MatrizTalleresDetalleDto>))]
    [SwaggerResponse(409, "Matriz no encontrada")]
    public async Task<IActionResult> GetMatriz(int idMatrizGeneral, CancellationToken ct)
    {
        try
        {
            var detalle = await _service.GetMatrizAsync(idMatrizGeneral, GetUserId(), ct);
            return Ok(new ApiResponse<MatrizTalleresDetalleDto>
            {
                Success = true,
                Message = "Matriz obtenida exitosamente.",
                Data = detalle
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idMatrizGeneral:int}/concentracion")]
    [SwaggerOperation(
        Summary = "Panel Matrices por equipo",
        Description = "Estado de la matriz individual de cada equipo con talleres en la general (Generada/EnCaptura).")]
    [SwaggerResponse(200, "Concentración", typeof(ApiResponse<List<ConcentracionEquipoDto>>))]
    public async Task<IActionResult> GetConcentracion(int idMatrizGeneral, CancellationToken ct)
    {
        try
        {
            var concentracion = await _service.GetConcentracionAsync(idMatrizGeneral, ct);
            return Ok(new ApiResponse<List<ConcentracionEquipoDto>>
            {
                Success = true,
                Message = "Concentración obtenida exitosamente.",
                Data = concentracion
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{idMatrizGeneral:int}/talleres/{idTaller:int}/costos")]
    [HasPermission(Permissions.EducacionMedica.TalleresCapturar)]
    [SwaggerOperation(
        Summary = "Registrar costos de un taller (AEM)",
        Description = "Reemplaza los recursos del taller con sus costos y recalcula subtotales. Solo el participante del paso de registro de costos y solo en ese paso.")]
    [SwaggerResponse(200, "Costos registrados", typeof(ApiResponse<TallerDto>))]
    [SwaggerResponse(409, "Paso o participación inválida")]
    public async Task<IActionResult> ActualizarCostos(int idMatrizGeneral, int idTaller, [FromBody] ActualizarCostosTallerRequest request, CancellationToken ct)
    {
        try
        {
            var taller = await _service.ActualizarCostosAsync(idMatrizGeneral, idTaller, request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerDto>
            {
                Success = true,
                Message = "Costos registrados exitosamente.",
                Data = taller
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idMatrizGeneral:int}/firmar")]
    [SwaggerOperation(
        Summary = "Ejecutar una acción del workflow sobre la matriz",
        Description = "ENVIAR (Concentración -> firma GV; AEM -> CA), AUTORIZAR (GV, CA y DC, con firma digital) y DEVOLVER (comentario), según las acciones del paso actual. Salvaguarda: a partir de la revisión de costos del CA ningún AUTORIZAR avanza con talleres sin costos. Al autorizar DC, los talleres pasan a Autorizado.")]
    [SwaggerResponse(200, "Acción registrada", typeof(ApiResponse<MatrizTalleresDetalleDto>))]
    [SwaggerResponse(409, "Acción no disponible, sin firma digital o salvaguarda de costos")]
    public async Task<IActionResult> Firmar(int idMatrizGeneral, [FromBody] FirmarWorkflowRequest request, CancellationToken ct)
    {
        try
        {
            var detalle = await _service.FirmarAsync(idMatrizGeneral, request, GetUserId(), ct);
            return Ok(new ApiResponse<MatrizTalleresDetalleDto>
            {
                Success = true,
                Message = "Acción registrada exitosamente.",
                Data = detalle
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idMatrizGeneral:int}/acciones-disponibles")]
    [SwaggerOperation(Summary = "Acciones del workflow disponibles para el usuario en el paso actual")]
    [SwaggerResponse(200, "Acciones", typeof(ApiResponse<IEnumerable<AccionDisponibleResponse>>))]
    public async Task<IActionResult> GetAccionesDisponibles(int idMatrizGeneral, CancellationToken ct)
    {
        var resultado = await _service.GetAccionesDisponiblesAsync(idMatrizGeneral, GetUserId(), ct);
        if (resultado.IsError)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = resultado.FirstError.Description });
        }

        return Ok(new ApiResponse<IEnumerable<AccionDisponibleResponse>>
        {
            Success = true,
            Message = "Acciones obtenidas.",
            Data = resultado.Value
        });
    }

    [HttpGet("{idMatrizGeneral:int}/historial")]
    [SwaggerOperation(Summary = "Historial de workflow de la matriz (bitácora)")]
    [SwaggerResponse(200, "Historial", typeof(ApiResponse<IEnumerable<HistorialWorkflowItemResponse>>))]
    public async Task<IActionResult> GetHistorial(int idMatrizGeneral, CancellationToken ct)
    {
        var resultado = await _service.GetHistorialAsync(idMatrizGeneral, ct);
        if (resultado.IsError)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = resultado.FirstError.Description });
        }

        return Ok(new ApiResponse<IEnumerable<HistorialWorkflowItemResponse>>
        {
            Success = true,
            Message = "Historial obtenido.",
            Data = resultado.Value
        });
    }

    [HttpGet("{idMatrizGeneral:int}/documento")]
    [SwaggerOperation(
        Summary = "Documento imprimible de la matriz (FOR-005)",
        Description = "Título 'Matriz de talleres {MM/yyyy} – {Gerencia}', filas de talleres con costos, costo total y firmas de la bitácora.")]
    [SwaggerResponse(200, "Documento", typeof(ApiResponse<MatrizDocumentoDto>))]
    public async Task<IActionResult> GetDocumento(int idMatrizGeneral, CancellationToken ct)
    {
        try
        {
            var documento = await _service.GetDocumentoAsync(idMatrizGeneral, ct);
            return Ok(new ApiResponse<MatrizDocumentoDto>
            {
                Success = true,
                Message = "Documento obtenido exitosamente.",
                Data = documento
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
