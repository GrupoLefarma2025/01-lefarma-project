using System.Security.Claims;
using Lefarma.API.Domain.Interfaces.Catalogos;
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
    private readonly IUsuarioConfiguracionRepository _usuarioConfiguracionRepository;

    public UsuariosController(
        IUsuarioCatalogService usuarioCatalogService,
        IUsuarioConfiguracionRepository usuarioConfiguracionRepository)
    {
        _usuarioCatalogService = usuarioCatalogService;
        _usuarioConfiguracionRepository = usuarioConfiguracionRepository;
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

    /// <summary>
    /// Gets the default notification recipients for the authenticated user
    /// </summary>
    [HttpGet("destinatarios-default")]
    [SwaggerOperation(
        Summary = "Obtener destinatarios predeterminados",
        Description = "Retorna los IDs de usuarios destinatarios predeterminados del usuario autenticado")]
    [SwaggerResponse(200, "Destinatarios predeterminados obtenidos", typeof(ApiResponse<List<int>>))]
    public async Task<IActionResult> GetDestinatariosDefault(CancellationToken ct)
    {
        var idUsuarioClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(idUsuarioClaim, out var idUsuario) || idUsuario <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "No se pudo identificar al usuario autenticado."
            });
        }

        var destinatarios = await _usuarioConfiguracionRepository.GetDestinatariosDefaultAsync(idUsuario, ct);

        return Ok(new ApiResponse<List<int>>
        {
            Success = true,
            Message = "Destinatarios predeterminados obtenidos exitosamente.",
            Data = destinatarios
        });
    }
}
