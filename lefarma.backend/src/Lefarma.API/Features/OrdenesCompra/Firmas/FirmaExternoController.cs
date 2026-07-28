using Lefarma.API.Features.OrdenesCompra.Firmas.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.OrdenesCompra.Firmas;

[ApiController]
[Route("api/ordenes/externo")]
[EndpointGroupName("OrdenesCompra-Externo")]
public class FirmaExternoController : ControllerBase
{
    private readonly IFirmasService _service;
    private readonly IConfiguration _configuration;

    public FirmaExternoController(IFirmasService service, IConfiguration configuration)
    {
        _service = service;
        _configuration = configuration;
    }

    private bool ValidateApiKey(out IActionResult? errorResponse)
    {
        errorResponse = null;
        var apiKey = _configuration["Auth:ApiKey"];
        var providedKey = HttpContext.Request.Headers["X-API-Key"].FirstOrDefault();

        if (string.IsNullOrEmpty(providedKey)
            || string.IsNullOrEmpty(apiKey)
            || !string.Equals(providedKey, apiKey, StringComparison.OrdinalIgnoreCase))
        {
            errorResponse = Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "API Key inválida o no proporcionada."
            });
            return false;
        }

        return true;
    }

    private int GetExternalUserId()
    {
        var userIdHeader = HttpContext.Request.Headers["X-User-Id"].FirstOrDefault();
        return int.TryParse(userIdHeader, out var uid) ? uid : 0;
    }

    [HttpPost("{id}/firmar")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Firmar orden desde sistema externo", Description = "Requiere X-API-Key y X-User-Id en headers.")]
    public async Task<IActionResult> Firmar(int id, [FromBody] FirmarRequest request)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        var userId = GetExternalUserId();
        if (userId == 0)
            userId = int.TryParse(_configuration["Auth:AnonymousUserId"], out var defaultUid) ? defaultUid : 0;

        var result = await _service.FirmarAsync(id, request, userId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<FirmarResponse>
        { Success = true, Message = data?.Mensaje ?? "Firma ejecutada exitosamente.", Data = data }));
    }

    [HttpGet("{id}/acciones")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Obtener acciones disponibles desde sistema externo", Description = "Requiere X-API-Key y X-User-Id en headers.")]
    public async Task<IActionResult> GetAcciones(int id)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        var userId = GetExternalUserId();
        if (userId == 0)
            userId = int.TryParse(_configuration["Auth:AnonymousUserId"], out var defaultUid) ? defaultUid : 0;

        var result = await _service.GetAccionesAsync(id, userId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<AccionDisponibleResponse>>
        { Success = true, Message = "Acciones obtenidas exitosamente.", Data = data }));
    }

    [HttpGet("{id}/acciones/{idAccion}/metadata")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Obtener metadatos de acción desde sistema externo", Description = "Requiere X-API-Key y X-User-Id en headers.")]
    public async Task<IActionResult> GetAccionMetadata(int id, int idAccion)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        var userId = GetExternalUserId();
        if (userId == 0)
            userId = int.TryParse(_configuration["Auth:AnonymousUserId"], out var defaultUid) ? defaultUid : 0;

        var result = await _service.GetAccionMetadataAsync(id, idAccion, userId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<AccionMetadataResponse>
        { Success = true, Message = "Metadatos obtenidos exitosamente.", Data = data }));
    }

    [HttpGet("{id}/historial-workflow")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Obtener historial de workflow desde sistema externo", Description = "Requiere X-API-Key en header.")]
    public async Task<IActionResult> GetHistorialWorkflow(int id)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        var result = await _service.GetHistorialWorkflowAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HistorialWorkflowItemResponse>>
        { Success = true, Message = "Historial obtenido exitosamente.", Data = data }));
    }
}
