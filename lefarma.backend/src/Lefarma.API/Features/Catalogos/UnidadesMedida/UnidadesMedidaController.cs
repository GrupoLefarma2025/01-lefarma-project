using FluentValidation;
using Lefarma.API.Features.Catalogos.UnidadesMedida;
using Lefarma.API.Features.Catalogos.UnidadesMedida.DTOs;
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
// [HasPermission(Permissions.Catalogos.View)]
public class UnidadesMedidaController : ControllerBase
{
    private readonly IUnidadMedidaService _service;

    public UnidadesMedidaController(IUnidadMedidaService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todas las unidades de medida", Description = "Retorna la lista completa de unidades de medida con filtros opcionales")]
    public async Task<IActionResult> GetAll([FromQuery] UnidadMedidaRequest query)
    {
        var result = await _service.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<UnidadMedidaResponse>>
        {
            Success = true,
            Message = "Unidades de medida obtenidas exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener unidad de medida por ID", Description = "Retorna una unidad de medida específica por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único de la unidad de medida", Required = true)] int id)
    {
        var result = await _service.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<UnidadMedidaResponse>
        {
            Success = true,
            Message = "Unidad de medida obtenida exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nueva unidad de medida", Description = "Crea una unidad de medida con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos de la unidad de medida a crear", Required = true)] CreateUnidadMedidaRequest request)
    {
        var result = await _service.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdUnidadMedida },
            new ApiResponse<UnidadMedidaResponse>
            {
                Success = true,
                Message = "Unidad de medida creada exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar unidad de medida", Description = "Actualiza los datos de una unidad de medida existente")]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador de la unidad de medida a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados de la unidad de medida", Required = true)] UpdateUnidadMedidaRequest request)
    {
        var result = await _service.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<UnidadMedidaResponse>
        {
            Success = true,
            Message = "Unidad de medida actualizada exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar unidad de medida", Description = "Elimina una unidad de medida por su identificador")]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador de la unidad de medida a eliminar", Required = true)] int id)
    {
        var result = await _service.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Unidad de medida eliminada exitosamente.",
            Data = null
        }));
    }
}
