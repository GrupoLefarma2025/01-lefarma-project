using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Domain.Interfaces;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos {
public class ProveedorRepository : BaseRepository<Proveedor>, IProveedorRepository
    {
        private readonly ApplicationDbContext _context;

        public ProveedorRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }
    }
}
