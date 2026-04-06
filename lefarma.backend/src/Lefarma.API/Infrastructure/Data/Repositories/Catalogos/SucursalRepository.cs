using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos {
public class SucursalRepository : BaseRepository<Sucursal>, ISucursalRepository
    {
        private readonly ApplicationDbContext _context;

        public SucursalRepository(ApplicationDbContext context) : base(context)
    {
            _context = context;
        }
    }
}
