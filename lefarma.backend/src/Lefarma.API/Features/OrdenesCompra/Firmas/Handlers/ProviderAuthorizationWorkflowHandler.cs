using Lefarma.API.Features.Catalogos.Proveedores.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers;

public class ProviderAuthorizationWorkflowHandler : IWorkflowActionHandler
{
    private readonly ApplicationDbContext _context;

    public ProviderAuthorizationWorkflowHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public string HandlerKey => "ProviderAuthorization";

    public async Task<HandlerResult> ProcessAsync(WorkflowHandlerContext ctx, string? configJson)
    {
        if (!ctx.Orden.IdProveedor.HasValue)
            return HandlerResult.Fail("La orden no tiene un proveedor asignado.");

        var proveedor = await _context.Proveedores
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.IdProveedor == ctx.Orden.IdProveedor.Value);

        if (proveedor is null)
            return HandlerResult.Fail("El proveedor asignado a la orden no existe.");

        if (proveedor.Estatus != EstatusProveedor.Aprobado)
        {
            var msg = "El proveedor no esta autorizado. Contacte para que lo autoricen.";
            if (!string.IsNullOrWhiteSpace(configJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(configJson);
                    if (doc.RootElement.TryGetProperty("mensaje", out var m))
                        msg = m.GetString() ?? msg;
                }
                catch { }
            }
            return HandlerResult.Fail(msg);
        }

        return HandlerResult.Ok();
    }
}
