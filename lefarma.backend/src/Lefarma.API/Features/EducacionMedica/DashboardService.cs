using System.Globalization;
using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface IDashboardService
{
    Task<DashboardResumenDto> GetResumenAsync(
        int idUsuario,
        string? periodo,
        bool incluirTalleres,
        bool incluirVisitas,
        CancellationToken ct = default);
}

/// <summary>
/// Agrega las fuentes del dashboard (ADR-00012, Fase 2) en una sola llamada.
/// Los permisos se resuelven en el controller (claims) y aqui solo se consultan
/// las fuentes permitidas; los servicios subyacentes ya filtran por usuario.
/// </summary>
public class DashboardService : IDashboardService
{
    private readonly ITalleresService _talleres;
    private readonly IRutasService _rutas;
    private readonly IAprobacionesService _aprobaciones;
    private readonly IMatrizTalleresService _matrices;

    public DashboardService(
        ITalleresService talleres,
        IRutasService rutas,
        IAprobacionesService aprobaciones,
        IMatrizTalleresService matrices)
    {
        _talleres = talleres;
        _rutas = rutas;
        _aprobaciones = aprobaciones;
        _matrices = matrices;
    }

    public async Task<DashboardResumenDto> GetResumenAsync(
        int idUsuario,
        string? periodo,
        bool incluirTalleres,
        bool incluirVisitas,
        CancellationToken ct = default)
    {
        var periodoNormalizado = NormalizarPeriodo(periodo);

        var resumen = new DashboardResumenDto
        {
            Periodo = periodoNormalizado,
            Pendientes = await _aprobaciones.GetDocumentosAsync(
                idUsuario, AprobacionesService.FiltroPendientes, ct),
        };

        if (incluirVisitas)
        {
            resumen.Asignaciones = await _rutas.GetAsignacionesAsync(idUsuario, ct: ct);
        }

        if (!incluirTalleres)
        {
            return resumen;
        }

        resumen.MisTalleres = await _talleres.GetMisTalleresAsync(idUsuario, periodoNormalizado, ct);
        resumen.Matrices = await _matrices.GetMatricesAsync(null, periodoNormalizado, ct);

        var talleres = new List<TallerDto>();
        foreach (var matriz in resumen.Matrices)
        {
            var detalle = await _matrices.GetMatrizAsync(matriz.IdMatrizGeneral, idUsuario, ct);
            talleres.AddRange(detalle.Talleres);
        }

        resumen.TalleresPeriodo = talleres;
        resumen.Solicitudes = talleres
            .Where(t => t.SolicitudCambioPendiente is not null)
            .ToList();

        return resumen;
    }

    private static string NormalizarPeriodo(string? periodo)
    {
        if (!string.IsNullOrWhiteSpace(periodo)
            && DateOnly.TryParseExact(
                $"{periodo.Trim()}-01",
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var fecha))
        {
            return fecha.ToString("yyyy-MM", CultureInfo.InvariantCulture);
        }

        return DateTime.UtcNow.ToString("yyyy-MM", CultureInfo.InvariantCulture);
    }
}
