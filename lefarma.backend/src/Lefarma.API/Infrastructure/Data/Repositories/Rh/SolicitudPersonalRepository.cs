using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.SolicitudesPersonal;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.SolicitudesPersonal
{
    public class SolicitudPersonalRepository : BaseRepository<SolicitudPersonal>, ISolicitudPersonalRepository
    {
        private readonly ApplicationDbContext _context;

        public SolicitudPersonalRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }

        public async Task<SolicitudPersonal?> GetWithDetalleAsync(int idSolicitud)
        {
            return await _context.SolicitudesPersonal
                .Include(s => s.Estado)
                .Include(s => s.Empresa)
                .Include(s => s.Sucursal)
                .Include(s => s.Area)
                .Include(s => s.Detalle)
                .FirstOrDefaultAsync(s => s.IdSolicitud == idSolicitud);
        }

        public async Task<List<TipoSolicitud>> GetTiposActivosAsync()
        {
            return await _context.TiposSolicitud
                .Where(t => t.Activo)
                .OrderBy(t => t.Nombre)
                .ToListAsync();
        }

        public async Task<TipoSolicitud?> GetTipoSolicitudAsync(int idTipoSolicitud)
        {
            return await _context.TiposSolicitud
                .FirstOrDefaultAsync(t => t.IdTipoSolicitud == idTipoSolicitud && t.Activo);
        }

        public async Task<string> GenerarFolioAsync(CategoriaSolicitud categoria)
        {
            var year = DateTime.Now.Year;
            var prefix = $"SOL-{year}-";

            var ultimoFolio = await _context.SolicitudesPersonal
                .OrderByDescending(s => s.IdSolicitud)
                .Select(s => s.Folio)
                .FirstOrDefaultAsync();

            int siguiente = 1;
            if (ultimoFolio is not null)
            {
                var parts = ultimoFolio.Split('-');
                if (int.TryParse(parts[^1], out var ultimo))
                    siguiente = ultimo + 1;
            }

            return $"{prefix}{siguiente:D5}";
        }
    }
}
