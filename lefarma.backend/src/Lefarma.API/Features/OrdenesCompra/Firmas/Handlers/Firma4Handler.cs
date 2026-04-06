using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
{
// Firma 4 - GAF: configura checkboxes de comprobaci�n (specs secci�n 5.3)
    public class Firma4Handler : IStepHandler
    {
        public string HandlerKey => "Firma4Handler";

        public Task<string?> ValidarAsync(OrdenCompra orden, Dictionary<string, object>? datos)
            => Task.FromResult<string?>(null); // Los checkboxes tienen default, no son bloqueantes

        public Task AplicarAsync(OrdenCompra orden, Dictionary<string, object>? datos)
        {
            if (datos is null) return Task.CompletedTask;
            if (datos.TryGetValue("RequiereComprobacionPago", out var rcp))
                orden.RequiereComprobacionPago = rcp.ToString()?.ToLower() == "true";
            if (datos.TryGetValue("RequiereComprobacionGasto", out var rcg))
                orden.RequiereComprobacionGasto = rcg.ToString()?.ToLower() == "true";
            return Task.CompletedTask;
        }
    }
}
