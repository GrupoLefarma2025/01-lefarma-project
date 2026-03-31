using FluentValidation;
using Lefarma.API.Features.Catalogos.CuentasContables;
using Lefarma.API.Features.Catalogos.CuentasContables.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Catalogos;

[Route("api/catalogos/[controller]")]
[ApiController]
[EndpointGroupName("Catalogos")]
//[HasPermission(Permissions.Catalogos.View)]
public class CuentasContablesController : ControllerBase
{
    private readonly ICuentaContableService _cuentaContableService;

    public CuentasContablesController(ICuentaContableService cuentaContableService)
    {
        _cuentaContableService = cuentaContableService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todas las cuentas contables", Description = "Retorna el catálogo contable con filtros opcionales")]
    public async Task<IActionResult> GetAll([FromQuery] CuentaContableRequest query)
    {
        var result = await _cuentaContableService.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<CuentaContableResponse>>
        {
            Success = true,
            Message = "Cuentas contables obtenidas exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener cuenta contable por ID", Description = "Retorna una cuenta contable específica por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único de la cuenta contable", Required = true)] int id)
    {
        var result = await _cuentaContableService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<CuentaContableResponse>
        {
            Success = true,
            Message = "Cuenta contable obtenida exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nueva cuenta contable", Description = "Crea una cuenta contable con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos de la cuenta contable a crear", Required = true)] CreateCuentaContableRequest request)
    {
        var result = await _cuentaContableService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdCuentaContable },
            new ApiResponse<CuentaContableResponse>
            {
                Success = true,
                Message = "Cuenta contable creada exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar cuenta contable", Description = "Actualiza los datos de una cuenta contable existente")]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador de la cuenta contable a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados de la cuenta contable", Required = true)] UpdateCuentaContableRequest request)
    {
        var result = await _cuentaContableService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<CuentaContableResponse>
        {
            Success = true,
            Message = "Cuenta contable actualizada exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar cuenta contable", Description = "Elimina una cuenta contable por su identificador")]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador de la cuenta contable a eliminar", Required = true)] int id)
    {
        var result = await _cuentaContableService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Cuenta contable eliminada exitosamente.",
            Data = null
        }));
    }
}
