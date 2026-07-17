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
