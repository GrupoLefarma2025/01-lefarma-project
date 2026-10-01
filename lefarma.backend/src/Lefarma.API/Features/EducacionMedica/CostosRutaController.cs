using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class CostosRutaController : ControllerBase
{
    private readonly ICostosRutaService _service;

    public CostosRutaController(ICostosRutaService service)
    {
        _service = service;
    }

    [HttpPost("costos-ruta/calcular")]
    [SwaggerOperation(
        Summary = "Calcular itinerario y costos (demo aislada, fase 1)",
        Description = "Stateless, sin BD. Estima tramos por modo (auto/renta/bus/avión/taxi/transporte), arma 6 propuestas, ruta armada magna vs premium, hoteles y compartidos. Todo estimado lleva estimado:true + fuente.")]
    [SwaggerResponse(200, "Cálculo exitoso", typeof(ApiResponse<CostosRutaResponse>))]
    [SwaggerResponse(400, "Entrada inválida")]
    public async Task<IActionResult> Calcular([FromBody] CostosRutaRequest request, CancellationToken ct = default)
    {
        try
        {
            var resultado = await _service.CalcularAsync(request, ct);
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
