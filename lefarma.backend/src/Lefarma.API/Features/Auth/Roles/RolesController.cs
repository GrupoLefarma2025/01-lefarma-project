using Lefarma.API.Features.Auth.Roles.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Auth.Roles;
/// <summary>
/// Controller for Rol catalog operations
/// </summary>
[Route("api/auth/roles")]
[ApiController]
[EndpointGroupName("Auth")]
//[HasPermission(Permissions.Usuarios.View)]
public class RolesController : ControllerBase
{
    private readonly IRolCatalogService _rolCatalogService;

    public RolesController(IRolCatalogService rolCatalogService)
    {
        _rolCatalogService = rolCatalogService;
    }

    /// <summary>
    /// Gets all roles for catalog selection
    /// </summary>
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
