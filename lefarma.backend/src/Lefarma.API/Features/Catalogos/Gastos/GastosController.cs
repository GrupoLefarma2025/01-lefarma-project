using FluentValidation;
using Lefarma.API.Features.Catalogos.Gastos;
using Lefarma.API.Features.Catalogos.Gastos.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Catalogos;

// @lat: [[backend#Features]]

[Route("api/catalogos/[controller]")]
[ApiController]
[EndpointGroupName("Catalogos")]
public class GastosController : ControllerBase
{
    private readonly IGastoService _gastoService;

    public GastosController(IGastoService gastoService)
    {
        _gastoService = gastoService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los gastos", Description = "Retorna la lista completa de gastos con filtros opcionales")]
    public async Task<IActionResult> GetAll([FromQuery] GastoRequest query)
    {
        var result = await _gastoService.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<GastoResponse>>
        {
            Success = true,
            Message = "Gastos obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener gasto por ID", Description = "Retorna un gasto específico por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único del gasto", Required = true)] int id)
    {
        var result = await _gastoService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<GastoResponse>
        {
            Success = true,
            Message = "Gasto obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nuevo gasto", Description = "Crea un gasto con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos del gasto a crear", Required = true)] CreateGastoRequest request)
    {
        var result = await _gastoService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdGasto },
            new ApiResponse<GastoResponse>
            {
                Success = true,
                Message = "Gasto creado exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar gasto", Description = "Actualiza los datos de un gasto existente")]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador del gasto a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados del gasto", Required = true)] UpdateGastoRequest request)
    {
        var result = await _gastoService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<GastoResponse>
        {
            Success = true,
            Message = "Gasto actualizado exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar gasto", Description = "Elimina un gasto por su identificador")]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador del gasto a eliminar", Required = true)] int id)
    {
        var result = await _gastoService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Gasto eliminado exitosamente.",
            Data = null
        }));
    }
}
