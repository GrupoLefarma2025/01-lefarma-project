using Lefarma.API.Features.Archivos.DTOs;
using Lefarma.API.Features.Archivos.Services;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Archivos.Controllers;

[ApiController]
[Route("api/archivos/externo")]
[EndpointGroupName("Archivos-Externo")]
public class ArchivoExternoController : ControllerBase
{
    private readonly IArchivoService _service;
    private readonly IConfiguration _configuration;

    public ArchivoExternoController(IArchivoService service, IConfiguration configuration)
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

    [HttpPost("upload")]
    [AllowAnonymous]
    [RequestSizeLimit(50_000_000)] 
    [Consumes("multipart/form-data")]
    [SwaggerOperation(Summary = "Subir archivo desde sistema externo", Description = "Requiere X-API-Key y X-User-Id en headers.")]
    public async Task<IActionResult> Upload(
        [FromForm] SubirArchivoRequest request,
        IFormFile file)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        if (file == null || file.Length == 0)
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "No se proporcionó ningún archivo",
                Data = null
            });

        var userId = GetExternalUserId();
        if (userId == 0)
            userId = int.TryParse(_configuration["Auth:AnonymousUserId"], out var defaultUid) ? defaultUid : 0;

        using var stream = file.OpenReadStream();

        var result = await _service.SubirAsync(stream, file.FileName, file.ContentType, request, userId);

        return result.ToActionResult(this, archivo => Ok(new ApiResponse<ArchivoResponse>
        {
            Success = true,
            Message = "Archivo subido exitosamente",
            Data = archivo
        }));
    }
}
