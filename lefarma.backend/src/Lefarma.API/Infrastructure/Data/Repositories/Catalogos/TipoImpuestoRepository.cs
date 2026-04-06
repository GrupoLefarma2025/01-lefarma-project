using Microsoft.EntityFrameworkCore;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos
{
    public class TipoImpuestoRepository : BaseRepository<TipoImpuesto>, ITipoImpuestoRepository
    {
        private readonly ApplicationDbContext _context;

        public TipoImpuestoRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }
    }
}
