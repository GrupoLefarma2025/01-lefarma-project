using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class RutaRepository : IRutaRepository
{
    private readonly ApplicationDbContext _context;

    public RutaRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<Ruta>> GetBySeleccionAsync(
        int idSeleccionMensual,
        int? version,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Rutas
            .AsNoTracking()
            .Where(r => r.IdSeleccionMensual == idSeleccionMensual);

        if (version.HasValue)
        {
            query = query.Where(r => r.Version == version.Value);
        }

        return await query
            .OrderBy(r => r.Version)
            .ThenBy(r => r.IdEquipo)
            .ToListAsync(cancellationToken);
    }

    public async Task<int?> GetVersionActualAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default)
    {
        return await _context.Rutas
            .AsNoTracking()
            .Where(r => r.IdSeleccionMensual == idSeleccionMensual)
            .OrderByDescending(r => r.Version)
            .Select(r => (int?)r.Version)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<List<Ruta>> GetConfirmadasPorEquiposAsync(
        IEnumerable<int> idsEquipos,
        CancellationToken cancellationToken = default)
    {
        var ids = idsEquipos.Distinct().ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        return await _context.Rutas
            .AsNoTracking()
            .Where(r => r.Estado == Ruta.EstadoConfirmada && ids.Contains(r.IdEquipo))
            .OrderBy(r => r.IdSeleccionMensual)
            .ThenBy(r => r.IdEquipo)
            .ToListAsync(cancellationToken);
    }

    public async Task<RutaVersion?> GetVersionAsync(
        int idSeleccionMensual,
        int version,
        CancellationToken cancellationToken = default)
    {
        return await _context.RutasVersiones
            .FirstOrDefaultAsync(v => v.IdSeleccionMensual == idSeleccionMensual && v.Version == version, cancellationToken);
    }

    public async Task<RutaVersion?> GetVersionByIdAsync(
        int idRutaVersion,
        CancellationToken cancellationToken = default)
    {
        return await _context.RutasVersiones
            .FirstOrDefaultAsync(v => v.IdRutaVersion == idRutaVersion, cancellationToken);
    }

    public async Task<RutaVersion?> GetVersionMaximaAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default)
    {
        return await _context.RutasVersiones
            .Where(v => v.IdSeleccionMensual == idSeleccionMensual)
            .OrderByDescending(v => v.Version)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<RutaVersion> CreateVersionAsync(
        RutaVersion version,
        CancellationToken cancellationToken = default)
    {
        version.FechaCreacion = DateTime.UtcNow;
        version.FechaModificacion = DateTime.UtcNow;

        _context.RutasVersiones.Add(version);
        await _context.SaveChangesAsync(cancellationToken);

        return version;
    }

    public async Task<RutaVersion> UpdateVersionAsync(
        RutaVersion version,
        CancellationToken cancellationToken = default)
    {
        version.FechaModificacion = DateTime.UtcNow;

        _context.RutasVersiones.Update(version);
        await _context.SaveChangesAsync(cancellationToken);

        return version;
    }

    public async Task<List<Ruta>> GetByEquipoAsync(
        int idEquipo,
        CancellationToken cancellationToken = default)
    {
        return await _context.Rutas
            .AsNoTracking()
            .Where(r => r.IdEquipo == idEquipo)
            .OrderBy(r => r.IdSeleccionMensual)
            .ThenBy(r => r.Version)
            .ToListAsync(cancellationToken);
    }

    public async Task<Ruta?> GetByIdAsync(
        int idRuta,
        CancellationToken cancellationToken = default)
    {
        return await _context.Rutas
            .FirstOrDefaultAsync(r => r.IdRuta == idRuta, cancellationToken);
    }

    public async Task<Ruta> CreateAsync(
        Ruta ruta,
        CancellationToken cancellationToken = default)
    {
        ruta.FechaCreacion = DateTime.UtcNow;
        ruta.FechaModificacion = DateTime.UtcNow;

        _context.Rutas.Add(ruta);
        await _context.SaveChangesAsync(cancellationToken);

        return ruta;
    }

    public async Task<Ruta> UpdateAsync(
        Ruta ruta,
        CancellationToken cancellationToken = default)
    {
        ruta.FechaModificacion = DateTime.UtcNow;

        _context.Rutas.Update(ruta);
        await _context.SaveChangesAsync(cancellationToken);

        return ruta;
    }

    public async Task<List<RutaVisita>> GetVisitasAsync(
        int idRuta,
        CancellationToken cancellationToken = default)
    {
        return await _context.RutasVisitas
            .Where(v => v.IdRuta == idRuta)
            .OrderBy(v => v.FechaVisita)
            .ThenBy(v => v.Orden)
            .ToListAsync(cancellationToken);
    }

    public async Task<RutaVisita?> GetVisitaByIdAsync(
        int idRutaVisita,
        CancellationToken cancellationToken = default)
    {
        return await _context.RutasVisitas
            .FirstOrDefaultAsync(v => v.IdRutaVisita == idRutaVisita, cancellationToken);
    }

    public async Task<RutaVisita> AddVisitaAsync(
        RutaVisita visita,
        CancellationToken cancellationToken = default)
    {
        visita.FechaCreacion = DateTime.UtcNow;
        visita.FechaModificacion = DateTime.UtcNow;

        _context.RutasVisitas.Add(visita);
        await _context.SaveChangesAsync(cancellationToken);

        return visita;
    }

    public async Task<RutaVisita> UpdateVisitaAsync(
        RutaVisita visita,
        CancellationToken cancellationToken = default)
    {
        visita.FechaModificacion = DateTime.UtcNow;

        _context.RutasVisitas.Update(visita);
        await _context.SaveChangesAsync(cancellationToken);

        return visita;
    }

    public async Task RemoveVisitaAsync(
        RutaVisita visita,
        CancellationToken cancellationToken = default)
    {
        _context.RutasVisitas.Remove(visita);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await _context.SaveChangesAsync(cancellationToken);
    }
}
