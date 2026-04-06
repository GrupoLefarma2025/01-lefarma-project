using Microsoft.EntityFrameworkCore;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos {
public class BancoRepository : BaseRepository<Banco>, IBancoRepository
    {
        private readonly ApplicationDbContext _context;

        public BancoRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }
    }
}
