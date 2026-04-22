using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
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

    public async Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson)
    {
        if (context.Handler?.Campo is not { } campo)
            return HandlerResult.Fail("Document: el handler no tiene un campo vinculado.");

        if (!context.Handler.Requerido)
            return HandlerResult.Ok();

        // Busca un comprobante registrado con asignaciones vinculadas a partidas de la orden.
        // La categoria distingue gasto ('cfdi','ticket',etc.) de pago ('spei','cheque',etc.)
        bool tieneComprobante =
            await _context.Comprobantes
                .AnyAsync(c =>
                    (campo.NombreTecnico == "comprobante_gasto" && c.Categoria == "gasto" ||
                     campo.NombreTecnico == "comprobante_pago"  && c.Categoria == "pago")
                    && c.Asignaciones.Any(a => a.Partida!.IdOrden == context.IdOrden));

        if (tieneComprobante)
            return HandlerResult.Ok();

        return HandlerResult.Fail($"No hay {campo.EtiquetaUsuario.ToLower()} registrado.");
    }
}
}
