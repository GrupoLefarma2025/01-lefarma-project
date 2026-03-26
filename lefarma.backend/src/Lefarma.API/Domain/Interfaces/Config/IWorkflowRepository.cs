using Lefarma.API.Domain.Entities.Config;

namespace Lefarma.API.Domain.Interfaces.Config
{
    public interface IWorkflowRepository : IBaseRepository<Workflow>
    {
        Task<Workflow?> GetByCodigoProcesoAsync(string codigoProceso);
        Task<WorkflowPaso?> GetPasoByCodigoEstadoAsync(int idWorkflow, string codigoEstado);
        Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(int idPaso);
    }
}
