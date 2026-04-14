using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using System.Security.Claims;

namespace Lefarma.API.Features.Config.Workflows
{
[Route("api/config/[controller]")]
    [ApiController]
    [EndpointGroupName("Config")]
//    [HasPermission(Permissions.Workflows.View)]
    public class WorkflowsController : ControllerBase
    {
        private readonly IWorkflowService _service;
        public WorkflowsController(IWorkflowService service) => _service = service;

        [HttpGet]
        [SwaggerOperation(Summary = "Obtener todos los workflows")]
        public async Task<IActionResult> GetAll(WorkflowRequest? query)
        {
            if(query == null)
            {
                query = new WorkflowRequest();
            }
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
        [SwaggerOperation(Summary = "Obtener workflow por c�digo de proceso")]
        public async Task<IActionResult> GetByCodigo(string codigoProceso)
        {
            var result = await _service.GetByCodigoProcesoAsync(codigoProceso);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowResponse>
            { Success = true, Message = "Workflow obtenido exitosamente.", Data = data }));
        }

        [HttpPost]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Crear nuevo workflow")]
        public async Task<IActionResult> Create( CreateWorkflowRequest request)
        {
            var result = await _service.CreateAsync(request);
            return result.ToActionResult(this, data => CreatedAtAction(nameof(GetById),
                new { id = data.IdWorkflow },
                new ApiResponse<WorkflowResponse> { Success = true, Message = "Workflow creado exitosamente.", Data = data }));
        }

