using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/productos")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
[HasPermission(Permissions.EducacionMedica.ProductosVer)]
public class ProductosController : ControllerBase
{
    private readonly IProductoService _service;

    public ProductosController(IProductoService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Obtener catálogo de productos",
        Description = "Retorna productos desde Asokam.genProductosCat. Permite búsqueda por nombre o código.")]
    [SwaggerResponse(200, "Productos obtenidos", typeof(ApiResponse<List<ProductoDto>>))]
    public async Task<IActionResult> GetAll([FromQuery] string? search, CancellationToken ct)
    {
        var productos = await _service.GetProductosAsync(search, ct);
        return Ok(new ApiResponse<List<ProductoDto>>
        {
            Success = true,
            Message = "Productos obtenidos exitosamente.",
            Data = productos
        });
    }
}
