using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
{
    public record WorkflowHandlerContext(
        OrdenCompra Orden,
        int IdOrden,
        int IdAccion,
        int IdUsuario,
        string? Comentario,
        Dictionary<string, object>? DatosAdicionales,
        WorkflowAccionHandler? Handler = null
    );
}
