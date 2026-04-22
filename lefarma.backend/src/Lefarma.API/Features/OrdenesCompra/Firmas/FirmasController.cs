using Lefarma.API.Features.OrdenesCompra.Firmas.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using System.Security.Claims;

namespace Lefarma.API.Features.OrdenesCompra.Firmas
{
[Route("api/ordenes")]
    [ApiController]
    [EndpointGroupName("OrdenesCompra")]
    //[HasPermission(Permissions.OrdenesCompra.Approve)]
    public class FirmasController : ControllerBase
    {
        private readonly IFirmasService _service;
        public FirmasController(IFirmasService service) => _service = service;

        private int GetUserId() =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

        [HttpPost("{id}/firmar")]
        [SwaggerOperation(
            Summary = "Ejecutar acci�n de firma sobre una orden",
            Description = "Endpoint gen�rico. DatosAdicionales var�a por paso: " +
                          "Firma3 requiere CentroCosto y CuentaContable. " +
                          "Firma4 acepta RequiereComprobacionPago y RequiereComprobacionGasto.")]
        public async Task<IActionResult> Firmar(int id,  FirmarRequest request)
        {
            var result = await _service.FirmarAsync(id, request, GetUserId());
            return result.ToActionResult(this, data => Ok(new ApiResponse<FirmarResponse>
            { Success = true, Message = data?.Mensaje ?? string.Empty, Data = data }));
        }

        [HttpGet("{id}/acciones")]
        [SwaggerOperation(Summary = "Obtener acciones disponibles para una orden seg�n su estado actual")]
        public async Task<IActionResult> GetAcciones(int id)
        {
            var result = await _service.GetAccionesAsync(id, GetUserId());
            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<AccionDisponibleResponse>>
            { Success = true, Message = "Acciones obtenidas exitosamente.", Data = data }));
        }

        [HttpGet("{id}/acciones/{idAccion}/metadata")]
        [SwaggerOperation(Summary = "Obtener metadatos de una acción para construir modal dinámico")]
        public async Task<IActionResult> GetAccionMetadata(int id, int idAccion)
        {
            var result = await _service.GetAccionMetadataAsync(id, idAccion, GetUserId());
            return result.ToActionResult(this, data => Ok(new ApiResponse<AccionMetadataResponse>
            { Success = true, Message = "Metadatos de acción obtenidos exitosamente.", Data = data }));
        }

        [HttpGet("{id}/historial-workflow")]
        [SwaggerOperation(Summary = "Obtener historial de transiciones del workflow para una orden")]
        public async Task<IActionResult> GetHistorialWorkflow(int id)
        {
            var result = await _service.GetHistorialWorkflowAsync(id);
            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HistorialWorkflowItemResponse>>
            { Success = true, Message = "Historial de workflow obtenido exitosamente.", Data = data }));
        }
    }
}
