using FluentValidation;
using Lefarma.API.Features.Catalogos.TiposGasto;
using Lefarma.API.Features.Catalogos.TiposGasto.DTOs;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Catalogos
{
    [Route("api/catalogos/[controller]")]
    [ApiController]
    [EndpointGroupName("Catalogos")]
    public class TiposGastoController : ControllerBase
    {
        private readonly ITipoGastoService _tipoGastoService;

        public TiposGastoController(ITipoGastoService tipoGastoService)
        {
            _tipoGastoService = tipoGastoService;
        }

        [HttpGet]
        [SwaggerOperation(Summary = "Obtener todos los tipos de gasto", Description = "Retorna la lista completa de tipos de gasto con filtros opcionales")]
        public async Task<IActionResult> GetAll(TipoGastoRequest? query)
        {
            if(query == null)
            {
                query = new TipoGastoRequest();
            }
            var result = await _tipoGastoService.GetAllAsync(query);

            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<TipoGastoResponse>>
            {
                Success = true,
                Message = "Tipos de gasto obtenidos exitosamente.",
                Data = data
            }));
        }

        [HttpGet("{id}")]
        [SwaggerOperation(Summary = "Obtener tipo de gasto por ID", Description = "Retorna un tipo de gasto específico por su identificador")]
        public async Task<IActionResult> GetById(
            [SwaggerParameter(Description = "Identificador único del tipo de gasto", Required = true)] int id)
        {
            var result = await _tipoGastoService.GetByIdAsync(id);

            return result.ToActionResult(this, data => Ok(new ApiResponse<TipoGastoResponse>
            {
                Success = true,
                Message = "Tipo de gasto obtenido exitosamente.",
                Data = data
            }));
        }

        [HttpPost]
        [SwaggerOperation(Summary = "Crear nuevo tipo de gasto", Description = "Crea un tipo de gasto con los datos proporcionados")]
        public async Task<IActionResult> Create(
            [SwaggerRequestBody(Description = "Datos del tipo de gasto a crear", Required = true)] CreateTipoGastoRequest request)
        {
            var result = await _tipoGastoService.CreateAsync(request);

            return result.ToActionResult(this, data => CreatedAtAction(
                nameof(GetById),
                new { id = data.IdTipoGasto },
                new ApiResponse<TipoGastoResponse>
                {
                    Success = true,
                    Message = "Tipo de gasto creado exitosamente.",
                    Data = data
                }));
        }

        [HttpPut("{id}")]
        [SwaggerOperation(Summary = "Actualizar tipo de gasto", Description = "Actualiza los datos de un tipo de gasto existente")]
        public async Task<IActionResult> Update(
            [SwaggerParameter(Description = "Identificador del tipo de gasto a actualizar", Required = true)] int id,
            [SwaggerRequestBody(Description = "Datos actualizados del tipo de gasto", Required = true)] UpdateTipoGastoRequest request)
        {
            var result = await _tipoGastoService.UpdateAsync(id, request);

            return result.ToActionResult(this, data => Ok(new ApiResponse<TipoGastoResponse>
            {
                Success = true,
                Message = "Tipo de gasto actualizado exitosamente.",
                Data = data
            }));
        }

        [HttpDelete("{id}")]
        [SwaggerOperation(Summary = "Eliminar tipo de gasto", Description = "Elimina un tipo de gasto por su identificador")]
        public async Task<IActionResult> Delete(
            [SwaggerParameter(Description = "Identificador del tipo de gasto a eliminar", Required = true)] int id)
        {
            var result = await _tipoGastoService.DeleteAsync(id);

            return result.ToActionResult(this, success => Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Tipo de gasto eliminado exitosamente.",
                Data = null
            }));
        }
    }
}
