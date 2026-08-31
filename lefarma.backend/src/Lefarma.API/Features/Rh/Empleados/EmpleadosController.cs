using System.Security.Claims;
using Lefarma.API.Features.Rh.Empleados.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Rh.Empleados;

[ApiController]
[Route("api/rh/empleados")]
[EndpointGroupName("Rh")]
[Authorize]
public class EmpleadosController : ControllerBase
{
    private readonly IEmpleadoService _service;

    public EmpleadosController(IEmpleadoService service)
    {
        _service = service;
    }

    [HttpGet("mi-chequeo")]
    [SwaggerOperation(
        Summary = "Obtener estado de checado del empleado autenticado",
        Description = "Retorna si el empleado asociado al usuario autenticado checa basado en VwEmpleados.Checa")]
    [SwaggerResponse(200, "Estado de checado obtenido", typeof(ApiResponse<EmpleadoChecadoResponse>))]
    public async Task<IActionResult> ObtenerMiChequeo(CancellationToken cancellationToken)
    {
        var idUsuario = GetUserId();
        var result = await _service.ObtenerEstadoChecadoAsync(idUsuario, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<EmpleadoChecadoResponse>
        {
            Success = true,
            Message = "Estado de checado obtenido exitosamente.",
            Data = data
        }));
    }

    private int GetUserId() =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    [HttpGet("usuario-por-nomina")]
    [SwaggerOperation(
        Summary = "Resolver IdUsuario por nómina",
        Description = "Retorna el IdUsuario asociado a una nómina usando VwEmpleados y Asokam.Usuarios")]
    [SwaggerResponse(200, "IdUsuario resuelto", typeof(ApiResponse<int?>))]
    public async Task<IActionResult> ResolverIdUsuarioPorNomina(
        [FromQuery] ResolverIdUsuarioPorNominaRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.ResolverIdUsuarioPorNominaAsync(request.Nomina, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<int?>
        {
            Success = true,
            Message = "IdUsuario resuelto exitosamente.",
            Data = data
        }));
    }

    [HttpGet("nomina-por-usuario")]
    [SwaggerOperation(
        Summary = "Resolver nómina por usuario autenticado",
        Description = "Retorna la nómina y IdUsuario asociado al usuario autenticado usando VwEmpleados")]
    [SwaggerResponse(200, "Nómina resuelta", typeof(ApiResponse<EmpleadoUsuarioResponse>))]
    public async Task<IActionResult> ObtenerNominaPorUsuario(CancellationToken cancellationToken)
    {
        var idUsuario = GetUserId();
        var result = await _service.ObtenerNominaPorUsuarioAsync(idUsuario, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<EmpleadoUsuarioResponse>
        {
            Success = true,
            Message = "Nómina obtenida exitosamente.",
            Data = data
        }));
    }

    [HttpPost("usuarios-por-nominas")]
    [SwaggerOperation(
        Summary = "Resolver IdUsuarios por múltiples nóminas",
        Description = "Retorna un diccionario de nómina → IdUsuario para la lista de nóminas proporcionada")]
    [SwaggerResponse(200, "IdUsuarios resueltos", typeof(ApiResponse<Dictionary<long, int>>))]
    public async Task<IActionResult> ResolverIdsUsuarioPorNominas(
        [FromBody] ResolverIdsUsuarioPorNominasRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.ResolverIdsUsuarioPorNominasAsync(request.Nominas, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<Dictionary<long, int>>
        {
            Success = true,
            Message = "IdUsuarios resueltos exitosamente.",
            Data = data
        }));
    }
}
