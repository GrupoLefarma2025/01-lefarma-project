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

    // Regla de negocio: un empleado con Checa = "No" (vwEmpleados) nunca tiene
    // incidencias. El filtro vive aquí para cubrir a todos los consumidores:
    // listados, dashboard, calendario, notificaciones y validaciones.
    // Se conserva el histórico de empleados que ya no están en vwEmpleados.
    public IQueryable<IncidenciasChecado> GetQueryable() =>
        from i in _asistenciasContext.IncidenciasChecados.AsNoTracking()
        where !_asistenciasContext.VwEmpleados.Any(e => e.Nomina == i.Nomina && e.Checa == "No")
        select i;

    public Task<bool> EmpleadoTieneChecaDeshabilitadaAsync(long nomina, CancellationToken cancellationToken = default) =>
        _asistenciasContext.VwEmpleados
            .AsNoTracking()
            .AnyAsync(e => e.Nomina == nomina && e.Checa == "No", cancellationToken);
}
