using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos
{
    public class MedidaRepository : BaseRepository<Medida>, IMedidaRepository
    {
        private readonly ApplicationDbContext _context;

        public MedidaRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }

        public async Task<ICollection<Medida>> GetAllConUnidadesAsync()
        {
            return await _context.Medidas
                .Include(t => t.UnidadesMedida)
                .ToListAsync();
        }

    }
}
