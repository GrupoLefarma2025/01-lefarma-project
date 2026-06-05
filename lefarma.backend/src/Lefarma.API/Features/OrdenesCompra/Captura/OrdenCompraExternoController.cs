using Lefarma.API.Features.OrdenesCompra.Captura.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.OrdenesCompra.Captura;

[ApiController]
[Route("api/ordenes/externo")]
[EndpointGroupName("OrdenesCompra-Externo")]
public class OrdenCompraExternoController : ControllerBase
{
    private readonly IOrdenCompraService _service;
    private readonly IConfiguration _configuration;

    public OrdenCompraExternoController(IOrdenCompraService service, IConfiguration configuration)
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
    [SwaggerOperation(Summary = "Crear orden de compra desde sistema externo", Description = "Requiere X-API-Key y X-User-Id en headers.")]
    public async Task<IActionResult> Create([FromBody] CreateOrdenCompraRequest request)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        var userId = GetExternalUserId();
        if (userId == 0)
            userId = int.TryParse(_configuration["Auth:AnonymousUserId"], out var defaultUid) ? defaultUid : 0;

        var result = await _service.CreateAsync(request, userId, HttpContext.RequestAborted);
        return result.ToActionResult(this, data => CreatedAtAction(nameof(GetById),
            new { id = data.IdOrden },
            new ApiResponse<OrdenCompraResponse> { Success = true, Message = "Orden creada exitosamente.", Data = data }));
    }

    [HttpPut("{id}")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Actualizar orden de compra desde sistema externo", Description = "Requiere X-API-Key y X-User-Id en headers.")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateOrdenCompraRequest? request)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        if (request == null)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Datos requeridos" });

        var userId = GetExternalUserId();
        if (userId == 0)
            userId = int.TryParse(_configuration["Auth:AnonymousUserId"], out var defaultUid) ? defaultUid : 0;

        var result = await _service.UpdateAsync(id, request, userId, HttpContext.RequestAborted);
        return result.ToActionResult(this, data => Ok(new ApiResponse<OrdenCompraResponse>
        { Success = true, Message = "Orden actualizada exitosamente.", Data = data }));
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Obtener orden de compra por ID desde sistema externo", Description = "Requiere X-API-Key en header.")]
    public async Task<IActionResult> GetById(int id)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        var result = await _service.GetByIdAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<OrdenCompraResponse>
        { Success = true, Message = "Orden obtenida exitosamente.", Data = data }));
    }
}