        [HttpPut("{id}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar workflow")]
        public async Task<IActionResult> Update(int id,  UpdateWorkflowRequest request)
        {
            var result = await _service.UpdateAsync(id, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowResponse>
            { Success = true, Message = "Workflow actualizado exitosamente.", Data = data }));
        }

        [HttpDelete("{id}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Eliminar workflow")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _service.DeleteAsync(id);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Workflow eliminado exitosamente.", Data = null }));
        }

        [HttpPut("{idWorkflow}/pasos/{idPaso}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar paso de workflow")]
        public async Task<IActionResult> UpdatePaso(int idWorkflow, int idPaso,  UpdatePasoRequest request)
        {
            var result = await _service.UpdatePasoAsync(idWorkflow, idPaso, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowPasoResponse>
            { Success = true, Message = "Paso actualizado exitosamente.", Data = data }));
        }

        [HttpPost("{idWorkflow}/pasos")]
        [SwaggerOperation(Summary = "Crear paso de workflow")]
        public async Task<IActionResult> CreatePaso(int idWorkflow,  CreatePasoRequest request)
        {
            var result = await _service.CreatePasoAsync(idWorkflow, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowPasoResponse>
            { Success = true, Message = "Paso creado exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/pasos/{idPaso}")]
        [SwaggerOperation(Summary = "Inactivar paso de workflow")]
        public async Task<IActionResult> DeletePaso(int idWorkflow, int idPaso)
        {
            var result = await _service.DeletePasoAsync(idWorkflow, idPaso);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Paso inactivado exitosamente.", Data = null }));
        }

        // ============================================================================
        // ACCIONES
        // ============================================================================
        
        [HttpPost("{idWorkflow}/pasos/{idPaso}/acciones")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Crear acci�n en un paso")]
        public async Task<IActionResult> CreateAccion(int idWorkflow, int idPaso,  CreateAccionRequest request)
        {
            var result = await _service.CreateAccionAsync(idWorkflow, idPaso, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowAccionResponse>
            { Success = true, Message = "Acci�n creada exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/pasos/{idPaso}/acciones/{idAccion}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar acci�n de un paso")]
        public async Task<IActionResult> UpdateAccion(int idWorkflow, int idPaso, int idAccion,  UpdateAccionRequest request)
        {
            var result = await _service.UpdateAccionAsync(idWorkflow, idPaso, idAccion, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowAccionResponse>
            { Success = true, Message = "Acci�n actualizada exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/pasos/{idPaso}/acciones/{idAccion}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Eliminar acci�n de un paso")]
        public async Task<IActionResult> DeleteAccion(int idWorkflow, int idPaso, int idAccion)
        {
            var result = await _service.DeleteAccionAsync(idWorkflow, idPaso, idAccion);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Acci�n eliminada exitosamente.", Data = null }));
        }

        [HttpPost("{idWorkflow}/acciones/{idAccion}/handlers")]
        [SwaggerOperation(Summary = "Crear handler para una acción")]
        public async Task<IActionResult> CreateAccionHandler(int idWorkflow, int idAccion, [FromBody] CreateAccionHandlerRequest request)
        {
            var result = await _service.CreateAccionHandlerAsync(idWorkflow, idAccion, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowAccionHandlerResponse>
            { Success = true, Message = "Handler creado exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/acciones/{idAccion}/handlers/{idHandler}")]
        [SwaggerOperation(Summary = "Actualizar handler de una acción")]
        public async Task<IActionResult> UpdateAccionHandler(int idWorkflow, int idAccion, int idHandler, [FromBody] UpdateAccionHandlerRequest request)
        {
            var result = await _service.UpdateAccionHandlerAsync(idWorkflow, idAccion, idHandler, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowAccionHandlerResponse>
            { Success = true, Message = "Handler actualizado exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/acciones/{idAccion}/handlers/{idHandler}")]
        [SwaggerOperation(Summary = "Eliminar handler de una acción")]
        public async Task<IActionResult> DeleteAccionHandler(int idWorkflow, int idAccion, int idHandler)
        {
            var result = await _service.DeleteAccionHandlerAsync(idWorkflow, idAccion, idHandler);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Handler eliminado exitosamente.", Data = null }));
        }

        // ============================================================================
        // CONDICIONES
        // ============================================================================
        
        [HttpPost("{idWorkflow}/pasos/{idPaso}/condiciones")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Crear condici�n en un paso")]
        public async Task<IActionResult> CreateCondicion(int idWorkflow, int idPaso,  CreateCondicionRequest request)
        {
            var result = await _service.CreateCondicionAsync(idWorkflow, idPaso, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<CondicionResponse>
            { Success = true, Message = "Condici�n creada exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/pasos/{idPaso}/condiciones/{idCondicion}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar condici�n de un paso")]
        public async Task<IActionResult> UpdateCondicion(int idWorkflow, int idPaso, int idCondicion,  UpdateCondicionRequest request)
        {
            var result = await _service.UpdateCondicionAsync(idWorkflow, idPaso, idCondicion, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<CondicionResponse>
            { Success = true, Message = "Condici�n actualizada exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/pasos/{idPaso}/condiciones/{idCondicion}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Eliminar condici�n de un paso")]
        public async Task<IActionResult> DeleteCondicion(int idWorkflow, int idPaso, int idCondicion)
        {
            var result = await _service.DeleteCondicionAsync(idWorkflow, idPaso, idCondicion);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Condici�n eliminada exitosamente.", Data = null }));
        }

        // ============================================================================
        // PARTICIPANTES
        // ============================================================================
        
        [HttpPost("{idWorkflow}/pasos/{idPaso}/participantes")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Crear participante en un paso")]
        public async Task<IActionResult> CreateParticipante(int idWorkflow, int idPaso,  CreateParticipanteRequest request)
        {
            var result = await _service.CreateParticipanteAsync(idWorkflow, idPaso, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<ParticipanteResponse>
            { Success = true, Message = "Participante creado exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/pasos/{idPaso}/participantes/{idParticipante}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar participante de un paso")]
        public async Task<IActionResult> UpdateParticipante(int idWorkflow, int idPaso, int idParticipante,  UpdateParticipanteRequest request)
        {
            var result = await _service.UpdateParticipanteAsync(idWorkflow, idPaso, idParticipante, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<ParticipanteResponse>
            { Success = true, Message = "Participante actualizado exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/pasos/{idPaso}/participantes/{idParticipante}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
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
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Crear notificaci�n para una acci�n")]
        public async Task<IActionResult> CreateNotificacion(int idWorkflow, int idAccion,  CreateNotificacionRequest request)
        {
            var result = await _service.CreateNotificacionAsync(idWorkflow, idAccion, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<NotificacionResponse>
            { Success = true, Message = "Notificaci�n creada exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/acciones/{idAccion}/notificaciones/{idNotificacion}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Actualizar notificaci�n de una acci�n")]
        public async Task<IActionResult> UpdateNotificacion(int idWorkflow, int idAccion, int idNotificacion,  UpdateNotificacionRequest request)
        {
            var result = await _service.UpdateNotificacionAsync(idWorkflow, idAccion, idNotificacion, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<NotificacionResponse>
            { Success = true, Message = "Notificaci�n actualizada exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/acciones/{idAccion}/notificaciones/{idNotificacion}")]
    //    [HasPermission(Permissions.Workflows.Manage)]
        [SwaggerOperation(Summary = "Eliminar notificaci�n de una acci�n")]
        public async Task<IActionResult> DeleteNotificacion(int idWorkflow, int idAccion, int idNotificacion)
        {
            var result = await _service.DeleteNotificacionAsync(idWorkflow, idAccion, idNotificacion);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Notificaci�n eliminada exitosamente.", Data = null }));
        }

        [HttpPost("{idWorkflow}/campos")]
        [SwaggerOperation(Summary = "Crear campo configurable de workflow")]
        public async Task<IActionResult> CreateCampo(int idWorkflow, [FromBody] CreateWorkflowCampoRequest request)
        {
            var result = await _service.CreateCampoAsync(idWorkflow, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowCampoResponse>
            { Success = true, Message = "Campo creado exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/campos/{idWorkflowCampo}")]
        [SwaggerOperation(Summary = "Actualizar campo configurable de workflow")]
        public async Task<IActionResult> UpdateCampo(int idWorkflow, int idWorkflowCampo, [FromBody] UpdateWorkflowCampoRequest request)
        {
            var result = await _service.UpdateCampoAsync(idWorkflow, idWorkflowCampo, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowCampoResponse>
            { Success = true, Message = "Campo actualizado exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/campos/{idWorkflowCampo}")]
        [SwaggerOperation(Summary = "Eliminar campo configurable de workflow")]
        public async Task<IActionResult> DeleteCampo(int idWorkflow, int idWorkflowCampo)
        {
            var result = await _service.DeleteCampoAsync(idWorkflow, idWorkflowCampo);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Campo eliminado exitosamente.", Data = null }));
        }

        // ============================================================================
        // CANAL TEMPLATES
        // ============================================================================

        [HttpGet("{idWorkflow}/canal-templates")]
        [SwaggerOperation(Summary = "Obtener plantillas de canal del workflow")]
        public async Task<IActionResult> GetCanalTemplates(int idWorkflow)
        {
            var result = await _service.GetCanalTemplatesAsync(idWorkflow);
            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<WorkflowCanalTemplateResponse>>
            { Success = true, Message = "Plantillas de canal obtenidas exitosamente.", Data = data }));
        }

        [HttpPost("{idWorkflow}/canal-templates")]
        [SwaggerOperation(Summary = "Crear nueva plantilla de canal")]
        public async Task<IActionResult> CreateCanalTemplate(int idWorkflow, [FromBody] CreateCanalTemplateRequest request)
        {
            var result = await _service.CreateCanalTemplateAsync(idWorkflow, request);
            return result.ToActionResult(this, data => StatusCode(201, new ApiResponse<WorkflowCanalTemplateResponse>
            { Success = true, Message = "Plantilla de canal creada exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/canal-templates/{codigoCanal}")]
        [SwaggerOperation(Summary = "Crear o actualizar plantilla de canal")]
        public async Task<IActionResult> UpsertCanalTemplate(int idWorkflow, string codigoCanal, [FromBody] UpsertCanalTemplateRequest request)
        {
            var result = await _service.UpsertCanalTemplateAsync(idWorkflow, codigoCanal, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowCanalTemplateResponse>
            { Success = true, Message = "Plantilla de canal guardada exitosamente.", Data = data }));
        }

        // ============================================================================
        // TIPOS NOTIFICACION
        // ============================================================================

        [HttpGet("tipos-notificacion")]
        [SwaggerOperation(Summary = "Obtener tipos de notificación disponibles")]
        public async Task<IActionResult> GetTiposNotificacion()
        {
            var result = await _service.GetTiposNotificacionAsync();
            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<WorkflowTipoNotificacionResponse>>
            { Success = true, Message = "Tipos obtenidos.", Data = data }));
        }

        [HttpGet("plantillas-base")]
        [SwaggerOperation(Summary = "Obtener plantillas base del catálogo para pre-llenar templates")]
        public async Task<IActionResult> GetPlantillasBase(
            [FromQuery] string? tipoNotificacion = null,
            [FromQuery] string? canal = null)
        {
            var result = await _service.GetPlantillasBaseAsync(tipoNotificacion, canal);
            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<WorkflowNotificacionesPlantillaResponse>>
            { Success = true, Message = "Plantillas obtenidas.", Data = data }));
        }

        // ============================================================================
        // RECORDATORIOS
        // ============================================================================

        [HttpGet("{idWorkflow}/recordatorios")]
        [SwaggerOperation(Summary = "Obtener recordatorios automáticos del workflow")]
        public async Task<IActionResult> GetRecordatorios(int idWorkflow)
        {
            var result = await _service.GetRecordatoriosAsync(idWorkflow);
            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<WorkflowRecordatorioResponse>>
            { Success = true, Message = "Recordatorios obtenidos exitosamente.", Data = data }));
        }

        [HttpPost("{idWorkflow}/recordatorios")]
        [SwaggerOperation(Summary = "Crear recordatorio automático")]
        public async Task<IActionResult> CreateRecordatorio(int idWorkflow, [FromBody] CreateRecordatorioRequest request)
        {
            var result = await _service.CreateRecordatorioAsync(idWorkflow, request);
            return result.ToActionResult(this, data => StatusCode(201, new ApiResponse<WorkflowRecordatorioResponse>
            { Success = true, Message = "Recordatorio creado exitosamente.", Data = data }));
        }

        [HttpPut("{idWorkflow}/recordatorios/{idRecordatorio}")]
        [SwaggerOperation(Summary = "Actualizar recordatorio automático")]
        public async Task<IActionResult> UpdateRecordatorio(int idWorkflow, int idRecordatorio, [FromBody] UpdateRecordatorioRequest request)
        {
            var result = await _service.UpdateRecordatorioAsync(idWorkflow, idRecordatorio, request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<WorkflowRecordatorioResponse>
            { Success = true, Message = "Recordatorio actualizado exitosamente.", Data = data }));
        }

        [HttpDelete("{idWorkflow}/recordatorios/{idRecordatorio}")]
        [SwaggerOperation(Summary = "Eliminar recordatorio automático")]
        public async Task<IActionResult> DeleteRecordatorio(int idWorkflow, int idRecordatorio)
        {
            var result = await _service.DeleteRecordatorioAsync(idWorkflow, idRecordatorio);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Recordatorio eliminado exitosamente.", Data = null }));
        }

        [HttpPost("{idWorkflow}/recordatorios/{idRecordatorio}/test")]
        [SwaggerOperation(Summary = "Probar recordatorio inmediatamente para el usuario actual")]
        public async Task<IActionResult> TestRecordatorio(int idWorkflow, int idRecordatorio)
        {
            var idUsuarioActual = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
            var result = await _service.TestRecordatorioAsync(idWorkflow, idRecordatorio, idUsuarioActual);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            { Success = true, Message = "Recordatorio de prueba enviado.", Data = null }));
        }
    }
}
