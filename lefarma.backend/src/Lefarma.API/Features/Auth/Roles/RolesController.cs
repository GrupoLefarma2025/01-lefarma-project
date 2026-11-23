using Lefarma.API.Features.Auth.Roles.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Auth.Roles;
[Route("api/auth/roles")]
[ApiController]
[EndpointGroupName("Auth")]
public class RolesController : ControllerBase
{
    private readonly IRolCatalogService _rolCatalogService;

    public RolesController(IRolCatalogService rolCatalogService)
    {
        _rolCatalogService = rolCatalogService;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Obtener todos los roles",
        Description = "Retorna la lista de roles para seleccion en notificaciones")]
    [SwaggerResponse(200, "Roles obtenidos exitosamente", typeof(ApiResponse<List<RolCatalogDto>>))]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var roles = await _rolCatalogService.GetAllAsync(ct);

        return Ok(new ApiResponse<List<RolCatalogDto>>
        {
            Success = true,
            Message = "Roles obtenidos exitosamente.",
            Data = roles
        });
    }
}
