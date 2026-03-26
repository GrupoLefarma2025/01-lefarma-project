using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
{
    // Firma 3 - CxP: asigna centro de costo y cuenta contable (specs sección 5.2)
    public class Firma3Handler : IStepHandler
    {
        public string HandlerKey => "Firma3Handler";

        public Task<string?> ValidarAsync(OrdenCompra orden, Dictionary<string, object>? datos)
        {
            if (datos is null || !datos.ContainsKey("CentroCosto"))
                return Task.FromResult<string?>("El centro de costo es obligatorio en Firma 3.");
            if (!datos.ContainsKey("CuentaContable"))
                return Task.FromResult<string?>("La cuenta contable es obligatoria en Firma 3.");
            return Task.FromResult<string?>(null);
        }

        public Task AplicarAsync(OrdenCompra orden, Dictionary<string, object>? datos)
        {
            if (datos is null) return Task.CompletedTask;
            if (datos.TryGetValue("CentroCosto", out var cc) && int.TryParse(cc.ToString(), out var idCc))
                orden.IdCentroCosto = idCc;
            if (datos.TryGetValue("CuentaContable", out var cuenta))
                orden.CuentaContable = cuenta.ToString();
            return Task.CompletedTask;
        }
    }
}
