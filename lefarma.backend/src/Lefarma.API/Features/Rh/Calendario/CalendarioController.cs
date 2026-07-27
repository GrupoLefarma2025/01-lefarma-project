using Lefarma.API.Features.Rh.Calendario.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using System.Security.Claims;

namespace Lefarma.API.Features.Rh.Calendario;

[Route("api/calendario")]
[ApiController]
[EndpointGroupName("Calendario")]
public class CalendarioController : ControllerBase
{
    private readonly ICalendarioService _service;

    public CalendarioController(ICalendarioService service)
    {
        _service = service;
    }

    [HttpGet("laboral")]
    [SwaggerOperation(Summary = "Obtener días del calendario laboral del usuario autenticado")]
    public async Task<IActionResult> ObtenerCalendarioLaboral([FromQuery] CalendarioLaboralRequest request)
    {
        var idUsuario = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
        var result = await _service.ObtenerCalendarioLaboralAsync(request, idUsuario);
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<CalendarioLaboralResponse>>
        { Success = true, Message = "Calendario laboral obtenido exitosamente.", Data = data }));
    }
}
