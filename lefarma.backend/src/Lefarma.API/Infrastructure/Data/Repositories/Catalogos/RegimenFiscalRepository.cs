using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Domain.Interfaces;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos {
public class RegimenFiscalRepository : BaseRepository<RegimenFiscal>, IRegimenFiscalRepository
    {
        private readonly ApplicationDbContext _context;

        public RegimenFiscalRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }
    }
}
