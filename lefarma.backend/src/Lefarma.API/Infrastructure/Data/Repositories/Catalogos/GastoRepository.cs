using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos
{
    public class GastoRepository : BaseRepository<Gasto>, IGastoRepository
    {
        private readonly ApplicationDbContext _context;
        public GastoRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }

        public async Task<ICollection<Gasto>> GetAllConUnidadesAsync()
        {
            return await _context.Gastos
                .Include(g => g.GastoUnidadesMedida.Where(gu => gu.Activo))
                .ThenInclude(gu => gu.UnidadMedida)
                .ToListAsync();
        }

        public async Task<Gasto?> GetByIdConUnidadesAsync(int id)
        {
            return await _context.Gastos
                .Include(g => g.GastoUnidadesMedida.Where(gu => gu.Activo))
                .ThenInclude(gu => gu.UnidadMedida)
                .FirstOrDefaultAsync(g => g.IdGasto == id);
        }

        public async Task ActualizarUnidadesMedidaAsync(int idGasto, List<int> idsUnidadesMedidaActivas)
        {
            var relacionesExistentes = await _context.GastosUnidadesMedida
                .Where(gu => gu.IdGasto == idGasto)
                .ToListAsync();

            foreach (var relacion in relacionesExistentes)
            {
                relacion.Activo = idsUnidadesMedidaActivas.Contains(relacion.IdUnidadMedida);
            }

            var idsExistentes = relacionesExistentes.Select(r => r.IdUnidadMedida).ToList();
            var idsNuevos = idsUnidadesMedidaActivas.Except(idsExistentes).ToList();

            foreach (var idUnidad in idsNuevos)
            {
                _context.GastosUnidadesMedida.Add(new GastoUnidadMedida
                {
                    IdGasto = idGasto,
                    IdUnidadMedida = idUnidad,
                    Activo = true,
                    FechaCreacion = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
        }
    }
}
