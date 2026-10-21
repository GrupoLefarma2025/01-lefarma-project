using Lefarma.API.Features.Viaticos.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Viaticos;

[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class CostosRutaController : ControllerBase
{
    private readonly IHttpClientFactory _http;
    private readonly IMemoryCache _cache;
    private readonly ApplicationDbContext _context;

    public CostosRutaController(IHttpClientFactory http, IMemoryCache cache, ApplicationDbContext context)
    {
        _http = http;
        _cache = cache;
        _context = context;
    }

    [HttpPost("costos-ruta/calcular")]
    [SwaggerOperation(
        Summary = "Calcular itinerario y costos de viáticos",
        Description = "Stateless (la configuración de viáticos se lee de viaticos.config_parametros). Estima tramos por modo (auto/renta/bus/avión/taxi/transporte), arma 6 propuestas, ruta armada magna vs premium, hoteles y compartidos. Todo estimado lleva estimado:true + fuente.")]
    [SwaggerResponse(200, "Cálculo exitoso", typeof(ApiResponse<CostosRutaResponse>))]
    [SwaggerResponse(400, "Entrada inválida")]
    public async Task<IActionResult> Calcular([FromBody] CostosRutaRequest request, CancellationToken ct = default)
    {
        try
        {
            var client = _http.CreateClient();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("GrupoLefarmaViaticos/1.0 (soporte@lefarma.com)");
            // Costos y llaves de proveedores: tabla viaticos.config_parametros.
            await ConfiguracionViaticosService.ActualizarAsync(_context, _cache, ct);
            var resultado = await CalculoCostosRuta.CalcularAsync(request, client, _cache, ct);
            return Ok(new ApiResponse<CostosRutaResponse>
            {
                Success = true,
                Message = "Itinerario calculado exitosamente.",
                Data = resultado
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }
}
