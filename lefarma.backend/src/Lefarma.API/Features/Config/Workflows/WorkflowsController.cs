using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Config.Workflows
{
    [Route("api/config/[controller]")]
    [ApiController]
    [EndpointGroupName("Config")]
    [HasPermission(Permissions.Workflows.View)]
    public class WorkflowsController : ControllerBase
    {
        private readonly IWorkflowService _service;
        public WorkflowsController(IWorkflowService service) => _service = service;

        [HttpGet]
        [SwaggerOperation(Summary = "Obtener todos los workflows")]
        public async Task<IActionResult> GetAll([FromQuery] WorkflowRequest query)
        {
            var result = await _service.GetAllAsync(query);
            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<WorkflowResponse>>
            { Success = true, Message = "Workflows obtenidos exitosamente.", Data = data }));
        }

        [HttpGet("{id}")]
        [SwaggerOperation(Summary = "Obtener workflow por ID")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _service.GetByIdAsync(id);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowResponse>
            { Success = true, Message = "Workflow obtenido exitosamente.", Data = data }));
        }

        [HttpGet("proceso/{codigoProceso}")]
        [SwaggerOperation(Summary = "Obtener workflow por código de proceso")]
        public async Task<IActionResult> GetByCodigo(string codigoProceso)
        {
            var result = await _service.GetByCodigoProcesoAsync(codigoProceso);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowResponse>
            { Success = true, Message = "Workflow obtenido exitosamente.", Data = data }));
        }

        [HttpPost]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Crear nuevo workflow")]
        public async Task<IActionResult> Create([FromBody] CreateWorkflowRequest request)
        {
            var result = await _service.CreateAsync(request);
            return result.ToActionResult(this, data => CreatedAtAction(nameof(GetById),
                new { id = data.IdWorkflow },
                new ApiResponse<WorkflowResponse> { Success = true, Message = "Workflow creado exitosamente.", Data = data }));
        }

        [HttpPut("{id}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar workflow")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateWorkflowRequest request)
        {
            var result = await _service.UpdateAsync(id, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowResponse>
            { Success = true, Message = "Workflow actualizado exitosamente.", Data = data }));
        }

        [HttpDelete("{id}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Eliminar workflow")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _service.DeleteAsync(id);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Workflow eliminado exitosamente.", Data = null }));
        }

        [HttpPut("{idWorkflow}/pasos/{idPaso}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar paso de workflow")]
        public async Task<IActionResult> UpdatePaso(int idWorkflow, int idPaso, [FromBody] UpdatePasoRequest request)
        {
            var result = await _service.UpdatePasoAsync(idWorkflow, idPaso, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowPasoResponse>
            { Success = true, Message = "Paso actualizado exitosamente.", Data = data }));
        }

        // ============================================================================
        // ACCIONES
        // ============================================================================
        
        [HttpPost("{idWorkflow}/pasos/{idPaso}/acciones")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Crear acción en un paso")]
        public async Task<IActionResult> CreateAccion(int idWorkflow, int idPaso, [FromBody] CreateAccionRequest request)
        {
            var result = await _service.CreateAccionAsync(idWorkflow, idPaso, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowAccionResponse>
            { Success = true, Message = "Acción creada exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/pasos/{idPaso}/acciones/{idAccion}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar acción de un paso")]
        public async Task<IActionResult> UpdateAccion(int idWorkflow, int idPaso, int idAccion, [FromBody] UpdateAccionRequest request)
        {
            var result = await _service.UpdateAccionAsync(idWorkflow, idPaso, idAccion, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowAccionResponse>
            { Success = true, Message = "Acción actualizada exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/pasos/{idPaso}/acciones/{idAccion}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Eliminar acción de un paso")]
        public async Task<IActionResult> DeleteAccion(int idWorkflow, int idPaso, int idAccion)
        {
            var result = await _service.DeleteAccionAsync(idWorkflow, idPaso, idAccion);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Acción eliminada exitosamente.", Data = null }));
        }

        // ============================================================================
        // CONDICIONES
        // ============================================================================
        
        [HttpPost("{idWorkflow}/pasos/{idPaso}/condiciones")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Crear condición en un paso")]
        public async Task<IActionResult> CreateCondicion(int idWorkflow, int idPaso, [FromBody] CreateCondicionRequest request)
        {
            var result = await _service.CreateCondicionAsync(idWorkflow, idPaso, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<CondicionResponse>
            { Success = true, Message = "Condición creada exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/pasos/{idPaso}/condiciones/{idCondicion}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar condición de un paso")]
        public async Task<IActionResult> UpdateCondicion(int idWorkflow, int idPaso, int idCondicion, [FromBody] UpdateCondicionRequest request)
        {
            var result = await _service.UpdateCondicionAsync(idWorkflow, idPaso, idCondicion, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<CondicionResponse>
            { Success = true, Message = "Condición actualizada exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/pasos/{idPaso}/condiciones/{idCondicion}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Eliminar condición de un paso")]
        public async Task<IActionResult> DeleteCondicion(int idWorkflow, int idPaso, int idCondicion)
        {
            var result = await _service.DeleteCondicionAsync(idWorkflow, idPaso, idCondicion);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Condición eliminada exitosamente.", Data = null }));
        }

        // ============================================================================
        // PARTICIPANTES
        // ============================================================================
        
        [HttpPost("{idWorkflow}/pasos/{idPaso}/participantes")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Crear participante en un paso")]
        public async Task<IActionResult> CreateParticipante(int idWorkflow, int idPaso, [FromBody] CreateParticipanteRequest request)
        {
            var result = await _service.CreateParticipanteAsync(idWorkflow, idPaso, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<ParticipanteResponse>
            { Success = true, Message = "Participante creado exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/pasos/{idPaso}/participantes/{idParticipante}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar participante de un paso")]
        public async Task<IActionResult> UpdateParticipante(int idWorkflow, int idPaso, int idParticipante, [FromBody] UpdateParticipanteRequest request)
        {
            var result = await _service.UpdateParticipanteAsync(idWorkflow, idPaso, idParticipante, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<ParticipanteResponse>
            { Success = true, Message = "Participante actualizado exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/pasos/{idPaso}/participantes/{idParticipante}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Eliminar participante de un paso")]
        public async Task<IActionResult> DeleteParticipante(int idWorkflow, int idPaso, int idParticipante)
        {
            var result = await _service.DeleteParticipanteAsync(idWorkflow, idPaso, idParticipante);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Participante eliminado exitosamente.", Data = null }));
        }

        // ============================================================================
        // NOTIFICACIONES
        // ============================================================================
        
        [HttpPost("{idWorkflow}/acciones/{idAccion}/notificaciones")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Crear notificación para una acción")]
        public async Task<IActionResult> CreateNotificacion(int idWorkflow, int idAccion, [FromBody] CreateNotificacionRequest request)
        {
            var result = await _service.CreateNotificacionAsync(idWorkflow, idAccion, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<NotificacionResponse>
            { Success = true, Message = "Notificación creada exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/acciones/{idAccion}/notificaciones/{idNotificacion}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar notificación de una acción")]
        public async Task<IActionResult> UpdateNotificacion(int idWorkflow, int idAccion, int idNotificacion, [FromBody] UpdateNotificacionRequest request)
        {
            var result = await _service.UpdateNotificacionAsync(idWorkflow, idAccion, idNotificacion, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<NotificacionResponse>
            { Success = true, Message = "Notificación actualizada exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/acciones/{idAccion}/notificaciones/{idNotificacion}")]
        [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Eliminar notificación de una acción")]
        public async Task<IActionResult> DeleteNotificacion(int idWorkflow, int idAccion, int idNotificacion)
        {
            var result = await _service.DeleteNotificacionAsync(idWorkflow, idAccion, idNotificacion);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Notificación eliminada exitosamente.", Data = null }));
        }
    }
}
