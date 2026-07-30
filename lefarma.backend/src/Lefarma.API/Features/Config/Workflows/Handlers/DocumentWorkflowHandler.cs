using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Config.Workflows.Handlers
{
/// <summary>
/// Maneja campos de tipo Archivo (comprobante_pago, comprobante_gasto/factura).
/// Valida que exista un comprobante registrado en la tabla comprobantes vinculado a la orden
/// via comprobantes_partidas, diferenciado por categoria ('gasto' o 'pago').
/// </summary>
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

        // Handler no requerido = no bloquea la firma aunque no haya comprobante
        if (!context.Handler.Requerido)
            return HandlerResult.Ok();

        // Validacion:
        //  - Comprobante existe en la tabla comprobantes
        //  - Categoria coincide con el campo (comprobante_gasto → 'gasto', comprobante_pago → 'pago')
        //  - El comprobante tiene al menos una asignacion (ComprobantePartida) vinculada a una
        //    partida de esta orden (via IdOrden). Sin asignaciones no se considera valido.
        //  - No valida estado del comprobante (estado=3 Rechazado igual pasaria).
        //  - No valida montos (el AsignarPartidasAsync ya valida que no exceda pendientes).
        //  - No valida cantidades (solo relevante para CFDI/gasto).
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
