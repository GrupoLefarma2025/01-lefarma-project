using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos
{
    public class UnidadMedidaRepository : BaseRepository<UnidadMedida>, IUnidadMedidaRepository
    {
        private readonly ApplicationDbContext _context;

        public UnidadMedidaRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }

        public async Task ActualizarActivosAsync(int idMedida, List<int> idsUnidadesActivas)
        {
            var todasLasUnidades = await _context.UnidadesMedida
                .Where(u => u.IdMedida == idMedida)
                .ToListAsync();

            foreach (var unidad in todasLasUnidades)
            {
                unidad.Activo = idsUnidadesActivas.Contains(unidad.IdUnidadMedida);
                unidad.FechaModificacion = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }
    }
}
