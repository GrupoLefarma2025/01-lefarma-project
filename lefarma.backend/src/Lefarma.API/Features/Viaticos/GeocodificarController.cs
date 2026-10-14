using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Viaticos;

[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
public class GeocodificarController : ControllerBase
{
    private readonly IHttpClientFactory _http;
    private readonly IMemoryCache _cache;

    public GeocodificarController(IHttpClientFactory http, IMemoryCache cache)
    {
        _http = http;
        _cache = cache;
    }

    // Anónimo: el selector de mapa consulta con fetch simple (sin Bearer) y
    // solo expone datos públicos de OSM; el upstream queda acotado por el
    // rate-limit de 1 req/s y el cache de 6 h del servicio.
    [HttpGet("geocodificar")]
    [AllowAnonymous]
    [SwaggerOperation(
        Summary = "Geocodificar dirección (proxy de Nominatim)",
        Description = "Proxy cacheado de nominatim.openstreetmap.org para el selector de puntos en mapa (la política de OSM prohíbe llamarlo desde el navegador): User-Agent identificable, máximo 1 request/s hacia upstream, timeout de 12 s y cache de 6 h. Acota siempre a México (countrycodes=mx, limit=5). tipo=global usa texto; tipo=cascada usa estado, municipio y texto (calle).")]
    [SwaggerResponse(200, "Direcciones geocodificadas (shape de PuntoSeleccion)", typeof(ApiResponse<List<GeocodificarResultado>>))]
    [SwaggerResponse(400, "Parámetros inválidos", typeof(ApiResponse<object>))]
    [SwaggerResponse(502, "Nominatim no respondió", typeof(ApiResponse<object>))]
    public async Task<IActionResult> Geocodificar(
        [FromQuery] string? tipo,
        [FromQuery] string? texto,
        [FromQuery] string? estado,
        [FromQuery] string? municipio,
        CancellationToken ct)
    {
        try
        {
            var client = _http.CreateClient("nominatim");
            var resultados = await GeocodificarService.GeocodificarAsync(client, _cache, tipo, texto, estado, municipio, ct);
            if (resultados is null)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new ApiResponse<object>
                {
                    Success = false,
                    Message = "No se pudo contactar al servicio de direcciones (Nominatim)."
                });
            }

            return Ok(new ApiResponse<List<GeocodificarResultado>>
            {
                Success = true,
                Message = "Direcciones geocodificadas exitosamente.",
                Data = resultados
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }
}
