using System.Security.Claims;
using Lefarma.API.Features.Configuracion.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Configuracion;

[ApiController]
[Route("api/configuracion/modulos")]
[EndpointGroupName("Configuracion")]
[Authorize]
public class ConfiguracionModulosController : ControllerBase
{
    private readonly IConfiguracionModulosService _service;

    public ConfiguracionModulosController(IConfiguracionModulosService service)
    {
        _service = service;
    }

    [HttpGet]
    [HasPermission(Permissions.Configuracion.View)]
    [SwaggerOperation(
        Summary = "Listar módulos de configuración",
        Description = "Devuelve los módulos ordenados por orden y nombre. Filtro opcional: activo.")]
    [SwaggerResponse(200, "Módulos obtenidos", typeof(ApiResponse<List<ConfigModuloResponse>>))]
    [SwaggerResponse(403, "Sin permiso configuracion.view")]
    public async Task<IActionResult> Listar([FromQuery] bool? activo, CancellationToken ct)
    {
        var result = await _service.ListarAsync(activo, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<List<ConfigModuloResponse>>
        {
            Success = true,
            Message = "Módulos de configuración obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
    [HasPermission(Permissions.Configuracion.Create)]
    [SwaggerOperation(
        Summary = "Crear módulo de configuración",
        Description = "Crea un módulo. La clave es un slug inmutable que sirve de prefijo a las claves de sus variables.")]
    [SwaggerResponse(200, "Módulo creado", typeof(ApiResponse<ConfigModuloResponse>))]
    [SwaggerResponse(400, "Datos inválidos")]
    [SwaggerResponse(409, "La clave ya existe")]
    public async Task<IActionResult> Crear(
        [FromBody] CreateConfigModuloRequest request,
        CancellationToken ct)
    {
        var result = await _service.CrearAsync(request, ObtenerIdUsuario(), ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ConfigModuloResponse>
        {
            Success = true,
            Message = "Módulo de configuración creado exitosamente.",
            Data = data
        }));
    }

    [HttpPut("{id:long}")]
    [HasPermission(Permissions.Configuracion.Update)]
    [SwaggerOperation(
        Summary = "Actualizar módulo de configuración",
        Description = "Actualiza nombre, descripción y orden. La clave y el estado no se cambian aquí.")]
    [SwaggerResponse(200, "Módulo actualizado", typeof(ApiResponse<ConfigModuloResponse>))]
    [SwaggerResponse(404, "Módulo no encontrado")]
    public async Task<IActionResult> Actualizar(
        long id,
        [FromBody] UpdateConfigModuloRequest request,
        CancellationToken ct)
    {
        var result = await _service.ActualizarAsync(id, request, ObtenerIdUsuario(), ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ConfigModuloResponse>
        {
            Success = true,
            Message = "Módulo de configuración actualizado exitosamente.",
            Data = data
        }));
    }

    [HttpPost("{id:long}/desactivar")]
    [HasPermission(Permissions.Configuracion.Update)]
    [SwaggerOperation(
        Summary = "Desactivar módulo de configuración",
        Description = "Marca el módulo como inactivo: deja de ofrecerse al crear variables, pero las existentes conservan su vínculo. El módulo global no puede desactivarse.")]
    [SwaggerResponse(200, "Módulo desactivado", typeof(ApiResponse<ConfigModuloResponse>))]
    [SwaggerResponse(400, "El módulo global no puede desactivarse")]
    [SwaggerResponse(404, "Módulo no encontrado")]
    public async Task<IActionResult> Desactivar(long id, CancellationToken ct)
    {
        var result = await _service.DesactivarAsync(id, ObtenerIdUsuario(), ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ConfigModuloResponse>
        {
            Success = true,
            Message = "Módulo de configuración desactivado exitosamente.",
            Data = data
        }));
    }

    [HttpPost("{id:long}/reactivar")]
    [HasPermission(Permissions.Configuracion.Update)]
    [SwaggerOperation(
        Summary = "Reactivar módulo de configuración",
        Description = "Marca el módulo como activo para volver a ofrecerlo al crear variables.")]
    [SwaggerResponse(200, "Módulo reactivado", typeof(ApiResponse<ConfigModuloResponse>))]
    [SwaggerResponse(404, "Módulo no encontrado")]
    public async Task<IActionResult> Reactivar(long id, CancellationToken ct)
    {
        var result = await _service.ReactivarAsync(id, ObtenerIdUsuario(), ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ConfigModuloResponse>
        {
            Success = true,
            Message = "Módulo de configuración reactivado exitosamente.",
            Data = data
        }));
    }

    private int? ObtenerIdUsuario()
        => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) && id > 0
            ? id
            : null;
}
