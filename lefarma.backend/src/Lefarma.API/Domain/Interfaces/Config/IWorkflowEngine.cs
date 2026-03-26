using Lefarma.API.Domain.Entities.Config;

namespace Lefarma.API.Domain.Interfaces.Config
{
    public interface IWorkflowEngine
    {
        Task<WorkflowEjecucionResult> EjecutarAccionAsync(WorkflowContext context);
        Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(string codigoProceso, int idOrden, int idUsuario);
    }

    public record WorkflowContext(
        string CodigoProceso,
        int IdOrden,
        int IdAccion,
        int IdUsuario,
        string? Comentario,
        Dictionary<string, object>? DatosAdicionales = null
    );

    public record WorkflowEjecucionResult(
        bool Exitoso,
        string? Error,
        int? NuevoIdPaso,
        string? NuevoCodigoEstado
    );
}
