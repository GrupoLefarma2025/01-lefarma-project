    using Lefarma.API.Features.OrdenesCompra.Captura.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using System.Security.Claims;

namespace Lefarma.API.Features.OrdenesCompra.Captura
{
[Route("api/ordenes")]
    [ApiController]
    [EndpointGroupName("OrdenesCompra")]
//    [HasPermission(Permissions.OrdenesCompra.View)]
    public class OrdenCompraController : ControllerBase
    {
        private readonly IOrdenCompraService _service;
        public OrdenCompraController(IOrdenCompraService service) => _service = service;

        private int GetUserId() =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

        private bool TienePermiso(string permiso) =>
            User.Claims.Any(c => c.Type == "permission" && c.Value == permiso);

        [HttpGet]
        [SwaggerOperation(Summary = "Obtener ordenes de compra con filtros")]
        public async Task<IActionResult> GetAll(OrdenCompraRequest? query)
        {
            if(query == null)
            {
                query = new OrdenCompraRequest();
            }
            var puedeVerTodas = TienePermiso("orden_compra.puede_ver_todas_las_ordenes");
            var result = await _service.GetAllAsync(query, GetUserId(), puedeVerTodas);
            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<OrdenCompraResponse>>
            { Success = true, Message = "�rdenes obtenidas exitosamente.", Data = data }));
        }

        [HttpGet("{id}")]
        [SwaggerOperation(Summary = "Obtener orden de compra por ID")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _service.GetByIdAsync(id);
            return result.ToActionResult(this, data => Ok(new ApiResponse<OrdenCompraResponse>
            { Success = true, Message = "Orden obtenida exitosamente.", Data = data }));
        }

        [HttpPost]
    //    [HasPermission(Permissions.OrdenesCompra.Create)]
        [SwaggerOperation(Summary = "Crear nueva orden de compra")]
        public async Task<IActionResult> Create( CreateOrdenCompraRequest? request)
        {
            var result = await _service.CreateAsync(request, GetUserId());
            return result.ToActionResult(this, data => CreatedAtAction(nameof(GetById),
                new { id = data.IdOrden },
                new ApiResponse<OrdenCompraResponse> { Success = true, Message = "Orden creada exitosamente.", Data = data }));
        }

        [HttpDelete("{id}")]
    //    [HasPermission(Permissions.OrdenesCompra.Delete)]
        [SwaggerOperation(Summary = "Eliminar orden de compra (solo estado Creada)")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _service.DeleteAsync(id);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Orden eliminada exitosamente.", Data = null }));
        }

        [HttpPut("{id}")]
        [SwaggerOperation(Summary = "Actualizar orden de compra")]
        public async Task<IActionResult> Update(int id, [FromBody] CreateOrdenCompraRequest? request)
        {
            if (request == null)
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Datos requeridos" });

            var result = await _service.UpdateAsync(id, request, GetUserId());
            return result.ToActionResult(this, data => Ok(new ApiResponse<OrdenCompraResponse>
            { Success = true, Message = "Orden actualizada exitosamente.", Data = data }));
        }
    }
}
