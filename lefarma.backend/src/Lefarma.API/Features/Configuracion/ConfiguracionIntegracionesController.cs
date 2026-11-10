using ErrorOr;
using Lefarma.API.Features.Configuracion.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Clientes de integración (API keys) y API externa de consulta de variables.
/// Los endpoints administrativos requieren el permiso configuracion.api_keys;
/// los endpoints externos se autentican con el encabezado X-API-Key.
/// </summary>
[ApiController]
[Route("api/configuracion")]
[EndpointGroupName("Configuracion")]
[Authorize]
[HasPermission(Permissions.Configuracion.ApiKeys)]
public class ConfiguracionIntegracionesController : ControllerBase
{
    private const string EncabezadoApiKey = "X-API-Key";

    private readonly IConfiguracionIntegracionesService _service;

    public ConfiguracionIntegracionesController(IConfiguracionIntegracionesService service)
    {
        _service = service;
    }

    // ------------------------------------------------------- administración

    /// <summary>Lista los clientes de integración.</summary>
    [HttpGet("integraciones-clientes")]
    [SwaggerOperation(
        Summary = "Listar clientes de integración",
        Description = "Lista los clientes de integración. Nunca devuelve la llave completa ni el hash.")]
    [SwaggerResponse(200, "Clientes obtenidos", typeof(ApiResponse<List<IntegracionClienteResponse>>))]
    [SwaggerResponse(403, "Sin permiso configuracion.api_keys")]
    public async Task<IActionResult> ListarClientes(CancellationToken ct)
    {
        var result = await _service.ListarAsync(ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<List<IntegracionClienteResponse>>
        {
            Success = true,
            Message = "Clientes de integración obtenidos exitosamente.",
            Data = data
        }));
    }

    /// <summary>Crea un cliente de integración y devuelve su llave una sola vez.</summary>
    [HttpPost("integraciones-clientes")]
    [SwaggerOperation(
        Summary = "Crear cliente de integración",
        Description = "Genera una API key criptográfica. La llave completa se devuelve UNA sola vez; solo se persiste su SHA-256.")]
    [SwaggerResponse(200, "Cliente creado", typeof(ApiResponse<IntegracionCreadaResponse>))]
    [SwaggerResponse(400, "Datos inválidos")]
    public async Task<IActionResult> CrearCliente(
        [FromBody] CrearIntegracionRequest request,
        CancellationToken ct)
    {
        var result = await _service.CrearAsync(request, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IntegracionCreadaResponse>
        {
            Success = true,
            Message = "Cliente de integración creado exitosamente. Guarde la llave: no se volverá a mostrar.",
            Data = data
        }));
    }

    /// <summary>Revoca un cliente de integración.</summary>
    [HttpPost("integraciones-clientes/{id:int}/revocar")]
    [SwaggerOperation(
        Summary = "Revocar cliente de integración",
        Description = "Desactiva la API key del cliente. Las consultas posteriores con esa llave devuelven 401.")]
    [SwaggerResponse(200, "Cliente revocado", typeof(ApiResponse<IntegracionClienteResponse>))]
    [SwaggerResponse(404, "Cliente no encontrado")]
    public async Task<IActionResult> RevocarCliente(int id, CancellationToken ct)
    {
        var result = await _service.RevocarAsync(id, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IntegracionClienteResponse>
        {
            Success = true,
            Message = "Cliente de integración revocado exitosamente.",
            Data = data
        }));
    }

    // -------------------------------------------------------------- externo

    /// <summary>Consulta externa de una variable (API key).</summary>
    [AllowAnonymous]
    [HttpGet("integraciones/variables/{clave}")]
    [SwaggerOperation(
        Summary = "API externa: obtener una variable",
        Description = "Requiere el encabezado X-API-Key. Solo devuelve variables activas y disponibles para integraciones. La respuesta es directa, sin ApiResponse.")]
    [SwaggerResponse(200, "Variable obtenida", typeof(IntegracionVariableResponse))]
    [SwaggerResponse(401, "API key inválida, revocada o expirada")]
    [SwaggerResponse(404, "Variable no disponible para integraciones")]
    public async Task<IActionResult> ConsultarVariableExterna(string clave, CancellationToken ct)
    {
        var apiKey = ObtenerApiKey();
        var result = await _service.ObtenerVariableAsync(apiKey, clave, ct);

        return ResultadoExterno(result);
    }

    /// <summary>Consulta externa por lote (API key).</summary>
    [AllowAnonymous]
    [HttpPost("integraciones/variables/consultar")]
    [SwaggerOperation(
        Summary = "API externa: consultar variables por lote",
        Description = "Requiere el encabezado X-API-Key. Devuelve solo las variables activas y disponibles para integraciones; las claves sin acceso o inexistentes se omiten.")]
    [SwaggerResponse(200, "Variables consultadas", typeof(IntegracionBatchResponse))]
    [SwaggerResponse(401, "API key inválida, revocada o expirada")]
    public async Task<IActionResult> ConsultarVariablesExternas(
        [FromBody] IntegracionConsultarRequest request,
        CancellationToken ct)
    {
        var apiKey = ObtenerApiKey();
        var result = await _service.ConsultarVariablesAsync(apiKey, request, ct);

        return ResultadoExterno(result);
    }

    private string? ObtenerApiKey()
    {
        var valor = Request.Headers[EncabezadoApiKey].FirstOrDefault();
        return string.IsNullOrWhiteSpace(valor) ? null : valor;
    }

    private IActionResult ResultadoExterno<T>(ErrorOr<T> result)
    {
        if (!result.IsError)
        {
            return Ok(result.Value);
        }

        var error = result.FirstError;

        return error.Type switch
        {
            ErrorType.Unauthorized => Unauthorized(new { error = error.Description }),
            ErrorType.NotFound => NotFound(new { error = error.Description }),
            ErrorType.Validation => BadRequest(new { error = error.Description }),
            ErrorType.Conflict => Conflict(new { error = error.Description }),
            _ => StatusCode(
                StatusCodes.Status500InternalServerError,
                new { error = "No se pudo completar la operación." })
        };
    }
}
