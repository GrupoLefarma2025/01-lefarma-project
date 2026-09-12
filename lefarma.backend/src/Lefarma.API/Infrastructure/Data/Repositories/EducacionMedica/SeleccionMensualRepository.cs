using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class SeleccionMensualRepository : ISeleccionMensualRepository
{
    private readonly ApplicationDbContext _context;

    public SeleccionMensualRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<SeleccionMensual>> GetAllAsync(
        int? anio,
        int? mes,
        CancellationToken cancellationToken = default)
    {
        var query = _context.SeleccionesMensuales.AsNoTracking().Where(s => s.Activo);

        if (anio.HasValue)
        {
            query = query.Where(s => s.FechaSeleccion.Year == anio.Value);
        }

        if (mes.HasValue)
        {
            query = query.Where(s => s.FechaSeleccion.Month == mes.Value);
        }

        return await query
            .OrderByDescending(s => s.FechaSeleccion)
            .ToListAsync(cancellationToken);
    }

    public async Task<SeleccionMensual?> GetByIdAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default)
    {
        return await _context.SeleccionesMensuales
            .FirstOrDefaultAsync(s => s.IdSeleccionMensual == idSeleccionMensual && s.Activo, cancellationToken);
    }

    public async Task<bool> ExisteSeleccionActivaAsync(
        DateOnly fechaInicioVigencia,
        DateOnly fechaFinVigencia,
        int? idTipoGerencia,
        CancellationToken cancellationToken = default)
    {
        return await _context.SeleccionesMensuales
            .AsNoTracking()
            .AnyAsync(s => s.Activo
                && s.Estado != SeleccionMensual.EstadoCerrada
                && (idTipoGerencia == null || s.IdTipoGerencia == idTipoGerencia)
                && s.FechaInicioVigencia <= fechaFinVigencia
                && s.FechaFinVigencia >= fechaInicioVigencia, cancellationToken);
    }

    public async Task<List<SeleccionMensual>> GetSeleccionesSolapadasAsync(
        int idSeleccionMensual,
        DateOnly fechaInicioVigencia,
        DateOnly fechaFinVigencia,
        int? idTipoGerencia,
        CancellationToken cancellationToken = default)
    {
        return await _context.SeleccionesMensuales
            .AsNoTracking()
            .Where(s => s.Activo
                && s.IdSeleccionMensual != idSeleccionMensual
                && s.Estado != SeleccionMensual.EstadoCerrada
                && (idTipoGerencia == null || s.IdTipoGerencia != idTipoGerencia)
                && s.FechaInicioVigencia.HasValue
                && s.FechaFinVigencia.HasValue
                && s.FechaInicioVigencia <= fechaFinVigencia
                && s.FechaFinVigencia >= fechaInicioVigencia)
            .OrderByDescending(s => s.FechaSeleccion)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<SeleccionHospital>> GetHospitalesDeSeleccionesAsync(
        IEnumerable<int> idsSeleccionMensual,
        CancellationToken cancellationToken = default)
    {
        var ids = idsSeleccionMensual.Distinct().ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        return await _context.SeleccionesHospitales
            .AsNoTracking()
            .Where(h => ids.Contains(h.IdSeleccionMensual))
            .OrderBy(h => h.IdSeleccionMensual)
            .ThenBy(h => h.IdSeleccionHospital)
            .ToListAsync(cancellationToken);
    }

    public async Task<SeleccionMensual> CreateAsync(
        SeleccionMensual seleccion,
        CancellationToken cancellationToken = default)
    {
        seleccion.Activo = true;
        seleccion.FechaCreacion = DateTime.UtcNow;
        seleccion.FechaModificacion = DateTime.UtcNow;

        _context.SeleccionesMensuales.Add(seleccion);
        await _context.SaveChangesAsync(cancellationToken);

        return seleccion;
    }

    public async Task<SeleccionMensual> UpdateAsync(
        SeleccionMensual seleccion,
        CancellationToken cancellationToken = default)
    {
        seleccion.FechaModificacion = DateTime.UtcNow;

        _context.SeleccionesMensuales.Update(seleccion);
        await _context.SaveChangesAsync(cancellationToken);

        return seleccion;
    }

    public async Task<List<SeleccionHospital>> GetHospitalesAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default)
    {
        return await _context.SeleccionesHospitales
            .Where(h => h.IdSeleccionMensual == idSeleccionMensual)
            .OrderBy(h => h.IdSeleccionHospital)
            .ToListAsync(cancellationToken);
    }

    public async Task<SeleccionHospital?> GetHospitalByIdAsync(
        int idSeleccionHospital,
        CancellationToken cancellationToken = default)
    {
        return await _context.SeleccionesHospitales
            .FirstOrDefaultAsync(h => h.IdSeleccionHospital == idSeleccionHospital, cancellationToken);
    }

    public async Task<SeleccionHospital> AddHospitalAsync(
        SeleccionHospital hospital,
        CancellationToken cancellationToken = default)
    {
        hospital.FechaCreacion = DateTime.UtcNow;
        hospital.FechaModificacion = DateTime.UtcNow;

        _context.SeleccionesHospitales.Add(hospital);
        await _context.SaveChangesAsync(cancellationToken);

        return hospital;
    }

    public async Task RemoveHospitalAsync(
        SeleccionHospital hospital,
        CancellationToken cancellationToken = default)
    {
        _context.SeleccionesHospitales.Remove(hospital);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<SeleccionRegion>> GetRegionesAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default)
    {
        return await _context.SeleccionesRegiones
            .Where(r => r.IdSeleccionMensual == idSeleccionMensual)
            .OrderBy(r => r.IdRegion)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<SeleccionRegion>> GetRegionesPorEquiposAsync(
        IEnumerable<int> idsEquipos,
        CancellationToken cancellationToken = default)
    {
        var ids = idsEquipos.Distinct().ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        return await _context.SeleccionesRegiones
            .AsNoTracking()
            .Where(r => r.IdEquipo != null && ids.Contains(r.IdEquipo.Value))
            .OrderBy(r => r.IdRegion)
            .ToListAsync(cancellationToken);
    }

    public async Task<SeleccionRegion?> GetRegionByIdAsync(
        int idRegion,
        CancellationToken cancellationToken = default)
    {
        return await _context.SeleccionesRegiones
            .FirstOrDefaultAsync(r => r.IdRegion == idRegion, cancellationToken);
    }

    public async Task<SeleccionRegion> CreateRegionAsync(
        SeleccionRegion region,
        CancellationToken cancellationToken = default)
    {
        region.FechaCreacion = DateTime.UtcNow;
        region.FechaModificacion = DateTime.UtcNow;

        _context.SeleccionesRegiones.Add(region);
        await _context.SaveChangesAsync(cancellationToken);

        return region;
    }

    public async Task<SeleccionRegion> UpdateRegionAsync(
        SeleccionRegion region,
        CancellationToken cancellationToken = default)
    {
        region.FechaModificacion = DateTime.UtcNow;

        _context.SeleccionesRegiones.Update(region);
        await _context.SaveChangesAsync(cancellationToken);

        return region;
    }

    public async Task RemoveRegionAsync(
        SeleccionRegion region,
        CancellationToken cancellationToken = default)
    {
        _context.SeleccionesRegiones.Remove(region);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await _context.SaveChangesAsync(cancellationToken);
    }
}
