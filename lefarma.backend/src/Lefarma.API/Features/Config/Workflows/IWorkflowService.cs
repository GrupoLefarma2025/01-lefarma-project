using ErrorOr;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.Config.Workflows
{
    public interface IWorkflowService
    {
        Task<ErrorOr<IEnumerable<WorkflowResponse>>> GetAllAsync(WorkflowRequest query);
        Task<ErrorOr<WorkflowResponse>> GetByIdAsync(int id);
        Task<ErrorOr<WorkflowResponse>> GetByCodigoProcesoAsync(string codigoProceso);
        Task<ErrorOr<WorkflowResponse>> CreateAsync(CreateWorkflowRequest request);
        Task<ErrorOr<WorkflowResponse>> UpdateAsync(int id, UpdateWorkflowRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
        Task<ErrorOr<WorkflowPasoResponse>> UpdatePasoAsync(int idWorkflow, int idPaso, UpdatePasoRequest request);

        // Acciones
        Task<ErrorOr<WorkflowAccionResponse>> CreateAccionAsync(int idWorkflow, int idPaso, CreateAccionRequest request);
        Task<ErrorOr<WorkflowAccionResponse>> UpdateAccionAsync(int idWorkflow, int idPaso, int idAccion, UpdateAccionRequest request);
        Task<ErrorOr<bool>> DeleteAccionAsync(int idWorkflow, int idPaso, int idAccion);

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
    }
}
