using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Domain.Interfaces.Operaciones {
public interface IPagoRepository : IBaseRepository<Pago>
    {
        Task<decimal> GetTotalPagadoByOrdenAsync(int idOrden);
    }
}
