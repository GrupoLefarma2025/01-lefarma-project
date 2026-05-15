using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Infrastructure.Data.Repositories;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos
{
    public class TipoGastoRepository : BaseRepository<TipoGasto>, ITipoGastoRepository
    {
        public TipoGastoRepository(ApplicationDbContext context) : base(context)
        {
        }
    }
}
