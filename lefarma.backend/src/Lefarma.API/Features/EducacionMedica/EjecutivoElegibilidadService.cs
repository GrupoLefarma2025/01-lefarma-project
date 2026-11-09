using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

public class EjecutivoElegibilidadService : IEjecutivoElegibilidadService
{
    private readonly ApplicationDbContext _context;

    public EjecutivoElegibilidadService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> EsEjecutivoPrimarioAsync(
        int idUsuario,
        int? idRegionCatalogo,
        int? idTipoGerencia,
        CancellationToken ct = default)
    {
        var query = _context.EjecutivosRegion
            .AsNoTracking()
            .Include(e => e.Region)
            .Where(e => e.Activo && e.IdUsuario == idUsuario);

        if (idRegionCatalogo.HasValue)
        {
            query = query.Where(e => e.IdRegionCatalogo == idRegionCatalogo.Value);
            if (idTipoGerencia.HasValue)
            {
                query = query.Where(e =>
                    e.Region != null && e.Region.IdTipoGerencia == idTipoGerencia.Value);
            }
        }
        else if (idTipoGerencia.HasValue)
        {
            query = query.Where(e =>
                e.Region != null && e.Region.IdTipoGerencia == idTipoGerencia.Value);
        }

        return await query.AnyAsync(ct);
    }

    public async Task<bool> EsEjecutivoSuplenteAsync(
        int idUsuario,
        int? idRegionCatalogo,
        int? idTipoGerencia,
        CancellationToken ct = default)
    {
        var query = _context.EjecutivosSuplentes
            .AsNoTracking()
            .Where(e => e.Activo && e.IdUsuario == idUsuario);

        if (idRegionCatalogo.HasValue)
        {
            query = query.Where(e =>
                e.IdRegionCatalogo == null || e.IdRegionCatalogo == idRegionCatalogo.Value);
        }

        if (idTipoGerencia.HasValue)
        {
            query = query.Where(e =>
                e.IdTipoGerencia == null || e.IdTipoGerencia == idTipoGerencia.Value);
        }

        return await query.AnyAsync(ct);
    }

    public async Task<int?> BuscarSuplenteAsync(
        int? idRegionCatalogo,
        int? idTipoGerencia,
        CancellationToken ct = default)
    {
        var query = _context.EjecutivosSuplentes
            .AsNoTracking()
            .Where(e => e.Activo);

        if (idRegionCatalogo.HasValue)
        {
            query = query.Where(e =>
                e.IdRegionCatalogo == null || e.IdRegionCatalogo == idRegionCatalogo.Value);
        }

        if (idTipoGerencia.HasValue)
        {
            query = query.Where(e =>
                e.IdTipoGerencia == null || e.IdTipoGerencia == idTipoGerencia.Value);
        }

        var candidatos = await query
            .Select(e => new
            {
                e.IdUsuario,
                e.IdRegionCatalogo,
                e.IdTipoGerencia,
            })
            .ToListAsync(ct);

        return candidatos
            .OrderBy(e => idRegionCatalogo.HasValue
                ? e.IdRegionCatalogo == idRegionCatalogo.Value ? 0 : 1
                : 0)
            .ThenBy(e => idTipoGerencia.HasValue
                ? e.IdTipoGerencia == idTipoGerencia.Value ? 0 : 1
                : 0)
            .ThenBy(e => e.IdUsuario)
            .Select(e => (int?)e.IdUsuario)
            .FirstOrDefault();
    }
}
