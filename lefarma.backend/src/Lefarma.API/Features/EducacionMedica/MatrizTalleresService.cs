using ErrorOr;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.Profile;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.EducacionMedica;

public class MatrizTalleresService : IMatrizTalleresService
{
    private const string EstadoPasoCostos = "PREPARACION";

    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IWorkflowEngine _engine;
    private readonly IWorkflowQueryService _workflowQuery;
    private readonly IProfileService _profileService;
    private readonly IJefeInmediatoResolver _jefeInmediatoResolver;
    private readonly ILogger<MatrizTalleresService> _logger;

    public MatrizTalleresService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IWorkflowEngine engine,
        IWorkflowQueryService workflowQuery,
        IProfileService profileService,
        IJefeInmediatoResolver jefeInmediatoResolver,
        ILogger<MatrizTalleresService> logger)
    {
        _context = context;
        _asokamContext = asokamContext;
        _engine = engine;
        _workflowQuery = workflowQuery;
        _profileService = profileService;
        _jefeInmediatoResolver = jefeInmediatoResolver;
        _logger = logger;
    }

    public async Task<List<MatrizGeneralResumenDto>> GetMatricesAsync(int? idTipoGerencia, string? periodo, CancellationToken ct = default)
    {
        var query = _context.MatricesGenerales.AsNoTracking()
            .Include(m => m.TipoGerencia)
            .Include(m => m.EstadoWorkflow)
            .AsQueryable();

        if (idTipoGerencia.HasValue)
        {
            query = query.Where(m => m.IdTipoGerencia == idTipoGerencia.Value);
        }

        if (!string.IsNullOrWhiteSpace(periodo))
        {
            var periodoDate = ParsePeriodo(periodo);
            query = query.Where(m => m.Periodo == periodoDate);
        }

        var matrices = await query
            .OrderByDescending(m => m.Periodo)
            .ThenBy(m => m.IdTipoGerencia)
            .ToListAsync(ct);

        var resultado = new List<MatrizGeneralResumenDto>();
        foreach (var matriz in matrices)
        {
            resultado.Add(await ArmarResumenAsync(matriz, ct));
        }

        return resultado;
    }

    public async Task<MatrizTalleresDetalleDto> GetMatrizAsync(int idMatrizGeneral, int idUsuario, CancellationToken ct = default)
    {
        var matriz = await ObtenerMatrizAsync(idMatrizGeneral, ct)
            ?? throw new InvalidOperationException($"La matriz general {idMatrizGeneral} no existe.");

        return await ArmarDetalleAsync(matriz, idUsuario, ct);
    }

    public async Task<List<ConcentracionEquipoDto>> GetConcentracionAsync(int idMatrizGeneral, CancellationToken ct = default)
    {
        _ = await ObtenerMatrizAsync(idMatrizGeneral, ct)
            ?? throw new InvalidOperationException($"La matriz general {idMatrizGeneral} no existe.");

        // Matrices individuales con talleres en esta general (panel "Matrices por equipo")
        var idsIndividuales = await _context.Talleres.AsNoTracking()
            .Where(t => t.IdMatrizGeneral == idMatrizGeneral && t.IdMatrizIndividual != null && t.Activo)
            .Select(t => t.IdMatrizIndividual!.Value)
            .Distinct()
            .ToListAsync(ct);

        if (idsIndividuales.Count == 0)
        {
            return [];
        }

        var individuales = await _context.MatricesIndividuales.AsNoTracking()
            .Include(m => m.Equipo)
                .ThenInclude(e => e!.Region)
            .Where(m => idsIndividuales.Contains(m.IdMatrizIndividual))
            .OrderBy(m => m.IdEquipo)
            .ToListAsync(ct);

        var idsUsuarios = individuales
            .SelectMany(m => new[] { m.Equipo?.IdEjecutivo, m.Equipo?.IdEspecialista })
            .Where(i => i.HasValue)
            .Select(i => i!.Value)
            .Distinct()
            .ToList();

        var nombresUsuarios = idsUsuarios.Count > 0
            ? await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => idsUsuarios.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct)
            : new Dictionary<int, string>();

        var talleresPorIndividual = await _context.Talleres.AsNoTracking()
            .Where(t => t.IdMatrizGeneral == idMatrizGeneral && t.IdMatrizIndividual != null && t.Activo)
            .GroupBy(t => t.IdMatrizIndividual!.Value)
            .Select(g => new { IdMatrizIndividual = g.Key, Total = g.Count() })
            .ToDictionaryAsync(x => x.IdMatrizIndividual, x => x.Total, ct);

        return individuales
            .Select(m => new ConcentracionEquipoDto
            {
                IdMatrizIndividual = m.IdMatrizIndividual,
                IdEquipo = m.IdEquipo,
                NombreRegion = m.Equipo?.Region?.Nombre,
                IdEjecutivo = m.Equipo?.IdEjecutivo,
                NombreEjecutivo = m.Equipo is not null ? nombresUsuarios.GetValueOrDefault(m.Equipo.IdEjecutivo) : null,
                IdEspecialista = m.Equipo?.IdEspecialista,
                NombreEspecialista = m.Equipo is not null ? nombresUsuarios.GetValueOrDefault(m.Equipo.IdEspecialista) : null,
                Estado = m.Estado,
                FechaGeneracion = m.FechaGeneracion,
                TotalTalleres = talleresPorIndividual.GetValueOrDefault(m.IdMatrizIndividual),
            })
            .ToList();
    }

    public async Task<TallerDto> ActualizarCostosAsync(int idMatrizGeneral, int idTaller, ActualizarCostosTallerRequest request, int idUsuario, CancellationToken ct = default)
    {
        var matriz = await ObtenerMatrizAsync(idMatrizGeneral, ct)
            ?? throw new InvalidOperationException($"La matriz general {idMatrizGeneral} no existe.");

        var (workflow, pasoActual) = await ObtenerContextoWorkflowAsync(matriz, ct);

        // Solo en el paso de costos (PREPARACION) y solo su participante (AEM)
        var estadoPaso = await _context.WorkflowEstados.AsNoTracking()
            .FirstOrDefaultAsync(e => e.IdEstado == pasoActual.IdEstado, ct);
        if (estadoPaso?.Codigo != EstadoPasoCostos)
        {
            throw new InvalidOperationException(
                "Los costos solo se pueden capturar en el paso de registro de costos.");
        }

        var validacion = await WorkflowFirmaHelper.ValidarParticipanteAsync(
            pasoActual, workflow.IdWorkflow, idUsuario, matriz.IdUsuarioCreacion ?? 0,
            _asokamContext, _jefeInmediatoResolver);
        if (validacion.IsError)
        {
            throw new InvalidOperationException(validacion.FirstError.Description);
        }

        var taller = await _context.Talleres
            .Include(t => t.Recursos)
            .FirstOrDefaultAsync(t => t.IdTaller == idTaller && t.Activo, ct)
            ?? throw new InvalidOperationException($"El taller {idTaller} no existe.");

        if (taller.IdMatrizGeneral != idMatrizGeneral)
        {
            throw new InvalidOperationException("El taller no pertenece a esta matriz general.");
        }

        foreach (var recurso in request.Recursos)
        {
            if (!TallerRecurso.TiposValidos.Contains(recurso.TipoRecurso))
            {
                throw new InvalidOperationException(
                    $"Tipo de recurso desconocido: '{recurso.TipoRecurso}'. Use {string.Join(", ", TallerRecurso.TiposValidos)}.");
            }
        }

        _context.TalleresRecursos.RemoveRange(taller.Recursos);
        taller.Recursos.Clear();

        foreach (var recurso in request.Recursos)
        {
            taller.Recursos.Add(new TallerRecurso
            {
                TipoRecurso = recurso.TipoRecurso,
                IdProducto = recurso.IdProducto,
                Descripcion = recurso.Descripcion,
                TipoEnvio = recurso.TipoEnvio,
                Cantidad = recurso.Cantidad,
                CostoUnitario = recurso.CostoUnitario,
                Subtotal = recurso.Cantidad.HasValue && recurso.CostoUnitario.HasValue
                    ? recurso.Cantidad.Value * recurso.CostoUnitario.Value
                    : null,
                Observaciones = recurso.Observaciones,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario,
            });
        }

        taller.IdUsuarioModificacion = idUsuario;
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Costos del taller {IdTaller} (matriz {IdMatrizGeneral}) capturados por el usuario {IdUsuario}.",
            idTaller, idMatrizGeneral, idUsuario);

        var (nombresHospitales, nombresUsuarios) = await ResolverNombresAsync(
            [taller.IdHospital],
            [taller.IdEjecutivo, taller.IdEspecialista],
            ct);
        return TallerDtoMapper.Armar(taller, nombresHospitales, nombresUsuarios);
    }

    public async Task<MatrizTalleresDetalleDto> FirmarAsync(int idMatrizGeneral, FirmarWorkflowRequest request, int idUsuario, CancellationToken ct = default)
    {
        var matriz = await ObtenerMatrizAsync(idMatrizGeneral, ct)
            ?? throw new InvalidOperationException($"La matriz general {idMatrizGeneral} no existe.");

        if (matriz.IdWorkflow is null || matriz.IdPasoActual is null)
        {
            throw new InvalidOperationException("La matriz no está en un workflow activo.");
        }

        var (workflow, pasoActual) = await ObtenerContextoWorkflowAsync(matriz, ct);

        var accion = pasoActual.AccionesOrigen.FirstOrDefault(a => a.IdAccion == request.IdAccion && a.Activo)
            ?? throw new InvalidOperationException("La acción no está disponible en el paso actual.");

        var codigoAccion = accion.TipoAccion?.Codigo ?? string.Empty;

        // Firma digital obligatoria solo en los pasos de firma (el paso de costos del AEM no la pide)
        if (pasoActual.RequiereFirma)
        {
            var tieneFirma = await _profileService.HasFirmaAsync(idUsuario);
            if (tieneFirma.IsError || !tieneFirma.Value)
            {
                throw new InvalidOperationException(
                    "El usuario no tiene una firma digital registrada. Cárguela en Configuración > Perfil para continuar.");
            }
        }

        var validacion = await WorkflowFirmaHelper.ValidarParticipanteAsync(
            pasoActual, workflow.IdWorkflow, idUsuario, matriz.IdUsuarioCreacion ?? 0,
            _asokamContext, _jefeInmediatoResolver, codigoAccion);
        if (validacion.IsError)
        {
            throw new InvalidOperationException(validacion.FirstError.Description);
        }

        // Salvaguarda (Opción B): a partir de la SEGUNDA firma (CA en la cadena estándar), ningún
        // AUTORIZAR avanza si hay talleres sin costos, aunque el paso del AEM se elimine del admin.
        var pasosFirma = workflow.Pasos
            .Where(p => p.Activo && !p.EsInicio && !p.EsFinal && p.RequiereFirma)
            .OrderBy(p => p.Orden)
            .ToList();
        var esFirmaPosteriorALaPrimera = pasosFirma.Skip(1).Any(p => p.IdPaso == pasoActual.IdPaso);
        if (codigoAccion == "AUTORIZAR" && esFirmaPosteriorALaPrimera)
        {
            await ValidarCostosCapturadosAsync(idMatrizGeneral, ct);
        }

        var resultado = await _engine.EjecutarAccionAsync(new WorkflowContext(
            IdWorkflow: workflow.IdWorkflow,
            IdEntidad: matriz.IdMatrizGeneral,
            TipoEntidad: CodigoProceso.EDUCACION_MEDICA_MATRIZ,
            Entidad: matriz,
            IdAccion: request.IdAccion,
            IdUsuario: idUsuario,
            Orden: null!,
            Comentario: request.Comentario,
            DatosAdicionales: request.DatosAdicionales));
        if (!resultado.Exitoso)
        {
            throw new InvalidOperationException(resultado.Error ?? "Error en el motor de workflow.");
        }

        matriz.IdPasoActual = resultado.NuevoIdPaso ?? matriz.IdPasoActual;
        matriz.IdEstado = resultado.NuevoIdEstado ?? matriz.IdEstado;
        matriz.IdUsuarioModificacion = idUsuario;

        // Autorización final (DC): los talleres de la matriz pasan a Autorizado
        var pasoResultante = workflow.Pasos.FirstOrDefault(p => p.IdPaso == matriz.IdPasoActual);
        if (pasoResultante?.EsFinal == true && codigoAccion == "AUTORIZAR")
        {
            var talleres = await _context.Talleres
                .Where(t => t.IdMatrizGeneral == idMatrizGeneral && t.Activo)
                .ToListAsync(ct);
            foreach (var taller in talleres)
            {
                taller.Estado = Taller.EstadoAutorizado;
                taller.IdUsuarioModificacion = idUsuario;
            }
        }

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Matriz general {IdMatrizGeneral}: acción {IdAccion} ({Codigo}) por usuario {IdUsuario} -> paso {IdPaso}.",
            idMatrizGeneral, request.IdAccion, codigoAccion, idUsuario, matriz.IdPasoActual);

        return await ArmarDetalleAsync(matriz, idUsuario, ct);
    }

    public async Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(int idMatrizGeneral, int idUsuario, CancellationToken ct = default)
    {
        var matriz = await ObtenerMatrizAsync(idMatrizGeneral, ct);
        if (matriz is null)
        {
            return CommonErrors.NotFound("MatrizGeneral", idMatrizGeneral.ToString());
        }

        if (matriz.IdWorkflow is null || matriz.IdPasoActual is null)
        {
            return Array.Empty<AccionDisponibleResponse>();
        }

        return await _workflowQuery.GetAccionesDisponiblesAsync(
            matriz.IdWorkflow.Value,
            matriz.IdMatrizGeneral,
            matriz.IdPasoActual.Value,
            idUsuario,
            CodigoProceso.EDUCACION_MEDICA_MATRIZ,
            matriz,
            ct);
    }

    public async Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialAsync(int idMatrizGeneral, CancellationToken ct = default)
    {
        var matriz = await ObtenerMatrizAsync(idMatrizGeneral, ct);
        if (matriz is null)
        {
            return CommonErrors.NotFound("MatrizGeneral", idMatrizGeneral.ToString());
        }

        return await _workflowQuery.GetHistorialWorkflowAsync(idMatrizGeneral, CodigoProceso.EDUCACION_MEDICA_MATRIZ, ct);
    }

    public async Task<MatrizDocumentoDto> GetDocumentoAsync(int idMatrizGeneral, CancellationToken ct = default)
    {
        var matriz = await ObtenerMatrizAsync(idMatrizGeneral, ct)
            ?? throw new InvalidOperationException($"La matriz general {idMatrizGeneral} no existe.");

        var detalle = await ArmarDetalleAsync(matriz, idUsuario: 0, ct);

        // Firmas: eventos de avance de la bitácora (ENVIAR/AUTORIZAR), con nombre del firmante
        var eventos = await _context.WorkflowBitacoras.AsNoTracking()
            .Where(b => b.TipoEntidad == CodigoProceso.EDUCACION_MEDICA_MATRIZ && b.IdEntidad == idMatrizGeneral)
            .OrderBy(b => b.FechaEvento)
            .ToListAsync(ct);

        var idsPasos = eventos.Select(e => e.IdPaso).Distinct().ToList();
        var nombresPasos = await _context.WorkflowPasos.AsNoTracking()
            .Where(p => idsPasos.Contains(p.IdPaso))
            .ToDictionaryAsync(p => p.IdPaso, p => p.NombrePaso, ct);

        var idsAcciones = eventos.Select(e => e.IdAccion).Distinct().ToList();
        var codigosAccion = await _context.WorkflowAcciones.AsNoTracking()
            .Where(a => idsAcciones.Contains(a.IdAccion))
            .Select(a => new { a.IdAccion, Codigo = a.TipoAccion != null ? a.TipoAccion.Codigo : null })
            .ToDictionaryAsync(a => a.IdAccion, a => a.Codigo, ct);

        var idsFirmantes = eventos.Select(e => e.IdUsuario).Distinct().ToList();
        var nombresFirmantes = idsFirmantes.Count > 0
            ? await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => idsFirmantes.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct)
            : new Dictionary<int, string>();

        var firmas = eventos
            .Where(e => codigosAccion.GetValueOrDefault(e.IdAccion) is "ENVIAR" or "AUTORIZAR")
            .Select(e => new MatrizDocumentoFirmaDto
            {
                PasoNombre = nombresPasos.GetValueOrDefault(e.IdPaso),
                IdUsuario = e.IdUsuario,
                NombreUsuario = nombresFirmantes.GetValueOrDefault(e.IdUsuario),
                Comentario = e.Comentario,
                Fecha = e.FechaEvento,
            })
            .ToList();

        return new MatrizDocumentoDto
        {
            Titulo = $"Matriz de talleres {matriz.Periodo:MM/yyyy} – {matriz.TipoGerencia?.Descripcion ?? matriz.IdTipoGerencia.ToString()}",
            Gerencia = matriz.TipoGerencia?.Descripcion,
            Periodo = matriz.Periodo,
            PasoNombre = detalle.PasoNombre,
            EstadoNombre = detalle.EstadoNombre,
            Talleres = detalle.Talleres,
            CostoTotal = detalle.CostoTotal,
            Firmas = firmas,
        };
    }

    // ----- Helpers -----

    private async Task<MatrizGeneral?> ObtenerMatrizAsync(int idMatrizGeneral, CancellationToken ct)
    {
        return await _context.MatricesGenerales
            .Include(m => m.TipoGerencia)
            .Include(m => m.EstadoWorkflow)
            .FirstOrDefaultAsync(m => m.IdMatrizGeneral == idMatrizGeneral, ct);
    }

    private async Task<(Domain.Entities.Config.Workflow Workflow, Domain.Entities.Config.WorkflowPaso PasoActual)> ObtenerContextoWorkflowAsync(
        MatrizGeneral matriz, CancellationToken ct)
    {
        var workflow = await _context.Workflows
            .Include(w => w.Pasos)
                .ThenInclude(p => p.AccionesOrigen)
                    .ThenInclude(a => a.TipoAccion)
            .Include(w => w.Pasos)
                .ThenInclude(p => p.Participantes)
            .FirstOrDefaultAsync(w => w.IdWorkflow == matriz.IdWorkflow, ct)
            ?? throw new InvalidOperationException("No se encontró la configuración del workflow de la matriz.");

        var pasoActual = workflow.Pasos.FirstOrDefault(p => p.IdPaso == matriz.IdPasoActual && p.Activo)
            ?? throw new InvalidOperationException("La matriz no tiene un paso activo válido en el workflow.");

        return (workflow, pasoActual);
    }

    /// <summary>Salvaguarda Opción B: todos los talleres deben tener al menos un recurso con costo capturado.</summary>
    private async Task ValidarCostosCapturadosAsync(int idMatrizGeneral, CancellationToken ct)
    {
        var talleresSinCostos = await _context.Talleres.AsNoTracking()
            .Where(t => t.IdMatrizGeneral == idMatrizGeneral && t.Activo)
            .Where(t => !t.Recursos.Any(r => r.CostoUnitario != null))
            .CountAsync(ct);

        if (talleresSinCostos > 0)
        {
            throw new InvalidOperationException(
                $"No se puede firmar: {talleresSinCostos} taller(es) no tienen costos capturados (cada taller debe tener al menos un recurso con costo unitario).");
        }
    }

    private async Task<MatrizGeneralResumenDto> ArmarResumenAsync(MatrizGeneral matriz, CancellationToken ct)
    {
        var talleres = await _context.Talleres.AsNoTracking()
            .Include(t => t.Recursos)
            .Where(t => t.IdMatrizGeneral == matriz.IdMatrizGeneral && t.Activo)
            .ToListAsync(ct);

        string? pasoNombre = null;
        if (matriz.IdPasoActual.HasValue)
        {
            pasoNombre = await _context.WorkflowPasos.AsNoTracking()
                .Where(p => p.IdPaso == matriz.IdPasoActual.Value)
                .Select(p => p.NombrePaso)
                .FirstOrDefaultAsync(ct);
        }

        return new MatrizGeneralResumenDto
        {
            IdMatrizGeneral = matriz.IdMatrizGeneral,
            IdTipoGerencia = matriz.IdTipoGerencia,
            Gerencia = matriz.TipoGerencia?.Descripcion,
            Periodo = matriz.Periodo,
            IdWorkflow = matriz.IdWorkflow,
            IdPasoActual = matriz.IdPasoActual,
            PasoNombre = pasoNombre,
            IdEstado = matriz.IdEstado,
            EstadoNombre = matriz.EstadoWorkflow?.Nombre,
            EstadoColor = matriz.EstadoWorkflow?.ColorHex,
            TotalTalleres = talleres.Count,
            CostoTotal = talleres.Sum(t => t.Recursos.Sum(r => r.Subtotal ?? 0m)),
        };
    }

    private async Task<MatrizTalleresDetalleDto> ArmarDetalleAsync(MatrizGeneral matriz, int idUsuario, CancellationToken ct)
    {
        var resumen = await ArmarResumenAsync(matriz, ct);

        var talleres = await _context.Talleres.AsNoTracking()
            .Include(t => t.Recursos)
            .Where(t => t.IdMatrizGeneral == matriz.IdMatrizGeneral && t.Activo)
            .OrderBy(t => t.FechaTaller)
            .ThenBy(t => t.IdTaller)
            .ToListAsync(ct);

        var (nombresHospitales, nombresUsuarios) = await ResolverNombresAsync(
            talleres.Select(t => t.IdHospital),
            talleres.SelectMany(t => new[] { t.IdEjecutivo, t.IdEspecialista }),
            ct);

        var esEditable = false;
        var esFinal = false;
        if (matriz.IdPasoActual.HasValue)
        {
            var paso = await _context.WorkflowPasos.AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdPaso == matriz.IdPasoActual.Value, ct);
            esEditable = paso?.EsInicio == true;
            esFinal = paso?.EsFinal == true;
        }

        var acciones = new List<AccionDisponibleResponse>();
        if (idUsuario > 0 && matriz.IdWorkflow.HasValue && matriz.IdPasoActual.HasValue)
        {
            var resultadoAcciones = await _workflowQuery.GetAccionesDisponiblesAsync(
                matriz.IdWorkflow.Value,
                matriz.IdMatrizGeneral,
                matriz.IdPasoActual.Value,
                idUsuario,
                CodigoProceso.EDUCACION_MEDICA_MATRIZ,
                matriz,
                ct);
            if (!resultadoAcciones.IsError && resultadoAcciones.Value is not null)
            {
                acciones = resultadoAcciones.Value.ToList();
            }
        }

        return new MatrizTalleresDetalleDto
        {
            IdMatrizGeneral = resumen.IdMatrizGeneral,
            IdTipoGerencia = resumen.IdTipoGerencia,
            Gerencia = resumen.Gerencia,
            Periodo = resumen.Periodo,
            IdWorkflow = resumen.IdWorkflow,
            IdPasoActual = resumen.IdPasoActual,
            PasoNombre = resumen.PasoNombre,
            IdEstado = resumen.IdEstado,
            EstadoNombre = resumen.EstadoNombre,
            EstadoColor = resumen.EstadoColor,
            TotalTalleres = resumen.TotalTalleres,
            CostoTotal = resumen.CostoTotal,
            EsEditable = esEditable,
            EsFinal = esFinal,
            Talleres = talleres.Select(t => TallerDtoMapper.Armar(t, nombresHospitales, nombresUsuarios)).ToList(),
            Acciones = acciones,
        };
    }

    private async Task<(Dictionary<int, string> Hospitales, Dictionary<int, string> Usuarios)> ResolverNombresAsync(
        IEnumerable<int?> idsHospitales,
        IEnumerable<int?> idsUsuarios,
        CancellationToken ct)
    {
        var idsHosp = idsHospitales.Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();
        var idsUsr = idsUsuarios.Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();

        var nombresHospitales = idsHosp.Count > 0
            ? await _asokamContext.Hospitales.AsNoTracking()
                .Where(h => idsHosp.Contains(h.CodigoContacto))
                .ToDictionaryAsync(h => h.CodigoContacto, h => h.NombreContacto ?? $"Hospital {h.CodigoContacto}", ct)
            : new Dictionary<int, string>();

        var nombresUsuarios = idsUsr.Count > 0
            ? await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => idsUsr.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct)
            : new Dictionary<int, string>();

        return (nombresHospitales, nombresUsuarios);
    }

    private static DateOnly ParsePeriodo(string periodo)
    {
        var partes = periodo.Trim().Split('-');
        if (partes.Length != 2
            || !int.TryParse(partes[0], out var anio)
            || !int.TryParse(partes[1], out var mes)
            || mes is < 1 or > 12)
        {
            throw new InvalidOperationException("El periodo debe tener el formato YYYY-MM.");
        }

        return new DateOnly(anio, mes, 1);
    }
}
