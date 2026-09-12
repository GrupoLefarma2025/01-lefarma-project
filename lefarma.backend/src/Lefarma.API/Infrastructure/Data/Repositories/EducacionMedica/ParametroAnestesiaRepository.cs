using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class ParametroAnestesiaRepository : IParametroAnestesiaRepository
{
    private readonly ApplicationDbContext _context;

    public ParametroAnestesiaRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ParametroAnestesia>> GetByAnioAsync(
        int anio,
        CancellationToken cancellationToken = default)
    {
        return await _context.ParametrosAnestesia
            .AsNoTracking()
            .Where(p => p.Anio == anio && p.Activo)
            .OrderBy(p => p.Orden)
            .ThenBy(p => p.Clave)
            .ToListAsync(cancellationToken);
    }

    public async Task<ParametroAnestesia?> GetByAnioYClaveAsync(
        int anio,
        string clave,
        CancellationToken cancellationToken = default)
    {
        return await _context.ParametrosAnestesia
            .AsNoTracking()
            .FirstOrDefaultAsync(
                p => p.Anio == anio && p.Clave == clave && p.Activo,
                cancellationToken);
    }

    public async Task<int> GetUltimoAnioAsync(CancellationToken cancellationToken = default)
    {
        var ultimo = await _context.ParametrosAnestesia
            .AsNoTracking()
            .Where(p => p.Activo)
            .MaxAsync(p => (int?)p.Anio, cancellationToken);

        return ultimo ?? DateTime.UtcNow.Year;
    }

    public async Task<bool> ExisteAnioAsync(int anio, CancellationToken cancellationToken = default)
    {
        return await _context.ParametrosAnestesia
            .AsNoTracking()
            .AnyAsync(p => p.Anio == anio && p.Activo, cancellationToken);
    }

    public async Task AddRangeAsync(
        IEnumerable<ParametroAnestesia> parametros,
        CancellationToken cancellationToken = default)
    {
        var ahora = DateTime.UtcNow;
        foreach (var p in parametros)
        {
            p.Activo = true;
            p.FechaCreacion = ahora;
            p.FechaModificacion = ahora;
        }

        _context.ParametrosAnestesia.AddRange(parametros);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(
        ParametroAnestesia parametro,
        CancellationToken cancellationToken = default)
    {
        parametro.FechaModificacion = DateTime.UtcNow;
        _context.ParametrosAnestesia.Update(parametro);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteByAnioAsync(int anio, CancellationToken cancellationToken = default)
    {
        var parametros = await _context.ParametrosAnestesia
            .Where(p => p.Anio == anio && p.Activo)
            .ToListAsync(cancellationToken);

        foreach (var p in parametros)
        {
            p.Activo = false;
            p.FechaModificacion = DateTime.UtcNow;
        }

        _context.ParametrosAnestesia.UpdateRange(parametros);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
