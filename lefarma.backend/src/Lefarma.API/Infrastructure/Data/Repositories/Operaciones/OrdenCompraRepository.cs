using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Operaciones
{
    public class OrdenCompraRepository : BaseRepository<OrdenCompra>, IOrdenCompraRepository
    {
        private readonly ApplicationDbContext _context;

        public OrdenCompraRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }

        public async Task<OrdenCompra?> GetWithPartidasAsync(int idOrden)
            => await _context.OrdenesCompra
                .Include(o => o.Partidas)
                .FirstOrDefaultAsync(o => o.IdOrden == idOrden);

        public async Task<ICollection<OrdenCompra>> GetByEstadoAsync(EstadoOC estado)
            => await _context.OrdenesCompra
                .Where(o => o.Estado == estado)
                .OrderByDescending(o => o.FechaCreacion)
                .ToListAsync();

        public async Task<ICollection<OrdenCompra>> GetBandejaAsync(int idUsuario, EstadoOC[] estados)
            => await _context.OrdenesCompra
                .Where(o => estados.Contains(o.Estado))
                .OrderByDescending(o => o.FechaCreacion)
                .ToListAsync();

        public async Task<string> GenerarFolioAsync()
        {
            var year = DateTime.UtcNow.Year;
            var prefix = $"OC-{year}-";

            // Busca el último folio del año para evitar duplicados por concurrencia
            var ultimoFolio = await _context.OrdenesCompra
                .Where(o => o.Folio.StartsWith(prefix))
                .Select(o => o.Folio)
                .OrderByDescending(f => f)
                .FirstOrDefaultAsync();

            int siguiente = 1;
            if (ultimoFolio is not null &&
                int.TryParse(ultimoFolio.Replace(prefix, ""), out var ultimo))
            {
                siguiente = ultimo + 1;
            }

            return $"{prefix}{siguiente:D5}";
        }
    }
}
