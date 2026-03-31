using Lefarma.API.Features.Auth.Usuarios.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Auth.Usuarios;

/// <summary>
/// Controller for Usuario catalog operations
/// </summary>
[Route("api/auth/usuarios")]
[ApiController]
[EndpointGroupName("Auth")]
//[HasPermission(Permissions.Usuarios.View)]
public class UsuariosController : ControllerBase
{
    private readonly IUsuarioCatalogService _usuarioCatalogService;

    public UsuariosController(IUsuarioCatalogService usuarioCatalogService)
    {
        _usuarioCatalogService = usuarioCatalogService;
    }

    /// <summary>
    /// Gets all active usuarios for catalog selection
    /// </summary>
    [HttpGet]
    [SwaggerOperation(
        Summary = "Obtener todos los usuarios activos",
        Description = "Retorna la lista de usuarios activos para seleccion en notificaciones")]
    [SwaggerResponse(200, "Usuarios obtenidos exitosamente", typeof(ApiResponse<List<UsuarioCatalogDto>>))]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var usuarios = await _usuarioCatalogService.GetAllAsync(ct);

        return Ok(new ApiResponse<List<UsuarioCatalogDto>>
        {
            Success = true,
            Message = "Usuarios obtenidos exitosamente.",
            Data = usuarios
        });
    }
}
