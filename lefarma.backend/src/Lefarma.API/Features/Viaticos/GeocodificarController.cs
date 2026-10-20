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
        Summary = "Geocodificar dirección o coordenadas (proxy de Nominatim/Photon)",
        Description = "Proxy cacheado para el selector de puntos en mapa. tipo=global busca direcciones o lugares por texto libre: Nominatim primero (política de OSM: User-Agent identificable, máximo 1 request/s, timeout de 12 s, cache de 6 h) y Photon como refuerzo cuando Nominatim no devuelve nada o falla (tolera palabras incompletas o abreviadas); el viewbox opcional (minLon,minLat,maxLon,maxLat) sesga hacia la ubicación del navegador sin excluir el resto del país. tipo=reversa convierte coordenadas pegadas (lat/lon) en una dirección de referencia. Todo se acota a México (país del resultado), responde en español cuando el motor lo soporta y devuelve hasta 8 resultados con etiqueta estilo Google.")]
    [SwaggerResponse(200, "Direcciones geocodificadas (shape de PuntoSeleccion)", typeof(ApiResponse<List<GeocodificarResultado>>))]
    [SwaggerResponse(400, "Parámetros inválidos", typeof(ApiResponse<object>))]
    [SwaggerResponse(502, "El servicio de direcciones no respondió", typeof(ApiResponse<object>))]
    public async Task<IActionResult> Geocodificar(
        [FromQuery] string? tipo,
        [FromQuery] string? texto,
        [FromQuery] string? viewbox,
        [FromQuery] string? lat,
        [FromQuery] string? lon,
        CancellationToken ct)
    {
        try
        {
            List<GeocodificarResultado>? resultados;
            switch (tipo)
            {
                case "global":
                    resultados = await GeocodificarService.GeocodificarAsync(
                        _http.CreateClient("nominatim"), _http.CreateClient("photon"), _cache, texto, viewbox, ct);
                    break;
                case "reversa":
                    resultados = await GeocodificarService.RevertirAsync(
                        _http.CreateClient("nominatim"), _cache, lat, lon, ct);
                    break;
                default:
                    throw new ArgumentException("tipo debe ser global o reversa.", nameof(tipo));
            }

            if (resultados is null)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new ApiResponse<object>
                {
                    Success = false,
                    Message = "No se pudo contactar al servicio de direcciones."
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

    // Igual que la búsqueda: fetch simple sin Bearer. La lista blanca de hosts,
    // la validación por salto y el tope de redirecciones viven en el servicio.
    [HttpGet("resolver-liga")]
    [AllowAnonymous]
    [SwaggerOperation(
        Summary = "Resolver liga corta de mapas",
        Description = "Sigue las redirecciones de una liga corta (maps.app.goo.gl, goo.gl, g.co, osm.org) y devuelve su URL final, de donde el frontend extrae las coordenadas. El navegador no puede seguir estas redirecciones por CORS. Solo se siguen saltos https hacia hosts de la lista blanca (validada en cada salto, anti-SSRF), con máximo de saltos, timeout de 8 s, sin leer cuerpos y cache de 6 h.")]
    [SwaggerResponse(200, "URL final de la liga", typeof(ApiResponse<string>))]
    [SwaggerResponse(400, "Parámetros inválidos", typeof(ApiResponse<object>))]
    [SwaggerResponse(502, "La liga no se pudo resolver", typeof(ApiResponse<object>))]
    public async Task<IActionResult> ResolverLiga([FromQuery] string? url, CancellationToken ct)
    {
        try
        {
            var final = await ResolverLigaService.ResolverAsync(_http.CreateClient("enlaces"), _cache, url, ct);
            if (final is null)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new ApiResponse<object>
                {
                    Success = false,
                    Message = "No se pudo resolver la liga de mapas."
                });
            }

            return Ok(new ApiResponse<string>
            {
                Success = true,
                Message = "Liga resuelta exitosamente.",
                Data = final
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }
}
