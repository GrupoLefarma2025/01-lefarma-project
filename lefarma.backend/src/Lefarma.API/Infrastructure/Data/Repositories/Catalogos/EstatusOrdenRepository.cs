using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Domain.Interfaces;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos {
public class EstatusOrdenRepository : BaseRepository<EstatusOrden>, IEstatusOrdenRepository
    {
        private readonly ApplicationDbContext _context;

        public EstatusOrdenRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }
    }
}
