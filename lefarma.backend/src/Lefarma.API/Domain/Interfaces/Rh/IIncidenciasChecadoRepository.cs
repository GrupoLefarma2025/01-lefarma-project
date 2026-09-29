using Lefarma.API.Domain.Entities.Asistencias;

namespace Lefarma.API.Domain.Interfaces.Rh;

public interface IIncidenciasChecadoRepository
{
    /// <summary>
    /// Incidencias visibles de checado. Excluye a los empleados con el checado
    /// deshabilitado (vwEmpleados.Checa = "No"): esos empleados nunca generan
    /// incidencias y no deben aparecer en listados, dashboard ni notificaciones.
    /// </summary>
    IQueryable<IncidenciasChecado> GetQueryable();

    /// <summary>Indica si la nómina corresponde a un empleado con Checa = "No".</summary>
    Task<bool> EmpleadoTieneChecaDeshabilitadaAsync(long nomina, CancellationToken cancellationToken = default);
}
