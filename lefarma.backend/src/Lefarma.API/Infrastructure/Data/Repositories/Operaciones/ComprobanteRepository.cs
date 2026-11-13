using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Operaciones;

public class ComprobanteRepository : BaseRepository<Comprobante>, IComprobanteRepository
{
    private readonly ApplicationDbContext _context;

    public ComprobanteRepository(ApplicationDbContext context) : base(context)
    {
        _context = context;
    }

    public async Task<Comprobante?> GetByIdConAsignacionesAsync(int idComprobante, CancellationToken ct = default)
        => await _context.Comprobantes
            .Include(c => c.Asignaciones)
            .FirstOrDefaultAsync(c => c.IdComprobante == idComprobante && (c.Activo ?? true), ct);

    public async Task<Comprobante?> GetActivoPorUuidAsync(string uuid, CancellationToken ct = default)
        => await _context.Comprobantes
            .Include(c => c.Asignaciones)
            .Where(c =>
                (c.Activo ?? true) && c.DatosAdicionales != null
                && EF.Functions.Like(c.DatosAdicionales, $"%\"uuid\":\"{uuid}\"%"))
            // Prioriza los que tienen asignaciones para no reemplazar un CFDI ya registrado.
            .OrderByDescending(c => c.Asignaciones.Any(a => a.Activo))
            .FirstOrDefaultAsync(ct);

    public async Task<IEnumerable<ComprobantePartida>> GetAsignacionesByPartidaAsync(int idPartida, CancellationToken ct = default)
        => await _context.ComprobantesPartidas
            .Include(cp => cp.Comprobante)
            .Where(cp => cp.IdPartida == idPartida && (cp.Comprobante!.Activo ?? true) && cp.Activo)
            .OrderByDescending(cp => cp.FechaAsignacion)
            .ToListAsync(ct);
}
