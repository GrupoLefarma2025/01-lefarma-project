using Lefarma.API.Domain.Entities.Operaciones;
using System.Collections.Generic;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
{
    public class ComprobacionHandler : IStepHandler
    {
        public string HandlerKey => "ComprobacionHandler";
        public Task<string?> ValidarAsync(OrdenCompra orden, Dictionary<string, object>? datos)
            => Task.FromResult<string?>(null);
        public Task AplicarAsync(OrdenCompra orden, Dictionary<string, object>? datos)
            => Task.CompletedTask;
    }
}
