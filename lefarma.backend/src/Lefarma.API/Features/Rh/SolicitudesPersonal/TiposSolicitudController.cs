using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal
{
    [Route("api/rh/[controller]")]
    [ApiController]
    [EndpointGroupName("Rh")]
    public class TiposSolicitudController : ControllerBase
    {
        private readonly ITipoSolicitudService _service;

        public TiposSolicitudController(ITipoSolicitudService service)
        {
            _service = service;
        }

        [HttpGet]
        [SwaggerOperation(Summary = "Obtener tipos de solicitud con filtros")]
        public async Task<IActionResult> GetAll([FromQuery] TipoSolicitudRequest? query)
        {
            if (query == null)
                query = new TipoSolicitudRequest();

            var result = await _service.GetAllAsync(query);
            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<TipoSolicitudResponse>>
            {
                Success = true,
                Message = "Tipos de solicitud obtenidos exitosamente.",
                Data = data
            }));
        }

        [HttpGet("activos")]
        [SwaggerOperation(Summary = "Obtener tipos de solicitud activos")]
        public async Task<IActionResult> GetActivos()
        {
            var result = await _service.GetActivosAsync();
            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<TipoSolicitudResponse>>
            {
                Success = true,
                Message = "Tipos de solicitud activos obtenidos exitosamente.",
                Data = data
            }));
        }

        [HttpGet("{id}")]
        [SwaggerOperation(Summary = "Obtener tipo de solicitud por ID")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _service.GetByIdAsync(id);
            return result.ToActionResult(this, data => Ok(new ApiResponse<TipoSolicitudResponse>
            {
                Success = true,
                Message = "Tipo de solicitud obtenido exitosamente.",
                Data = data
            }));
        }

        [HttpPost]
        [SwaggerOperation(Summary = "Crear tipo de solicitud")]
        public async Task<IActionResult> Create([FromBody] CreateTipoSolicitudRequest request)
        {
            var result = await _service.CreateAsync(request);
            return result.ToActionResult(this, data => CreatedAtAction(
                nameof(GetById),
                new { id = data.IdTipoSolicitud },
                new ApiResponse<TipoSolicitudResponse>
                {
                    Success = true,
                    Message = "Tipo de solicitud creado exitosamente.",
                    Data = data
                }));
        }

        [HttpPut("{id}")]
        [SwaggerOperation(Summary = "Actualizar tipo de solicitud")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateTipoSolicitudRequest request)
        {
            var result = await _service.UpdateAsync(id, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<TipoSolicitudResponse>
            {
                Success = true,
                Message = "Tipo de solicitud actualizado exitosamente.",
                Data = data
            }));
        }

        [HttpDelete("{id}")]
        [SwaggerOperation(Summary = "Eliminar tipo de solicitud")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _service.DeleteAsync(id);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Tipo de solicitud eliminado exitosamente.",
                Data = null
            }));
        }
    }
}
