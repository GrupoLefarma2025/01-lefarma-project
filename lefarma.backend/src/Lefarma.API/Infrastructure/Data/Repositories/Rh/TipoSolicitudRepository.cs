using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Rh.SolicitudesPersonal;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Rh
{
    public class TipoSolicitudRepository : ITipoSolicitudRepository
    {
        private readonly ApplicationDbContext _context;

        public TipoSolicitudRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<TipoSolicitud>> GetTiposActivosAsync()
        {
            return await _context.TiposSolicitud
                .Where(t => t.Activo)
                .OrderBy(t => t.Nombre)
                .ToListAsync();
        }

        public async Task<TipoSolicitud?> GetByIdAsync(int idTipoSolicitud)
        {
            return await _context.TiposSolicitud
                .FirstOrDefaultAsync(t => t.IdTipoSolicitud == idTipoSolicitud);
        }

        public async Task<IQueryable<TipoSolicitud>> GetQueryableAsync()
        {
            return await Task.FromResult(_context.TiposSolicitud.AsNoTracking().AsQueryable());
        }

        public async Task<bool> ExistePorClaveAsync(string clave, int? excluirId = null)
        {
            var query = _context.TiposSolicitud.Where(t => t.Clave == clave);
            if (excluirId.HasValue)
                query = query.Where(t => t.IdTipoSolicitud != excluirId.Value);
            return await query.AnyAsync();
        }

        public async Task<bool> TieneSolicitudesAsociadasAsync(int idTipoSolicitud)
        {
            return await _context.SolicitudesPersonal
                .AnyAsync(s => s.IdTipoSolicitud == idTipoSolicitud);
        }

        public async Task<int> ContarSolicitudesCerradasEnPeriodoAsync(
            int idUsuario,
            int idTipoSolicitud,
            DateTime fechaInicio,
            DateTime fechaFin,
            string estadoCerrado,
            int? excluirIdSolicitud = null)
        {
            var query = _context.SolicitudesPersonal
                .Where(s => s.IdUsuarioCreador == idUsuario
                    && s.IdTipoSolicitud == idTipoSolicitud
                    && s.FechaCreacion >= fechaInicio
                    && s.FechaCreacion <= fechaFin
                    && s.Estado != null
                    && s.Estado.Codigo == estadoCerrado);

            if (excluirIdSolicitud.HasValue)
                query = query.Where(s => s.IdSolicitud != excluirIdSolicitud.Value);

            return await query.CountAsync();
        }

        public async Task<TipoSolicitud> AddAsync(TipoSolicitud tipo)
        {
            await _context.TiposSolicitud.AddAsync(tipo);
            await _context.SaveChangesAsync();
            return tipo;
        }

        public async Task UpdateAsync(TipoSolicitud tipo)
        {
            _context.TiposSolicitud.Update(tipo);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(TipoSolicitud tipo)
        {
            _context.TiposSolicitud.Remove(tipo);
            await _context.SaveChangesAsync();
        }
    }
}
