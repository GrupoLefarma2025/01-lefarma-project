using Lefarma.API.Domain.Entities.Config;

namespace Lefarma.API.Domain.Interfaces.Config {
public interface IWorkflowRepository : IBaseRepository<Workflow>
    {
        Task<Workflow?> GetByCodigoProcesoAsync(string codigoProceso);
        Task<WorkflowPaso?> GetPasoByIdEstadoAsync(int idWorkflow, int idEstado);
        Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(int idPaso);
        Task<ICollection<WorkflowAccionHandler>> GetAccionHandlersAsync(int idAccion);
        Task<ICollection<WorkflowCampo>> GetCamposByWorkflowAsync(int idWorkflow);
        Task<ICollection<WorkflowCanalTemplate>> GetCanalTemplatesAsync();
        Task<WorkflowCanalTemplate?> GetCanalTemplateAsync(string codigoCanal);
    }
}
