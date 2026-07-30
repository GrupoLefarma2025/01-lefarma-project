using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Config;

namespace Lefarma.API.Features.Config.Workflows.Handlers
{
    public record WorkflowHandlerContext(
        IWorkflowEntity Entidad,
        int IdEntidad,
        string TipoEntidad,
        int IdAccion,
        int IdUsuario,
        string? Comentario,
        Dictionary<string, object>? DatosAdicionales,
        WorkflowAccionHandler? Handler = null
    );
}
