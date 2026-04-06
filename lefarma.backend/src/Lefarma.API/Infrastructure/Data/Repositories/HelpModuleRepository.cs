using Lefarma.API.Domain.Entities.Help;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories;
public class HelpModuleRepository : IHelpModuleRepository
{
    private readonly ApplicationDbContext _context;

    public HelpModuleRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<HelpModule>> GetAllAsync(CancellationToken ct)
    {
        return await _context.HelpModules
            .AsNoTracking()
            .Where(m => m.Activo)
            .OrderBy(m => m.Orden)
            .ToListAsync(ct);
    }

    public async Task<HelpModule?> GetByIdAsync(int id, CancellationToken ct)
    {
        return await _context.HelpModules
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == id, ct);
    }

    public async Task<HelpModule?> GetByNombreAsync(string nombre, CancellationToken ct)
    {
        return await _context.HelpModules
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Nombre == nombre, ct);
    }

    public async Task<HelpModule> CreateAsync(HelpModule module, CancellationToken ct)
    {
        module.FechaCreacion = DateTime.UtcNow;
        module.FechaActualizacion = DateTime.UtcNow;

        _context.HelpModules.Add(module);
        await _context.SaveChangesAsync(ct);
        return module;
    }

    public async Task<HelpModule> UpdateAsync(HelpModule module, CancellationToken ct)
    {
        module.FechaActualizacion = DateTime.UtcNow;

        _context.HelpModules.Update(module);
        await _context.SaveChangesAsync(ct);
        return module;
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var module = await _context.HelpModules
            .Include(m => m.Articulos)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        if (module == null)
            throw new InvalidOperationException($"Módulo con ID {id} no encontrado");

        _context.HelpModules.Remove(module);
        await _context.SaveChangesAsync(ct);
    }
}
