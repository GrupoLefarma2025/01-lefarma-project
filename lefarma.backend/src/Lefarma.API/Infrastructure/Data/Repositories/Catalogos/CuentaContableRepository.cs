using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Domain.Interfaces;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos {
public class CuentaContableRepository : BaseRepository<CuentaContable>, ICuentaContableRepository
    {
        private readonly ApplicationDbContext _context;

        public CuentaContableRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }
    }
}
