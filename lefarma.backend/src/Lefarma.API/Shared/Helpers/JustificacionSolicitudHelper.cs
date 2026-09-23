using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Shared.Helpers;

public static class JustificacionSolicitudHelper
{
    public static async Task<Dictionary<int, HashSet<DateTime>>> ObtenerFechasDetalleAsync(
        ApplicationDbContext context,
        IEnumerable<int> idsSolicitudes,
        CancellationToken cancellationToken)
    {
        var ids = idsSolicitudes.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<int, HashSet<DateTime>>();

        var detalles = await context.SolicitudesPersonalDetalle
            .AsNoTracking()
            .Where(d => ids.Contains(d.IdSolicitud))
            .Select(d => new { d.IdSolicitud, d.Fecha })
            .ToListAsync(cancellationToken);

        return detalles
            .GroupBy(d => d.IdSolicitud)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Fecha.Date).ToHashSet());
    }

    // Si la solicitud tiene detalle de fechas (justificantes de incidencia), solo justifica
    // esos días; si no, cubre el rango inicio/fin (un solo día cuando no hay fecha fin).
    public static bool SolicitudCubreFecha(
        int idSolicitud,
        DateTime fechaInicio,
        DateTime? fechaFin,
        DateTime fecha,
        Dictionary<int, HashSet<DateTime>> fechasDetalle)
    {
        if (fechasDetalle.TryGetValue(idSolicitud, out var fechas) && fechas.Count > 0)
            return fechas.Contains(fecha);

        var fin = fechaFin?.Date ?? fechaInicio.Date;
        return fechaInicio.Date <= fecha && fecha <= fin;
    }
}
