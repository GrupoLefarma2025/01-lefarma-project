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

    public async Task<Comprobante?> GetWithConceptosAsync(int idComprobante, CancellationToken ct = default)
        => await _context.Comprobantes
            .Include(c => c.Conceptos)
            .FirstOrDefaultAsync(c => c.IdComprobante == idComprobante, ct);

    public async Task<bool> UuidExisteAsync(string uuid, CancellationToken ct = default)
        => await _context.Comprobantes.AnyAsync(c => c.UuidCfdi == uuid, ct);

    public async Task<IEnumerable<ComprobantePartida>> GetAsignacionesByPartidaAsync(int idPartida, CancellationToken ct = default)
        => await _context.ComprobantesPartidas
            .Include(cp => cp.Comprobante)
            .Include(cp => cp.Concepto)
            .Where(cp => cp.IdPartida == idPartida)
            .OrderByDescending(cp => cp.FechaAsignacion)
            .ToListAsync(ct);
}
