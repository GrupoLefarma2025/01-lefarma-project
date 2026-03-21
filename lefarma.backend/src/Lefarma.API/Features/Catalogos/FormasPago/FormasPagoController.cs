using FluentValidation;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.FormasPago;
using Lefarma.API.Features.Catalogos.FormasPago.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Catalogos
{
    [Route("api/catalogos/[controller]")]
    [ApiController]
    [EndpointGroupName("Catalogos")]
    public class FormasPagoController : ControllerBase
    {
        private readonly IFormaPagoService _formaPagoService;

        public FormasPagoController(IFormaPagoService formaPagoService)
        {
            _formaPagoService = formaPagoService;
        }

        [HttpGet]
        [SwaggerOperation(Summary = "Obtener todas las formas de pago", Description = "Retorna la lista completa de formas de pago")]
        public async Task<IActionResult> GetAll()
        {
            var result = await _formaPagoService.GetAllAsync();

            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<FormaPagoResponse>>
            {
                Success = true,
                Message = "Formas de pago obtenidas exitosamente.",
                Data = data
            }));
        }

        [HttpGet("{id}")]
        [SwaggerOperation(Summary = "Obtener forma de pago por ID", Description = "Retorna una forma de pago específica por su identificador")]
        public async Task<IActionResult> GetById(
            [FromRoute][SwaggerParameter(Description = "Identificador único de la forma de pago", Required = true)] int id)
        {
            var result = await _formaPagoService.GetByIdAsync(id);

            return result.ToActionResult(this, data => Ok(new ApiResponse<FormaPagoResponse>
            {
                Success = true,
                Message = "Forma de pago obtenida exitosamente.",
                Data = data
            }));
        }

        [HttpPost]
        [SwaggerOperation(Summary = "Crear nueva forma de pago", Description = "Crea una forma de pago con los datos proporcionados")]
        public async Task<IActionResult> Create(
            [FromBody][SwaggerRequestBody(Description = "Datos de la forma de pago a crear", Required = true)] CreateFormaPagoRequest request)
        {
            var result = await _formaPagoService.CreateAsync(request);

            return result.ToActionResult(this, data => CreatedAtAction(
                nameof(GetById),
                new { id = data.IdFormaPago },
                new ApiResponse<FormaPagoResponse>
                {
                    Success = true,
                    Message = "Forma de pago creada exitosamente.",
                    Data = data
                }));
        }

        [HttpPut("{id}")]
        [SwaggerOperation(Summary = "Actualizar forma de pago", Description = "Actualiza los datos de una forma de pago existente")]
        public async Task<IActionResult> Update(
            [FromRoute][SwaggerParameter(Description = "Identificador de la forma de pago a actualizar", Required = true)] int id,
            [FromBody][SwaggerRequestBody(Description = "Datos actualizados de la forma de pago", Required = true)] UpdateFormaPagoRequest request)
        {
            var result = await _formaPagoService.UpdateAsync(id, request);

            return result.ToActionResult(this, data => Ok(new ApiResponse<FormaPagoResponse>
            {
                Success = true,
                Message = "Forma de pago actualizada exitosamente.",
                Data = data
            }));
        }

        [HttpDelete("{id}")]
        [SwaggerOperation(Summary = "Eliminar forma de pago", Description = "Elimina una forma de pago por su identificador")]
        public async Task<IActionResult> Delete(
            [FromRoute][SwaggerParameter(Description = "Identificador de la forma de pago a eliminar", Required = true)] int id)
        {
            var result = await _formaPagoService.DeleteAsync(id);

            return result.ToActionResult(this, success => Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Forma de pago eliminada exitosamente.",
                Data = null
            }));
        }
    }
}
