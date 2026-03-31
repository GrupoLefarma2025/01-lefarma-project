using FluentValidation;
using Lefarma.API.Features.Catalogos.Areas;
using Lefarma.API.Features.Catalogos.Areas.DTOs;
using Lefarma.API.Shared.Authorization;
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
    [HasPermission(Permissions.Catalogos.View)]
    public class AreasController : ControllerBase
    {
        private readonly IAreaService _areaService;

        public AreasController(IAreaService areaService)
        {
            _areaService = areaService;
        }

        [HttpGet]
        [SwaggerOperation(Summary = "Obtener todas las áreas", Description = "Retorna la lista completa de áreas con filtros opcionales")]
        public async Task<IActionResult> GetAllAreas([FromQuery] AreaRequest query)
        {
            var result = await _areaService.GetAllAsync(query);

            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<AreaResponse>>
            {
                Success = true,
                Message = "Áreas obtenidas exitosamente.",
                Data = data
            }));
        }

        [HttpGet("{id}")]
        [SwaggerOperation(Summary = "Obtener área por ID", Description = "Retorna un área específica por su identificador")]
        public async Task<IActionResult> GetAreaById(
            [FromRoute][SwaggerParameter(Description = "Identificador único del área", Required = true)] int id)
        {
            var result = await _areaService.GetByIdAsync(id);

            return result.ToActionResult(this, data => Ok(new ApiResponse<AreaResponse>
            {
                Success = true,
                Message = "Área obtenida exitosamente.",
                Data = data
            }));
        }

        [HttpPost]
        [HasPermission(Permissions.Catalogos.Manage)]
        [SwaggerOperation(Summary = "Crear nueva área", Description = "Crea un área con los datos proporcionados")]
        public async Task<IActionResult> CreateArea(
            [FromBody][SwaggerRequestBody(Description = "Datos del área a crear", Required = true)] CreateAreaRequest request)
        {
            var result = await _areaService.CreateAsync(request);

            return result.ToActionResult(this, data => CreatedAtAction(
                nameof(GetAreaById),
                new { id = data.IdArea },
                new ApiResponse<AreaResponse>
                {
                    Success = true,
                    Message = "Área creada exitosamente.",
                    Data = data
                }));
        }

        [HttpPut("{id}")]
        [HasPermission(Permissions.Catalogos.Manage)]
        [SwaggerOperation(Summary = "Actualizar área", Description = "Actualiza los datos de un área existente")]
        public async Task<IActionResult> UpdateArea(
            [FromRoute][SwaggerParameter(Description = "Identificador del área a actualizar", Required = true)] int id,
            [FromBody][SwaggerRequestBody(Description = "Datos actualizados del área", Required = true)] UpdateAreaRequest request)
        {
            var result = await _areaService.UpdateAsync(id, request);

            return result.ToActionResult(this, data => Ok(new ApiResponse<AreaResponse>
            {
                Success = true,
                Message = "Área actualizada exitosamente.",
                Data = data
            }));
        }

        [HttpDelete("{id}")]
        [HasPermission(Permissions.Catalogos.Manage)]
        [SwaggerOperation(Summary = "Eliminar área", Description = "Elimina un área por su identificador")]
        public async Task<IActionResult> DeleteArea(
            [FromRoute][SwaggerParameter(Description = "Identificador del área a eliminar", Required = true)] int id)
        {
            var result = await _areaService.DeleteAsync(id);

            return result.ToActionResult(this, success => Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Área eliminada exitosamente.",
                Data = null
            }));
        }
    }
}
