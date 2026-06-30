using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using System.Security.Claims;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal;

[Route("api/solicitudes-personal")]
[ApiController]
[EndpointGroupName("SolicitudesPersonal")]
//[Authorize]
public class SolicitudPersonalController : ControllerBase
{
    private readonly ISolicitudPersonalService _service;
    private readonly ISolicitudPersonalFirmasService _firmasService;

    public SolicitudPersonalController(
        ISolicitudPersonalService service,
        ISolicitudPersonalFirmasService firmasService)
    {
        _service = service;
        _firmasService = firmasService;
    }

    private int GetUserId() =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    private bool TienePermiso(string permiso) =>
        User.Claims.Any(c => c.Type == "permission" && c.Value == permiso);

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener solicitudes de personal con filtros")]
    public async Task<IActionResult> GetAll([FromQuery] SolicitudPersonalRequest? query)
    {
        if (query == null)
            query = new SolicitudPersonalRequest();

        var puedeVerTodas = TienePermiso("solicitud_personal.puede_ver_todas_solcitudes");
        var rolesUsuario = User.Claims
            .Where(c => c.Type == ClaimTypes.Role)
            .Select(c => int.TryParse(c.Value, out var r) ? r : 0)
            .Where(r => r > 0)
            .ToList();

        var result = await _service.GetAllAsync(query, GetUserId(), rolesUsuario, puedeVerTodas);
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<SolicitudPersonalResponse>>
        { Success = true, Message = "Solicitudes obtenidas exitosamente.", Data = data }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener solicitud de personal por ID")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _service.GetByIdAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<SolicitudPersonalResponse>
        { Success = true, Message = "Solicitud obtenida exitosamente.", Data = data }));
    }

    [HttpPost]
    [SwaggerOperation(Summary = "Crear nueva solicitud de personal")]
    public async Task<IActionResult> Create([FromBody] CreateSolicitudPersonalRequest request)
    {
        var result = await _service.CreateAsync(request, GetUserId(), HttpContext.RequestAborted);
        return result.ToActionResult(this, data => CreatedAtAction(nameof(GetById),
            new { id = data.IdSolicitud },
            new ApiResponse<SolicitudPersonalResponse> { Success = true, Message = "Solicitud creada exitosamente.", Data = data }));
    }

    [HttpPut("{id}")]
    [SwaggerOperation(Summary = "Actualizar solicitud de personal")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateSolicitudPersonalRequest? request)
    {
        if (request == null)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Datos requeridos" });

        var result = await _service.UpdateAsync(id, request, GetUserId(), HttpContext.RequestAborted);
        return result.ToActionResult(this, data => Ok(new ApiResponse<SolicitudPersonalResponse>
        { Success = true, Message = "Solicitud actualizada exitosamente.", Data = data }));
    }

    [HttpDelete("{id}")]
    [SwaggerOperation(Summary = "Eliminar solicitud de personal (solo sin enviar)")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _service.DeleteAsync(id);
        return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
        { Success = true, Message = "Solicitud eliminada exitosamente.", Data = null }));
    }

    [HttpPost("{id}/firmar")]
    [SwaggerOperation(Summary = "Ejecutar acción de workflow sobre una solicitud")]
    public async Task<IActionResult> Firmar(int id, [FromBody] FirmarRequest request)
    {
        var result = await _firmasService.FirmarAsync(id, request, GetUserId());
        return result.ToActionResult(this, data => Ok(new ApiResponse<FirmarResponse>
        { Success = true, Message = data?.Mensaje ?? "", Data = data }));
    }

    [HttpGet("{id}/acciones-disponibles")]
    [SwaggerOperation(Summary = "Obtener acciones disponibles para una solicitud según su estado actual")]
    public async Task<IActionResult> GetAccionesDisponibles(int id)
    {
        var result = await _firmasService.GetAccionesDisponiblesAsync(id, GetUserId());
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<AccionDisponibleResponse>>
        { Success = true, Message = "Acciones obtenidas.", Data = data }));
    }

    [HttpGet("{id}/acciones/{idAccion}/metadata")]
    [SwaggerOperation(Summary = "Obtener metadata de una acción para construir modal dinámico")]
    public async Task<IActionResult> GetAccionMetadata(int id, int idAccion)
    {
        var result = await _firmasService.GetAccionMetadataAsync(id, idAccion, GetUserId());
        return result.ToActionResult(this, data => Ok(new ApiResponse<AccionMetadataResponse>
        { Success = true, Message = "Metadata obtenida.", Data = data }));
    }

    [HttpGet("{id}/historial")]
    [SwaggerOperation(Summary = "Obtener historial de transiciones del workflow para una solicitud")]
    public async Task<IActionResult> GetHistorial(int id)
    {
        var result = await _firmasService.GetHistorialAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HistorialWorkflowItemResponse>>
        { Success = true, Message = "Historial obtenido.", Data = data }));
    }

    [HttpGet("tipos-solicitud")]
    [SwaggerOperation(Summary = "Listar tipos de solicitud disponibles")]
    public async Task<IActionResult> ListarTipos()
    {
        var result = await _service.ListarTiposAsync();
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<TipoSolicitudResponse>>
        { Success = true, Message = "Tipos de solicitud obtenidos.", Data = data }));
    }
}
