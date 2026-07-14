using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Rh.IncidenciasChecado;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Rh;

public class IncidenciasChecadoPlantillaRepository : IIncidenciasChecadoPlantillaRepository
{
    private readonly ApplicationDbContext _context;

    public IncidenciasChecadoPlantillaRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<IncidenciaChecadoPlantilla>> GetActivosAsync(CancellationToken cancellationToken = default)
    {
        return await _context.PlantillasIncidenciasChecado
            .AsNoTracking()
            .Where(p => p.Activo)
            .OrderBy(p => p.Codigo)
            .ThenBy(p => p.CodigoCanal)
            .ToListAsync(cancellationToken);
    }
}
