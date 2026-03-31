using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Operaciones
{
    public class ComprobacionRepository : BaseRepository<Comprobacion>, IComprobacionRepository
    {
        private readonly ApplicationDbContext _context;

        public ComprobacionRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }

        public async Task<ICollection<Comprobacion>> GetByOrdenAsync(int idOrden)
            => await _context.Comprobaciones.Where(c => c.IdOrdenCompra == idOrden).ToListAsync();

        public async Task<Comprobacion?> GetByUuidAsync(string uuid)
            => await _context.Comprobaciones.FirstOrDefaultAsync(c => c.Uuid == uuid);
    }
}
