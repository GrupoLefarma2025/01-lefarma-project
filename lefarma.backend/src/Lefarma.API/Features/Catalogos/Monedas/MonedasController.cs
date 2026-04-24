using Lefarma.API.Features.Catalogos.Monedas.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Catalogos.Monedas;

[Route("api/catalogos/[controller]")]
[ApiController]
[EndpointGroupName("Catalogos")]
[Authorize]
public class MonedasController : ControllerBase
{
    private readonly IMonedaService _monedaService;

    public MonedasController(IMonedaService monedaService)
    {
        _monedaService = monedaService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener monedas activas", Description = "Retorna la lista de monedas activas del catálogo")]
    public async Task<IActionResult> GetAll()
    {
        var result = await _monedaService.GetAllActivasAsync();

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<MonedaResponse>>
        {
            Success = true,
            Message = "Monedas obtenidas exitosamente.",
            Data = data
        }));
    }
}
