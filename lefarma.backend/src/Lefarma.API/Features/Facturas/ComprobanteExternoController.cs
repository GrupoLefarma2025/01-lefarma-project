using Lefarma.API.Features.Facturas.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Facturas;

[ApiController]
[Route("api/facturas/externo")]
[EndpointGroupName("Facturas-Externo")]
public class ComprobanteExternoController : ControllerBase
{
    private readonly IComprobanteService _service;
    private readonly IConfiguration _configuration;

    public ComprobanteExternoController(IComprobanteService service, IConfiguration configuration)
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

    [HttpPost]
    [AllowAnonymous]
    [RequestSizeLimit(50_000_000)]
    [Consumes("multipart/form-data")]
    [SwaggerOperation(Summary = "Subir comprobante desde sistema externo", Description = "Requiere X-API-Key y X-User-Id en headers.")]
    public async Task<IActionResult> Subir(
        [FromForm] SubirComprobanteRequest request,
        IFormFile? xmlFile,
        IFormFile? archivo,
        CancellationToken ct)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        var userId = GetExternalUserId();
        if (userId == 0)
            userId = int.TryParse(_configuration["Auth:AnonymousUserId"], out var defaultUid) ? defaultUid : 0;

        string? xmlContent = null;
        if (xmlFile != null && xmlFile.Length > 0)
        {
            using var sr = new StreamReader(xmlFile.OpenReadStream());
            xmlContent = await sr.ReadToEndAsync(ct);
        }

        MemoryStream? archivoStream = null;
        if (archivo != null && archivo.Length > 0)
        {
            archivoStream = new MemoryStream();
            await archivo.OpenReadStream().CopyToAsync(archivoStream, ct);
            archivoStream.Position = 0;
        }

        var result = await _service.SubirAsync(
            request,
            xmlContent, xmlFile?.FileName,
            archivoStream, archivo?.FileName, archivo?.ContentType,
            userId,
            ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ComprobanteResponse>
        {
            Success = true,
            Message = "Comprobante subido exitosamente.",
            Data = data
        }));
    }

    [HttpGet("partidas-pendientes")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Partidas pendientes desde sistema externo", Description = "Requiere X-API-Key en header.")]
    public async Task<IActionResult> GetPartidasPendientes([FromQuery] int idOrden, [FromQuery] string categoria = "gasto", CancellationToken ct = default)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        var result = await _service.GetPartidasPendientesAsync(idOrden, categoria, ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<List<PartidaPendienteResponse>>
        {
            Success = true,
            Message = "Partidas pendientes obtenidas.",
            Data = data
        }));
    }

    [HttpPost("{id:int}/asignar-partidas")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Asignar partidas desde sistema externo", Description = "Requiere X-API-Key y X-User-Id en headers.")]
    public async Task<IActionResult> AsignarPartidas(
        int id,
        [FromBody] AsignarPartidasRequest request,
        [FromQuery] int? idPasoWorkflow,
        CancellationToken ct)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        var userId = GetExternalUserId();
        if (userId == 0)
            userId = int.TryParse(_configuration["Auth:AnonymousUserId"], out var defaultUid) ? defaultUid : 0;

        var result = await _service.AsignarPartidasAsync(id, request, userId, idPasoWorkflow, ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<ComprobanteResponse>
        {
            Success = true,
            Message = "Partidas asignadas exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Obtener comprobante por ID desde sistema externo", Description = "Requiere X-API-Key en header.")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        var result = await _service.GetByIdAsync(id, ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<ComprobanteResponse>
        {
            Success = true,
            Message = "Comprobante obtenido.",
            Data = data
        }));
    }
}
