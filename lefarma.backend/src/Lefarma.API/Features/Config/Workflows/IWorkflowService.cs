using ErrorOr;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.Config.Workflows
{
public interface IWorkflowService
    {
        Task<ErrorOr<IEnumerable<WorkflowResponse>>> GetAllAsync(WorkflowRequest query);
        Task<ErrorOr<IEnumerable<WorkflowFlowResponse>>> GetAllFlowAsync();
        Task<ErrorOr<WorkflowResponse>> GetByIdAsync(int id);
        Task<ErrorOr<WorkflowResponse>> GetByCodigoProcesoAsync(string codigoProceso);
        Task<ErrorOr<IEnumerable<WorkflowScopeTypeResponse>>> GetScopeTypesAsync();
        Task<ErrorOr<IEnumerable<WorkflowMappingResponse>>> GetMappingsAsync(string? codigoProceso = null, int? idWorkflow = null, int? idScopeType = null, int? scopeId = null);
        Task<ErrorOr<WorkflowMappingResponse>> CreateMappingAsync(CreateWorkflowMappingRequest request);
        Task<ErrorOr<WorkflowMappingResponse>> UpdateMappingAsync(int idMapping, UpdateWorkflowMappingRequest request);
        Task<ErrorOr<bool>> DeleteMappingAsync(int idMapping);
        Task<ErrorOr<WorkflowResponse>> CreateAsync(CreateWorkflowRequest request);
        Task<ErrorOr<WorkflowResponse>> UpdateAsync(int id, UpdateWorkflowRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
        Task<ErrorOr<WorkflowPasoResponse>> CreatePasoAsync(int idWorkflow, CreatePasoRequest request);
        Task<ErrorOr<WorkflowPasoResponse>> UpdatePasoAsync(int idWorkflow, int idPaso, UpdatePasoRequest request);
        Task<ErrorOr<bool>> DeletePasoAsync(int idWorkflow, int idPaso);

        // Acciones
        Task<ErrorOr<WorkflowAccionResponse>> CreateAccionAsync(int idWorkflow, int idPaso, CreateAccionRequest request);
        Task<ErrorOr<WorkflowAccionResponse>> UpdateAccionAsync(int idWorkflow, int idPaso, int idAccion, UpdateAccionRequest request);
        Task<ErrorOr<bool>> DeleteAccionAsync(int idWorkflow, int idPaso, int idAccion);
        Task<ErrorOr<WorkflowAccionHandlerResponse>> CreateAccionHandlerAsync(int idWorkflow, int idAccion, CreateAccionHandlerRequest request);
        Task<ErrorOr<WorkflowAccionHandlerResponse>> UpdateAccionHandlerAsync(int idWorkflow, int idAccion, int idHandler, UpdateAccionHandlerRequest request);
        Task<ErrorOr<bool>> DeleteAccionHandlerAsync(int idWorkflow, int idAccion, int idHandler);

        // Condiciones
        Task<ErrorOr<CondicionResponse>> CreateCondicionAsync(int idWorkflow, int idPaso, CreateCondicionRequest request);
        Task<ErrorOr<CondicionResponse>> UpdateCondicionAsync(int idWorkflow, int idPaso, int idCondicion, UpdateCondicionRequest request);
        Task<ErrorOr<bool>> DeleteCondicionAsync(int idWorkflow, int idPaso, int idCondicion);

        // Participantes
        Task<ErrorOr<ParticipanteResponse>> CreateParticipanteAsync(int idWorkflow, int idPaso, CreateParticipanteRequest request);
        Task<ErrorOr<ParticipanteResponse>> UpdateParticipanteAsync(int idWorkflow, int idPaso, int idParticipante, UpdateParticipanteRequest request);
        Task<ErrorOr<bool>> DeleteParticipanteAsync(int idWorkflow, int idPaso, int idParticipante);

        // Notificaciones
        Task<ErrorOr<NotificacionResponse>> CreateNotificacionAsync(int idWorkflow, int idAccion, CreateNotificacionRequest request);
        Task<ErrorOr<NotificacionResponse>> UpdateNotificacionAsync(int idWorkflow, int idAccion, int idNotificacion, UpdateNotificacionRequest request);
        Task<ErrorOr<bool>> DeleteNotificacionAsync(int idWorkflow, int idAccion, int idNotificacion);

        // Campos configurables
        Task<ErrorOr<WorkflowCampoResponse>> CreateCampoAsync(int idWorkflow, CreateWorkflowCampoRequest request);
        Task<ErrorOr<WorkflowCampoResponse>> UpdateCampoAsync(int idWorkflow, int idWorkflowCampo, UpdateWorkflowCampoRequest request);
        Task<ErrorOr<bool>> DeleteCampoAsync(int idWorkflow, int idWorkflowCampo);

        // Canal Templates
        Task<ErrorOr<IEnumerable<WorkflowCanalTemplateResponse>>> GetCanalTemplatesAsync(int idWorkflow);
        Task<ErrorOr<WorkflowCanalTemplateResponse>> CreateCanalTemplateAsync(int idWorkflow, CreateCanalTemplateRequest request);
        Task<ErrorOr<WorkflowCanalTemplateResponse>> UpsertCanalTemplateAsync(int idWorkflow, string codigoCanal, UpsertCanalTemplateRequest request);

        // Tipos Notificacion
        Task<ErrorOr<IEnumerable<WorkflowTipoNotificacionResponse>>> GetTiposNotificacionAsync();
        Task<ErrorOr<IEnumerable<WorkflowNotificacionesPlantillaResponse>>> GetPlantillasBaseAsync(string? tipoNotificacion, string? canal);

        // Recordatorios
        Task<ErrorOr<IEnumerable<WorkflowRecordatorioResponse>>> GetRecordatoriosAsync(int idWorkflow);
        Task<ErrorOr<WorkflowRecordatorioResponse>> CreateRecordatorioAsync(int idWorkflow, CreateRecordatorioRequest request);
        Task<ErrorOr<WorkflowRecordatorioResponse>> UpdateRecordatorioAsync(int idWorkflow, int idRecordatorio, UpdateRecordatorioRequest request);
        Task<ErrorOr<bool>> DeleteRecordatorioAsync(int idWorkflow, int idRecordatorio);
        Task<ErrorOr<bool>> TestRecordatorioAsync(int idWorkflow, int idRecordatorio, int idUsuarioActual);
    }
}
