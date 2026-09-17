using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

public interface IAprobacionesService
{
    /// <summary>
    /// Documentos de la Bandeja de Autorizaciones (selecciones y versiones de rutas).
    /// <paramref name="filtro"/>: "pendientes" (default; pasos de firma donde el usuario participa),
    /// "mios" (creados por el usuario) o "todos" (sin filtro de usuario).
    /// </summary>
    Task<List<PendienteAprobacionDto>> GetDocumentosAsync(
        int idUsuario,
        string? filtro = null,
        CancellationToken ct = default);
}

public class AprobacionesService : IAprobacionesService
{
    public const string FiltroPendientes = "pendientes";
    public const string FiltroMios = "mios";
    public const string FiltroTodos = "todos";

    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IWorkflowQueryService _workflowQuery;

    public AprobacionesService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IWorkflowQueryService workflowQuery)
    {
        _context = context;
        _asokamContext = asokamContext;
        _workflowQuery = workflowQuery;
    }

    public async Task<List<PendienteAprobacionDto>> GetDocumentosAsync(
        int idUsuario,
        string? filtro = null,
        CancellationToken ct = default)
    {
        var filtroNormalizado = (filtro ?? FiltroPendientes).Trim().ToLowerInvariant();
        if (filtroNormalizado is not (FiltroPendientes or FiltroMios or FiltroTodos))
        {
            filtroNormalizado = FiltroPendientes;
        }

        // Pasos activos de todos los workflows; se usan para resolver el nombre del paso
        // actual (cualquier documento) y para el subconjunto "de firma" (filtro pendientes).
        var pasos = await _context.WorkflowPasos.AsNoTracking()
            .Where(p => p.Activo)
            .Select(p => new { p.IdPaso, p.NombrePaso, p.EsInicio, p.EsFinal })
            .ToListAsync(ct);

        var pasosPorId = pasos.ToDictionary(p => p.IdPaso);
        var idsPasosFirma = pasos
            .Where(p => !p.EsInicio && !p.EsFinal)
            .Select(p => p.IdPaso)
            .ToHashSet();

        var documentos = new List<PendienteAprobacionDto>();

        // ----- Selecciones mensuales -----
        var querySelecciones = _context.SeleccionesMensuales.AsNoTracking()
            .Include(s => s.EstadoWorkflow)
            .Where(s => s.Activo);

        if (filtroNormalizado == FiltroPendientes)
        {
            querySelecciones = querySelecciones.Where(s =>
                s.IdWorkflow != null
                && s.IdPasoActual != null
                && idsPasosFirma.Contains(s.IdPasoActual.Value));
        }
        else if (filtroNormalizado == FiltroMios)
        {
            querySelecciones = querySelecciones.Where(s => s.IdUsuarioCreacion == idUsuario);
        }

        foreach (var seleccion in await querySelecciones.ToListAsync(ct))
        {
            var acciones = await ObtenerAccionesAsync(
                seleccion.IdWorkflow,
                seleccion.IdSeleccionMensual,
                seleccion.IdPasoActual,
                idUsuario,
                CodigoProceso.EDUCACION_MEDICA_SELECCION,
                seleccion,
                ct);

            if (filtroNormalizado == FiltroPendientes && acciones.Count == 0)
            {
                continue;
            }

            var paso = seleccion.IdPasoActual is not null
                && pasosPorId.TryGetValue(seleccion.IdPasoActual.Value, out var pasoSel)
                    ? pasoSel
                    : null;
            documentos.Add(new PendienteAprobacionDto
            {
                Tipo = "seleccion",
                IdEntidad = seleccion.IdSeleccionMensual,
                IdSeleccionMensual = seleccion.IdSeleccionMensual,
                IdWorkflow = seleccion.IdWorkflow,
                IdPasoActual = seleccion.IdPasoActual,
                Documento = $"Selección mensual {seleccion.FechaSeleccion:MM/yyyy}",
                Detalle = seleccion.FechaInicioVigencia is not null && seleccion.FechaFinVigencia is not null
                    ? $"Vigencia {seleccion.FechaInicioVigencia:dd/MM/yyyy} – {seleccion.FechaFinVigencia:dd/MM/yyyy}"
                    : null,
                IdUsuarioCreador = seleccion.IdUsuarioCreacion,
                PasoNombre = paso?.NombrePaso,
                Estado = seleccion.Estado,
                IdEstado = seleccion.IdEstado,
                EstadoNombre = seleccion.EstadoWorkflow?.Nombre,
                EstadoColor = seleccion.EstadoWorkflow?.ColorHex,
                Fecha = seleccion.FechaCreacion,
                Acciones = acciones,
            });
        }

        // ----- Versiones de rutas -----
        var queryVersiones = _context.RutasVersiones.AsNoTracking()
            .Include(v => v.EstadoWorkflow)
            .AsQueryable();

        if (filtroNormalizado == FiltroPendientes)
        {
            queryVersiones = queryVersiones.Where(v =>
                v.IdWorkflow != null
                && v.IdPasoActual != null
                && idsPasosFirma.Contains(v.IdPasoActual.Value));
        }
        else if (filtroNormalizado == FiltroMios)
        {
            queryVersiones = queryVersiones.Where(v => v.IdUsuarioCreacion == idUsuario);
        }

        foreach (var version in await queryVersiones.ToListAsync(ct))
        {
            var acciones = await ObtenerAccionesAsync(
                version.IdWorkflow,
                version.IdRutaVersion,
                version.IdPasoActual,
                idUsuario,
                CodigoProceso.EDUCACION_MEDICA_RUTAS,
                version,
                ct);

            if (filtroNormalizado == FiltroPendientes && acciones.Count == 0)
            {
                continue;
            }

            var paso = version.IdPasoActual is not null
                && pasosPorId.TryGetValue(version.IdPasoActual.Value, out var pasoVer)
                    ? pasoVer
                    : null;
            documentos.Add(new PendienteAprobacionDto
            {
                Tipo = "rutas",
                IdEntidad = version.IdRutaVersion,
                IdSeleccionMensual = version.IdSeleccionMensual,
                IdWorkflow = version.IdWorkflow,
                IdPasoActual = version.IdPasoActual,
                Documento = $"Rutas v{version.Version}",
                Detalle = $"Selección #{version.IdSeleccionMensual}",
                IdUsuarioCreador = version.IdUsuarioCreacion,
                PasoNombre = paso?.NombrePaso,
                Estado = version.Estado,
                IdEstado = version.IdEstado,
                EstadoNombre = version.EstadoWorkflow?.Nombre,
                EstadoColor = version.EstadoWorkflow?.ColorHex,
                Fecha = version.FechaCreacion,
                VersionRutas = version.Version,
                Acciones = acciones,
            });
        }

        await ResolverNombresCreadoresAsync(documentos, ct);

        return documentos
            .OrderByDescending(d => d.Fecha)
            .ThenBy(d => d.Tipo)
            .ToList();
    }

    private async Task ResolverNombresCreadoresAsync(List<PendienteAprobacionDto> documentos, CancellationToken ct)
    {
        var idsCreadores = documentos
            .Where(d => d.IdUsuarioCreador.HasValue)
            .Select(d => d.IdUsuarioCreador!.Value)
            .Distinct()
            .ToList();

        if (idsCreadores.Count == 0)
        {
            return;
        }

        var nombres = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => idsCreadores.Contains(u.IdUsuario))
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct);

        foreach (var documento in documentos)
        {
            if (documento.IdUsuarioCreador.HasValue
                && nombres.TryGetValue(documento.IdUsuarioCreador.Value, out var nombre))
            {
                documento.NombreUsuarioCreador = nombre;
            }
        }
    }

    private async Task<List<Config.Workflows.DTOs.AccionDisponibleResponse>> ObtenerAccionesAsync(
        int? idWorkflow,
        int idEntidad,
        int? idPasoActual,
        int idUsuario,
        string tipoEntidad,
        Domain.Interfaces.Config.IWorkflowEntity entidad,
        CancellationToken ct)
    {
        if (idWorkflow is null || idPasoActual is null)
        {
            return [];
        }

        var resultado = await _workflowQuery.GetAccionesDisponiblesAsync(
            idWorkflow.Value,
            idEntidad,
            idPasoActual.Value,
            idUsuario,
            tipoEntidad,
            entidad,
            ct);

        return resultado.IsError || resultado.Value is null
            ? []
            : resultado.Value.ToList();
    }
}
