using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Config.Workflows.Handlers
{
public class DocumentWorkflowHandler : IWorkflowActionHandler
{
    private readonly ApplicationDbContext _context;

    public DocumentWorkflowHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public string HandlerKey => "Document";

    public IReadOnlySet<string> TiposEntidadCompatibles => new HashSet<string> { CodigoProceso.ORDEN_COMPRA };

    public async Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson)
    {
        if (context.Handler?.Campo is not { } campo)
            return HandlerResult.Fail("Document: el handler no tiene un campo vinculado.");

        if (!context.Handler.Requerido)
            return HandlerResult.Ok();

        bool tieneComprobante =
            await _context.Comprobantes
                .AnyAsync(c =>
                    (campo.NombreTecnico == "comprobante_gasto" && c.Categoria == "gasto" ||
                     campo.NombreTecnico == "comprobante_pago"  && c.Categoria == "pago")
                     && c.Asignaciones.Any(a => a.Partida!.IdOrden == context.IdEntidad));

            if (tieneComprobante)
            return HandlerResult.Ok();

        return HandlerResult.Fail($"No hay {campo.EtiquetaUsuario.ToLower()} registrado.");
    }
}
}
