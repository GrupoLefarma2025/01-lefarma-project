using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/tipo-gerencia")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class TipoGerenciaController : ControllerBase
{
    private readonly ITipoGerenciaService _service;

    public TipoGerenciaController(ITipoGerenciaService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Obtener tipos de gerencia",
        Description = "Retorna el catálogo de tipos de gerencia (IMSS / Descentralizado / Privado).")]
    [SwaggerResponse(200, "Tipos de gerencia obtenidos", typeof(ApiResponse<List<TipoGerenciaDto>>))]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var tipos = await _service.GetAllAsync(ct);
        return Ok(new ApiResponse<List<TipoGerenciaDto>>
        {
            Success = true,
            Message = "Tipos de gerencia obtenidos exitosamente.",
            Data = tipos
        });
    }
}
