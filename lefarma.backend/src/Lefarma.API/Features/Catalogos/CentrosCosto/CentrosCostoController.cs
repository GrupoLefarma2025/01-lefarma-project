using FluentValidation;
using Lefarma.API.Features.Catalogos.CentrosCosto;
using Lefarma.API.Features.Catalogos.CentrosCosto.DTOs;
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
public class CentrosCostoController : ControllerBase
{
    private readonly ICentroCostoService _centroCostoService;

    public CentrosCostoController(ICentroCostoService centroCostoService)
    {
        _centroCostoService = centroCostoService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los centros de costo", Description = "Retorna la lista completa de centros de costo con filtros opcionales")]
    public async Task<IActionResult> GetAll([FromQuery] CentroCostoRequest query)
    {
        var result = await _centroCostoService.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<CentroCostoResponse>>
        {
            Success = true,
            Message = "Centros de costo obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener centro de costo por ID", Description = "Retorna un centro de costo específico por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único del centro de costo", Required = true)] int id)
    {
        var result = await _centroCostoService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<CentroCostoResponse>
        {
            Success = true,
            Message = "Centro de costo obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nuevo centro de costo", Description = "Crea un centro de costo con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos del centro de costo a crear", Required = true)] CreateCentroCostoRequest request)
    {
        var result = await _centroCostoService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdCentroCosto },
            new ApiResponse<CentroCostoResponse>
            {
                Success = true,
                Message = "Centro de costo creado exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar centro de costo", Description = "Actualiza los datos de un centro de costo existente")]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador del centro de costo a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados del centro de costo", Required = true)] UpdateCentroCostoRequest request)
    {
        var result = await _centroCostoService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<CentroCostoResponse>
        {
            Success = true,
            Message = "Centro de costo actualizado exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar centro de costo", Description = "Elimina un centro de costo por su identificador")]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador del centro de costo a eliminar", Required = true)] int id)
    {
        var result = await _centroCostoService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Centro de costo eliminado exitosamente.",
            Data = null
        }));
    }
}
