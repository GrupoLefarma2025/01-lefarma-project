using FluentValidation;
using Lefarma.API.Features.Catalogos.MediosPago;
using Lefarma.API.Features.Catalogos.MediosPago.DTOs;
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
public class MediosPagoController : ControllerBase
{
    private readonly IMedioPagoService _medioPagoService;

    public MediosPagoController(IMedioPagoService medioPagoService)
    {
        _medioPagoService = medioPagoService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los medios de pago", Description = "Retorna la lista completa de medios de pago")]
    public async Task<IActionResult> GetAll()
    {
        var result = await _medioPagoService.GetAllAsync();

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<MedioPagoResponse>>
        {
            Success = true,
            Message = "Medios de pago obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener medio de pago por ID", Description = "Retorna un medio de pago específico por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único del medio de pago", Required = true)] int id)
    {
        var result = await _medioPagoService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<MedioPagoResponse>
        {
            Success = true,
            Message = "Medio de pago obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nuevo medio de pago", Description = "Crea un medio de pago con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos del medio de pago a crear", Required = true)] CreateMedioPagoRequest request)
    {
        var result = await _medioPagoService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdMedioPago },
            new ApiResponse<MedioPagoResponse>
            {
                Success = true,
                Message = "Medio de pago creado exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar medio de pago", Description = "Actualiza los datos de un medio de pago existente")]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador del medio de pago a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados del medio de pago", Required = true)] UpdateMedioPagoRequest request)
    {
        var result = await _medioPagoService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<MedioPagoResponse>
        {
            Success = true,
            Message = "Medio de pago actualizado exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar medio de pago", Description = "Elimina un medio de pago por su identificador")]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador del medio de pago a eliminar", Required = true)] int id)
    {
        var result = await _medioPagoService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Medio de pago eliminado exitosamente.",
            Data = null
        }));
    }
}
