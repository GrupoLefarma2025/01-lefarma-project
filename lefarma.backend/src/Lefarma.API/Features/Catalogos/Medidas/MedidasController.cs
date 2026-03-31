using FluentValidation;
using Lefarma.API.Features.Catalogos.Medidas;
using Lefarma.API.Features.Catalogos.Medidas.DTOs;
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
public class MedidasController : ControllerBase
{
    private readonly IMedidaService _service;

    public MedidasController(IMedidaService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos las medidas", Description = "Retorna la lista completa de medidas con filtros opcionales")]
    public async Task<IActionResult> GetAll([FromQuery] MedidaRequest query)
    {
        var result = await _service.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<MedidaResponse>>
        {
            Success = true,
            Message = "Medidas obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener medida por ID", Description = "Retorna una medida específico por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único de la medida", Required = true)] int id)
    {
        var result = await _service.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<MedidaResponse>
        {
            Success = true,
            Message = "Medida obtenida exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nueva medida", Description = "Crea una medida con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos de la medida a crear", Required = true)] CreateMedidaRequest request)
    {
        var result = await _service.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdMedida },
            new ApiResponse<MedidaResponse>
            {
                Success = true,
                Message = "Medida creado exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar medida", Description = "Actualiza los datos de una medida existente")]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador de la medida a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados de la medida", Required = true)] UpdateMedidaRequest request)
    {
        var result = await _service.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<MedidaResponse>
        {
            Success = true,
            Message = "Medida actualizada exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar medida", Description = "Elimina una medida por su identificador")]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador de la medida a eliminar", Required = true)] int id)
    {
        var result = await _service.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Medida eliminada exitosamente.",
            Data = null
        }));
    }
}
