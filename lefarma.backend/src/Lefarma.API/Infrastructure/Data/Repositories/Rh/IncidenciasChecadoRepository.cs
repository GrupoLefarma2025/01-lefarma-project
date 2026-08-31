using Lefarma.API.Domain.Entities.Asistencias;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Rh;

public class IncidenciasChecadoRepository : IIncidenciasChecadoRepository
{
    private readonly AsistenciasDbContext _asistenciasContext;

    public IncidenciasChecadoRepository(AsistenciasDbContext asistenciasContext)
    {
        _asistenciasContext = asistenciasContext;
    }

    public IQueryable<IncidenciasChecado> GetQueryable() =>
        _asistenciasContext.IncidenciasChecados.AsNoTracking();
}
