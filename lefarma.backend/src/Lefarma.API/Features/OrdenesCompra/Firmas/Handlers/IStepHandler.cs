using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
{
    public interface IStepHandler
    {
        string HandlerKey { get; }
        Task<string?> ValidarAsync(OrdenCompra orden, Dictionary<string, object>? datos);
        Task AplicarAsync(OrdenCompra orden, Dictionary<string, object>? datos);
    }
}
