using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Domain.Interfaces.Config
{
    public interface IWorkflowEngine
    {
        Task<WorkflowEjecucionResult> EjecutarAccionAsync(WorkflowContext context);
        Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(string codigoProceso, int idOrden, int idUsuario);
        
        // Sobrecarga por idWorkflow
        Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(int idWorkflow, int idOrden, int idUsuario);
    }

    public record WorkflowContext(
        int IdWorkflow,
        int IdOrden,
        int IdAccion,
        int IdUsuario,
        OrdenCompra Orden,
        string? Comentario,
        Dictionary<string, object>? DatosAdicionales = null
    );

    public record WorkflowEjecucionResult(
        bool Exitoso,
        string? Error,
        int? NuevoIdPaso,
        int? NuevoIdEstado
    );
}
