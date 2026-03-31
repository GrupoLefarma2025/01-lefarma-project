using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Repositories.Operaciones
{
    public class ComprobacionRepository : BaseRepository<Comprobacion>, IComprobacionRepository
    {
        private readonly ApplicationDbContext _context;

        public ComprobacionRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }

        public async Task<Comprobacion?> GetByIdAsync(int id)
            => await _context.Comprobaciones.FindAsync(id);

    }

}
}
