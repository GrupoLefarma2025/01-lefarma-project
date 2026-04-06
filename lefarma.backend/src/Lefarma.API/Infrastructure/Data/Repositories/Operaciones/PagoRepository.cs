using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Operaciones {
public class PagoRepository : BaseRepository<Pago>, IPagoRepository
    {
        private readonly ApplicationDbContext _context;

        public PagoRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }

        public async Task<decimal> GetTotalPagadoByOrdenAsync(int idOrden)
            => await _context.Pagos.Where(p => p.IdOrdenCompra == idOrden).SumAsync(p => p.Monto);

    }
}
