using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class EquipoPareoRepository : IEquipoPareoRepository
{
    private readonly ApplicationDbContext _context;

    public EquipoPareoRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<EquipoPareo>> GetAllAsync(
        EquipoPareoFiltro? filtro,
        CancellationToken cancellationToken = default)
    {
        filtro ??= new EquipoPareoFiltro();

        var query = _context.EquiposPareo.AsNoTracking();

        if (filtro.SoloVigentes == true)
        {
            query = query.Where(e => e.Activo);
        }
        else if (filtro.SoloVigentes == false)
        {
            query = query.Where(e => !e.Activo);
        }

        if (filtro.IdUsuario.HasValue)
        {
            var idUsuario = filtro.IdUsuario.Value;
            query = query.Where(e => e.IdEjecutivo == idUsuario || e.IdEspecialista == idUsuario);
        }

        if (filtro.FechaInicio.HasValue)
        {
            var desde = filtro.FechaInicio.Value;
            query = query.Where(e => e.FechaFin == null || e.FechaFin >= desde);
        }

        if (filtro.FechaFin.HasValue)
        {
            var hasta = filtro.FechaFin.Value;
            query = query.Where(e => e.FechaInicio <= hasta);
        }

        return await query
            .OrderByDescending(e => e.Activo)
            .ThenByDescending(e => e.FechaInicio)
            .ToListAsync(cancellationToken);
    }

    public async Task<EquipoPareo?> GetByIdAsync(
        int idEquipo,
        CancellationToken cancellationToken = default)
    {
        return await _context.EquiposPareo
            .FirstOrDefaultAsync(e => e.IdEquipo == idEquipo, cancellationToken);
    }

    public async Task<bool> ExisteActivoConIntegranteAsync(
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        return await _context.EquiposPareo
            .AsNoTracking()
            .AnyAsync(e => e.Activo && (e.IdEjecutivo == idUsuario || e.IdEspecialista == idUsuario), cancellationToken);
    }

    public async Task<bool> ExisteActivoConRegionAsync(
        int idRegion,
        int? excluirIdEquipo,
        CancellationToken cancellationToken = default)
    {
        return await _context.EquiposPareo
            .AsNoTracking()
            .AnyAsync(e => e.Activo
                && e.IdRegion == idRegion
                && (!excluirIdEquipo.HasValue || e.IdEquipo != excluirIdEquipo.Value), cancellationToken);
    }

    public async Task<EquipoPareo> CreateAsync(
        EquipoPareo equipo,
        CancellationToken cancellationToken = default)
    {
        equipo.Activo = true;
        equipo.FechaCreacion = DateTime.UtcNow;
        equipo.FechaModificacion = DateTime.UtcNow;

        _context.EquiposPareo.Add(equipo);
        await _context.SaveChangesAsync(cancellationToken);

        return equipo;
    }

    public async Task<EquipoPareo> UpdateAsync(
        EquipoPareo equipo,
        CancellationToken cancellationToken = default)
    {
        equipo.FechaModificacion = DateTime.UtcNow;

        _context.EquiposPareo.Update(equipo);
        await _context.SaveChangesAsync(cancellationToken);

        return equipo;
    }
}
