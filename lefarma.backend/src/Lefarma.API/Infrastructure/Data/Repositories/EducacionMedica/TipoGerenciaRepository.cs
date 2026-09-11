using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class TipoGerenciaRepository : ITipoGerenciaRepository
{
    private readonly ApplicationDbContext _context;

    public TipoGerenciaRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<TipoGerencia>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.TiposGerencia
            .AsNoTracking()
            .Where(t => t.Activo)
            .OrderBy(t => t.Descripcion)
            .ToListAsync(cancellationToken);
    }

    public async Task<TipoGerencia?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.TiposGerencia
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.IdTipoGerencia == id && t.Activo, cancellationToken);
    }
}
