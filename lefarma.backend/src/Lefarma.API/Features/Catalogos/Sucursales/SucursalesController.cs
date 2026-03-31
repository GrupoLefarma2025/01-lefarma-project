using FluentValidation;
using Lefarma.API.Features.Catalogos.Sucursales;
using Lefarma.API.Features.Catalogos.Sucursales.DTOs;
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
public class SucursalesController : ControllerBase
{
    private readonly ISucursalService _sucursalService;

    public SucursalesController(ISucursalService sucursalService)
    {
        _sucursalService = sucursalService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todas las sucursales", Description = "Retorna la lista completa de sucursales con filtros opcionales")]
    public async Task<IActionResult> GetAll([FromQuery] SucursalRequest query)
    {
        var result = await _sucursalService.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<SucursalResponse>>
        {
            Success = true,
            Message = "Sucursales obtenidas exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener sucursal por ID", Description = "Retorna una sucursal específica por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único de la sucursal", Required = true)] int id)
    {
        var result = await _sucursalService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<SucursalResponse>
        {
            Success = true,
            Message = "Sucursal obtenida exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nueva sucursal", Description = "Crea una sucursal con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos de la sucursal a crear", Required = true)] CreateSucursalRequest request)
    {
        var result = await _sucursalService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdSucursal },
            new ApiResponse<SucursalResponse>
            {
                Success = true,
                Message = "Sucursal creada exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar sucursal", Description = "Actualiza los datos de una sucursal existente")]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador de la sucursal a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados de la sucursal", Required = true)] UpdateSucursalRequest request)
    {
        var result = await _sucursalService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<SucursalResponse>
        {
            Success = true,
            Message = "Sucursal actualizada exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
    [SwaggerOperation(Summary = "Eliminar sucursal", Description = "Elimina una sucursal por su identificador")]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador de la sucursal a eliminar", Required = true)] int id)
    {
        var result = await _sucursalService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Sucursal eliminada exitosamente.",
            Data = null
        }));
    }
}
