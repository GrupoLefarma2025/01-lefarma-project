using FluentValidation;
using Lefarma.API.Features.Catalogos.TiposImpuesto;
using Lefarma.API.Features.Catalogos.TiposImpuesto.DTOs;
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
public class TiposImpuestoController : ControllerBase
{
    private readonly ITipoImpuestoService _tipoImpuestoService;

    public TiposImpuestoController(ITipoImpuestoService tipoImpuestoService)
    {
        _tipoImpuestoService = tipoImpuestoService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los tipos de impuesto", Description = "Retorna la lista completa de tipos de impuesto")]
    public async Task<IActionResult> GetAll()
    {
        var result = await _tipoImpuestoService.GetAllAsync();

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<TipoImpuestoResponse>>
        {
            Success = true,
            Message = "Tipos de impuesto obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener tipo de impuesto por ID", Description = "Retorna un tipo de impuesto específico por su identificador")]
    public async Task<IActionResult> GetById(
        [SwaggerParameter(Description = "Identificador único del tipo de impuesto", Required = true)] int id)
    {
        var result = await _tipoImpuestoService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<TipoImpuestoResponse>
        {
            Success = true,
            Message = "Tipo de impuesto obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
    [SwaggerOperation(Summary = "Crear nuevo tipo de impuesto", Description = "Crea un tipo de impuesto con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [SwaggerRequestBody(Description = "Datos del tipo de impuesto a crear", Required = true)] CreateTipoImpuestoRequest request)
    {
        var result = await _tipoImpuestoService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdTipoImpuesto },
            new ApiResponse<TipoImpuestoResponse>
            {
                Success = true,
                Message = "Tipo de impuesto creado exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
    [SwaggerOperation(Summary = "Actualizar tipo de impuesto", Description = "Actualiza los datos de un tipo de impuesto existente")]
    public async Task<IActionResult> Update(
        [SwaggerParameter(Description = "Identificador del tipo de impuesto a actualizar", Required = true)] int id,
        [SwaggerRequestBody(Description = "Datos actualizados del tipo de impuesto", Required = true)] UpdateTipoImpuestoRequest request)
    {
        var result = await _tipoImpuestoService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<TipoImpuestoResponse>
        {
            Success = true,
            Message = "Tipo de impuesto actualizado exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
    [SwaggerOperation(Summary = "Eliminar tipo de impuesto", Description = "Elimina un tipo de impuesto por su identificador")]
    public async Task<IActionResult> Delete(
        [SwaggerParameter(Description = "Identificador del tipo de impuesto a eliminar", Required = true)] int id)
    {
        var result = await _tipoImpuestoService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Tipo de impuesto eliminado exitosamente.",
            Data = null
        }));
    }
}
