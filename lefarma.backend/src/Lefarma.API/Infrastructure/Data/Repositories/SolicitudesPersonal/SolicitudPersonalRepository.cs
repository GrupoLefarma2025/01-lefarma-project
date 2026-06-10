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

        public async Task<TipoSolicitud?> GetTipoSolicitudAsync(int idTipoSolicitud)
        {
            return await _context.TiposSolicitud.FindAsync(idTipoSolicitud);
        }

        public async Task<string> GenerarFolioAsync(CategoriaSolicitud categoria)
        {
            var prefijo = categoria switch
            {
                CategoriaSolicitud.Incidencia => "INC",
                CategoriaSolicitud.Permiso => "PER",
                CategoriaSolicitud.Vacaciones => "VAC",
                CategoriaSolicitud.GoceDeSueldo => "GDS",
                _ => "SOL"
            };

            var year = DateTime.UtcNow.Year;
            var prefix = $"{prefijo}-{year}-";

            var ultimoFolio = await _context.SolicitudesPersonal
                .Where(s => s.Folio.StartsWith(prefix))
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
