using FluentValidation;
using Lefarma.API.Features.Catalogos.Proveedores;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;
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
[HasPermission(Permissions.Catalogos.View)]
public class ProveedoresController : ControllerBase
{
    private readonly IProveedorService _proveedorService;

    public ProveedoresController(IProveedorService proveedorService)
    {
        _proveedorService = proveedorService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los proveedores", Description = "Retorna la lista completa de proveedores con filtros opcionales")]
    public async Task<IActionResult> GetAll([FromQuery] ProveedorRequest query)
    {
        var result = await _proveedorService.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<ProveedorResponse>>
        {
            Success = true,
            Message = "Proveedores obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener proveedor por ID", Description = "Retorna un proveedor específico por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único del proveedor", Required = true)] int id)
    {
        var result = await _proveedorService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ProveedorResponse>
        {
            Success = true,
            Message = "Proveedor obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nuevo proveedor", Description = "Crea un proveedor con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos del proveedor a crear", Required = true)] CreateProveedorRequest request)
    {
        var result = await _proveedorService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdProveedor },
            new ApiResponse<ProveedorResponse>
            {
                Success = true,
                Message = "Proveedor creado exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar proveedor", Description = "Actualiza los datos de un proveedor existente")]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador del proveedor a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados del proveedor", Required = true)] UpdateProveedorRequest request)
    {
        var result = await _proveedorService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ProveedorResponse>
        {
            Success = true,
            Message = "Proveedor actualizado exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar proveedor", Description = "Elimina un proveedor por su identificador")]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador del proveedor a eliminar", Required = true)] int id)
    {
        var result = await _proveedorService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Proveedor eliminado exitosamente.",
            Data = null
        }));
    }

    [HttpPost("{id}/autorizar")]
//    [HasPermission(Permissions.Proveedores.Autorizar)]
    [SwaggerOperation(Summary = "Autorizar proveedor por CxP", Description = "Marca un proveedor como autorizado por el área de Cuentas por Pagar")]
    public async Task<IActionResult> Autorizar(
        [FromRoute][SwaggerParameter(Description = "Identificador del proveedor a autorizar", Required = true)] int id)
    {
        var result = await _proveedorService.AutorizarAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ProveedorResponse>
        {
            Success = true,
            Message = "Proveedor autorizado exitosamente.",
            Data = data
        }));
    }

    [HttpPost("{id}/rechazar")]
//    [HasPermission(Permissions.Proveedores.Rechazar)]
    [SwaggerOperation(Summary = "Rechazar proveedor por CxP", Description = "Rechaza un proveedor con un motivo")]
    public async Task<IActionResult> Rechazar(
        [FromRoute][SwaggerParameter(Description = "Identificador del proveedor a rechazar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Motivo del rechazo", Required = true)] RechazoProveedorRequest request)
    {
        var result = await _proveedorService.RechazarAsync(id, request.Motivo);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ProveedorResponse>
        {
            Success = true,
            Message = "Proveedor rechazado exitosamente.",
            Data = data
        }));
    }
}
