using System.Text.Json;
using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
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
            .OrderBy(m => m.IdEjecutivo)
            .ThenBy(m => m.IdEquipo)
            .ToListAsync(ct);

        var resumenTalleres = await _context.Talleres.AsNoTracking()
            .Where(t => t.IdMatrizGeneral == idMatrizGeneral && t.IdMatrizIndividual != null && t.Activo)
            .Select(t => new
            {
                IdMatrizIndividual = t.IdMatrizIndividual!.Value,
                t.IdEspecialista,
                t.Region,
            })
            .ToListAsync(ct);
        var datosPorIndividual = resumenTalleres
            .GroupBy(t => t.IdMatrizIndividual)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    Total = g.Count(),
                    IdEspecialista = g.Select(t => t.IdEspecialista).FirstOrDefault(i => i.HasValue),
                    Region = g.Select(t => t.Region).FirstOrDefault(r => !string.IsNullOrWhiteSpace(r)),
                });

        var idsEjecutivos = individuales
            .Select(m => m.IdEjecutivo ?? m.Equipo?.IdEjecutivo)
            .Where(i => i.HasValue)
            .Select(i => i!.Value)
            .Distinct()
            .ToList();
        var idsUsuarios = idsEjecutivos
            .Concat(datosPorIndividual.Values
                .Select(d => d.IdEspecialista)
                .Where(i => i.HasValue)
                .Select(i => i!.Value))
            .Concat(individuales
                .Select(m => m.Equipo?.IdEspecialista)
                .Where(i => i.HasValue)
                .Select(i => i!.Value))
            .Distinct()
            .ToList();

        var nombresUsuarios = idsUsuarios.Count > 0
            ? await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => idsUsuarios.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct)
            : new Dictionary<int, string>();

        var regionesPorEjecutivo = new Dictionary<int, string?>();
        if (idsEjecutivos.Count > 0)
        {
            var asignaciones = await _context.EjecutivosRegion.AsNoTracking()
                .Include(e => e.Region)
                .Where(e => e.Activo && idsEjecutivos.Contains(e.IdUsuario) && e.Region != null)
                .ToListAsync(ct);
            regionesPorEjecutivo = asignaciones
                .GroupBy(e => e.IdUsuario)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(e => e.Region?.Nombre).FirstOrDefault());
        }

        return individuales
            .Select(m =>
            {
                var datos = datosPorIndividual.GetValueOrDefault(m.IdMatrizIndividual);
                var idEjecutivo = m.IdEjecutivo ?? m.Equipo?.IdEjecutivo;
                var idEspecialista = datos?.IdEspecialista ?? m.Equipo?.IdEspecialista;

                return new ConcentracionEquipoDto
                {
                    IdMatrizIndividual = m.IdMatrizIndividual,
                    IdEquipo = m.IdEquipo ?? 0,
                    NombreRegion = m.Equipo?.Region?.Nombre
                        ?? (idEjecutivo.HasValue
                            ? regionesPorEjecutivo.GetValueOrDefault(idEjecutivo.Value)
                            : null)
                        ?? datos?.Region,
                    IdEjecutivo = idEjecutivo,
                    NombreEjecutivo = idEjecutivo.HasValue
                        ? nombresUsuarios.GetValueOrDefault(idEjecutivo.Value)
                        : null,
                    IdEspecialista = idEspecialista,
                    NombreEspecialista = idEspecialista.HasValue
                        ? nombresUsuarios.GetValueOrDefault(idEspecialista.Value)
                        : null,
                    TotalTalleres = datos?.Total ?? 0,
                };
            })
            .ToList();
    }

    public async Task<MatrizRevisionDto> GetRevisionAsync(int idMatrizGeneral, int? idRutaVersion, CancellationToken ct = default)
    {
        var matriz = await ObtenerMatrizAsync(idMatrizGeneral, ct)
            ?? throw new InvalidOperationException($"La matriz general {idMatrizGeneral} no existe.");

        var seleccion = await _context.SeleccionesMensuales.AsNoTracking()
            .Where(s => s.Activo
                && s.IdTipoGerencia == matriz.IdTipoGerencia
                && ((s.FechaInicioVigencia.HasValue
                        && s.FechaInicioVigencia.Value.Year == matriz.Periodo.Year
                        && s.FechaInicioVigencia.Value.Month == matriz.Periodo.Month)
                    || (!s.FechaInicioVigencia.HasValue
                        && s.FechaSeleccion.Year == matriz.Periodo.Year
                        && s.FechaSeleccion.Month == matriz.Periodo.Month)))
            .OrderByDescending(s => s.FechaSeleccion)
            .FirstOrDefaultAsync(ct);

        RutaVersion? version;
        var idVersionResuelta = idRutaVersion ?? matriz.IdRutaVersion;
        if (idVersionResuelta.HasValue)
        {
            version = await _context.RutasVersiones.AsNoTracking()
                .FirstOrDefaultAsync(v => v.IdRutaVersion == idVersionResuelta.Value, ct)
                ?? throw new InvalidOperationException($"La versión de rutas {idVersionResuelta} no existe.");

            if (version.IdTipoGerencia.HasValue
                && version.IdTipoGerencia.Value != matriz.IdTipoGerencia)
            {
                throw new InvalidOperationException(
                    "La versión de rutas indicada no pertenece a la gerencia de la matriz.");
            }

            var seleccionVersion = await _context.SeleccionesMensuales.AsNoTracking()
                .FirstOrDefaultAsync(s => s.IdSeleccionMensual == version.IdSeleccionMensual, ct)
                ?? throw new InvalidOperationException(
                    "La versión de rutas no tiene una selección mensual válida.");

            if (seleccionVersion.IdTipoGerencia != matriz.IdTipoGerencia)
            {
                throw new InvalidOperationException(
                    "La versión de rutas indicada no pertenece a la gerencia de la matriz.");
            }

            var mesVersion = seleccionVersion.FechaInicioVigencia
                ?? seleccionVersion.FechaSeleccion;
            if (mesVersion.Year != matriz.Periodo.Year
                || mesVersion.Month != matriz.Periodo.Month)
            {
                throw new InvalidOperationException(
                    "La versión de rutas indicada no pertenece al mes completo de la matriz.");
            }
        }
        else if (seleccion is not null)
        {
            version = await _context.RutasVersiones.AsNoTracking()
                .Where(v => v.IdSeleccionMensual == seleccion.IdSeleccionMensual
                    && v.Estado != RutaVersion.EstadoArchivada
                    && v.Estado != RutaVersion.EstadoCancelada
                    && v.Estado != RutaVersion.EstadoRechazada)
                .OrderByDescending(v => v.Version)
                .FirstOrDefaultAsync(ct);
        }
        else
        {
            version = null;
        }

        var visitas = new List<RutaVisita>();
        var estadoRutaPorVisita = new Dictionary<int, string>();
        if (version is not null)
        {
            var filas = await (
                from v in _context.RutasVisitas.AsNoTracking()
                join r in _context.Rutas.AsNoTracking() on v.IdRuta equals r.IdRuta
                where r.IdRutaVersion == version.IdRutaVersion
                    && r.Estado != Ruta.EstadoArchivada
                    && r.Estado != Ruta.EstadoCancelada
                    && r.Estado != Ruta.EstadoRechazada
                select new { Visita = v, EstadoRuta = r.Estado })
                .ToListAsync(ct);

            visitas = filas.Select(f => f.Visita).ToList();
            estadoRutaPorVisita = filas.ToDictionary(f => f.Visita.IdRutaVisita, f => f.EstadoRuta);
        }

        var talleres = await _context.Talleres.AsNoTracking()
            .Include(t => t.Recursos)
            .Where(t => t.IdMatrizGeneral == idMatrizGeneral && t.Activo)
            .ToListAsync(ct);

        var tallerPorVisita = talleres
            .Where(t => t.IdRutaVisita.HasValue)
            .GroupBy(t => t.IdRutaVisita!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var visitasSinTaller = visitas
            .Where(v => !tallerPorVisita.ContainsKey(v.IdRutaVisita))
            .ToList();
        var visitasConTaller = visitas.Count - visitasSinTaller.Count;

        var idsVisitasActivas = visitas.Select(v => v.IdRutaVisita).ToHashSet();
        var talleresFueraVersion = version is null
            ? 0
            : talleres.Count(t => t.IdRutaVisita.HasValue
                && !idsVisitasActivas.Contains(t.IdRutaVisita.Value));
        var talleresExtraordinarios = talleres.Count(t => !t.IdRutaVisita.HasValue);
        var talleresSinRecursos = talleres.Count(t => t.Recursos.Count == 0);
        var talleresSinCosto = talleres.Count(t => !t.Recursos.Any(r => r.CostoUnitario.HasValue));

        var idsTaller = talleres.Select(t => t.IdTaller).ToList();
        var solicitudesPendientes = idsTaller.Count == 0
            ? 0
            : await _context.TalleresSolicitudesCambio.AsNoTracking()
                .CountAsync(s => idsTaller.Contains(s.IdTaller)
                    && s.Estado == TallerSolicitudCambio.EstadoPendiente, ct);

        var capturaAbierta = false;
        if (matriz.IdWorkflow.HasValue && matriz.IdPasoActual.HasValue)
        {
            var paso = await _context.WorkflowPasos.AsNoTracking()
                .FirstOrDefaultAsync(
                    p => p.IdPaso == matriz.IdPasoActual.Value
                        && p.IdWorkflow == matriz.IdWorkflow.Value
                        && p.Activo,
                    ct);
            capturaAbierta = paso?.EsInicio == true;
        }

        var idsSeleccionHospital = visitas
            .Where(v => v.IdSeleccionHospital.HasValue)
            .Select(v => v.IdSeleccionHospital!.Value)
            .Distinct()
            .ToList();
        var seleccionHospitales = idsSeleccionHospital.Count == 0
            ? new Dictionary<int, SeleccionHospital>()
            : await _context.SeleccionesHospitales.AsNoTracking()
                .Where(h => idsSeleccionHospital.Contains(h.IdSeleccionHospital))
                .ToDictionaryAsync(h => h.IdSeleccionHospital, ct);

        var idsHospital = visitas
            .Select(v => v.IdHospital
                ?? (v.IdSeleccionHospital.HasValue
                    ? seleccionHospitales.GetValueOrDefault(v.IdSeleccionHospital.Value)?.IdHospital
                    : null))
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var nombresHospitales = idsHospital.Count == 0
            ? new Dictionary<int, string>()
            : await _asokamContext.Hospitales.AsNoTracking()
                .Where(h => idsHospital.Contains(h.CodigoContacto))
                .ToDictionaryAsync(
                    h => h.CodigoContacto,
                    h => h.NombreContacto ?? $"Hospital {h.CodigoContacto}",
                    ct);

        var idsUsuarios = visitas
            .SelectMany(v => new[] { v.IdEjecutivo, v.IdEspecialista })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var nombresUsuarios = idsUsuarios.Count == 0
            ? new Dictionary<int, string>()
            : await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => idsUsuarios.Contains(u.IdUsuario))
                .ToDictionaryAsync(
                    u => u.IdUsuario,
                    u => u.NombreCompleto ?? $"Usuario {u.IdUsuario}",
                    ct);

        var detalleVisitasSinTaller = visitasSinTaller
            .Select(v =>
            {
                var seleccionHospital = v.IdSeleccionHospital.HasValue
                    ? seleccionHospitales.GetValueOrDefault(v.IdSeleccionHospital.Value)
                    : null;
                var idHospital = v.IdHospital ?? seleccionHospital?.IdHospital;
                return new VisitaSinTallerDto
                {
                    IdRutaVisita = v.IdRutaVisita,
                    IdRuta = v.IdRuta,
                    IdHospital = idHospital,
                    Hospital = idHospital.HasValue
                        ? nombresHospitales.GetValueOrDefault(idHospital.Value)
                        : null,
                    Region = seleccionHospital?.Region,
                    FechaVisita = v.FechaVisita,
                    IdEjecutivo = v.IdEjecutivo,
                    NombreEjecutivo = v.IdEjecutivo.HasValue
                        ? nombresUsuarios.GetValueOrDefault(v.IdEjecutivo.Value)
                        : null,
                    IdEspecialista = v.IdEspecialista,
                    NombreEspecialista = v.IdEspecialista.HasValue
                        ? nombresUsuarios.GetValueOrDefault(v.IdEspecialista.Value)
                        : null,
                    EstadoRuta = estadoRutaPorVisita.GetValueOrDefault(v.IdRutaVisita),
                };
            })
            .OrderBy(v => v.FechaVisita)
            .ThenBy(v => v.IdRutaVisita)
            .ToList();

        var advertencias = new List<AdvertenciaMatrizDto>();
        if (seleccion is null)
        {
            advertencias.Add(new AdvertenciaMatrizDto
            {
                Codigo = "SIN_SELECCION",
                Severidad = "warning",
                Mensaje = "No hay selección mensual activa para la gerencia y periodo de la matriz; no se pudo comparar la cobertura.",
            });
        }
        else if (version is null)
        {
            advertencias.Add(new AdvertenciaMatrizDto
            {
                Codigo = "SIN_VERSION_RUTAS",
                Severidad = "warning",
                Mensaje = "La selección no tiene una versión de rutas activa; no se pudo comparar la cobertura.",
            });
        }

        if (talleresFueraVersion > 0)
        {
            advertencias.Add(new AdvertenciaMatrizDto
            {
                Codigo = "TALLERES_FUERA_VERSION",
                Severidad = "warning",
                Mensaje = $"Hay {talleresFueraVersion} taller(es) ligados a una versión de ruta que no es la activa.",
                Total = talleresFueraVersion,
            });
        }

        if (talleresSinRecursos > 0)
        {
            advertencias.Add(new AdvertenciaMatrizDto
            {
                Codigo = "TALLERES_SIN_RECURSOS",
                Severidad = "warning",
                Mensaje = $"Hay {talleresSinRecursos} taller(es) sin recursos/producto capturados.",
                Total = talleresSinRecursos,
            });
        }

        if (talleresSinCosto > 0)
        {
            advertencias.Add(new AdvertenciaMatrizDto
            {
                Codigo = "TALLERES_SIN_COSTO",
                Severidad = "warning",
                Mensaje = $"Hay {talleresSinCosto} taller(es) sin costo unitario; se validará antes de la firma del CA.",
                Total = talleresSinCosto,
            });
        }

        if (solicitudesPendientes > 0)
        {
            advertencias.Add(new AdvertenciaMatrizDto
            {
                Codigo = "SOLICITUDES_PENDIENTES",
                Severidad = "info",
                Mensaje = $"Hay {solicitudesPendientes} solicitud(es) de cambio pendientes.",
                Total = solicitudesPendientes,
            });
        }

        return new MatrizRevisionDto
        {
            IdMatrizGeneral = matriz.IdMatrizGeneral,
            IdTipoGerencia = matriz.IdTipoGerencia,
            Gerencia = matriz.TipoGerencia?.Descripcion,
            Periodo = matriz.Periodo,
            CapturaAbierta = capturaAbierta,
            IdSeleccionMensual = seleccion?.IdSeleccionMensual,
            IdRutaVersion = version?.IdRutaVersion,
            Version = version?.Version,
            EstadoRutaVersion = version?.Estado,
            TotalVisitas = visitas.Count,
            VisitasConTaller = visitasConTaller,
            VisitasSinTaller = visitasSinTaller.Count,
            TotalTalleres = talleres.Count,
            TalleresSinRecursos = talleresSinRecursos,
            TalleresSinCosto = talleresSinCosto,
            TalleresFueraVersionActiva = talleresFueraVersion,
            TalleresExtraordinarios = talleresExtraordinarios,
            SolicitudesPendientes = solicitudesPendientes,
            VisitasSinTallerDetalle = detalleVisitasSinTaller,
            Advertencias = advertencias,
        };
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
        var (nombresEstados, nombresProductos) = await EducacionMedicaNombres.ResolverParaTalleresAsync(
            _asokamContext, [taller], ct);
        var nombresTiposVisita = await CargarNombresTiposVisitaAsync(ct);
        return TallerDtoMapper.Armar(
            taller, nombresHospitales, nombresUsuarios, nombresProductos, nombresEstados,
            nombresTiposVisita);
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
        // avance (AUTORIZAR o CERRAR) progresa si hay talleres sin costos, aunque el paso del AEM
        // se elimine del admin.
        var pasosFirma = workflow.Pasos
            .Where(p => p.Activo && !p.EsInicio && !p.EsFinal && p.RequiereFirma)
            .OrderBy(p => p.Orden)
            .ToList();
        var esFirmaPosteriorALaPrimera = pasosFirma.Skip(1).Any(p => p.IdPaso == pasoActual.IdPaso);
        if ((codigoAccion == "AUTORIZAR" || codigoAccion == "CERRAR") && esFirmaPosteriorALaPrimera)
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

        // Cierre final (DC): los talleres de la matriz pasan automáticamente a Programado
        // (ADR-00008 revisión 2026-10-09) con historial de origen Automático.
        var pasoResultante = workflow.Pasos.FirstOrDefault(p => p.IdPaso == matriz.IdPasoActual);
        if (pasoResultante?.EsFinal == true && codigoAccion == "CERRAR")
        {
            var talleres = await _context.Talleres
                .Where(t => t.IdMatrizGeneral == idMatrizGeneral && t.Activo)
                .ToListAsync(ct);
            foreach (var taller in talleres)
            {
                if (taller.Estado is Taller.EstadoProgramado or Taller.EstadoEnCurso or Taller.EstadoRealizado or Taller.EstadoCancelado)
                {
                    continue;
                }

                var estadoAnterior = taller.Estado;
                taller.Estado = Taller.EstadoProgramado;
                taller.IdUsuarioModificacion = idUsuario;

                _context.TalleresEstadosHistorial.Add(new TallerEstadoHistorial
                {
                    IdTaller = taller.IdTaller,
                    EstadoAnterior = estadoAnterior,
                    EstadoNuevo = Taller.EstadoProgramado,
                    Origen = TallerEstadoHistorial.OrigenAutomatico,
                    IdUsuario = idUsuario,
                    Fecha = DateTime.Now,
                });
            }

            _logger.LogInformation(
                "Matriz general {IdMatrizGeneral} cerrada: {Total} taller(es) programados automáticamente.",
                idMatrizGeneral, talleres.Count);
        }

        await SincronizarPlaneacionConMatrizAsync(
            matriz, pasoResultante, codigoAccion, idUsuario, ct);

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Matriz general {IdMatrizGeneral}: acción {IdAccion} ({Codigo}) por usuario {IdUsuario} -> paso {IdPaso}.",
            idMatrizGeneral, request.IdAccion, codigoAccion, idUsuario, matriz.IdPasoActual);

        return await ArmarDetalleAsync(matriz, idUsuario, ct);
    }

    private async Task SincronizarPlaneacionConMatrizAsync(
        MatrizGeneral matriz,
        WorkflowPaso? pasoResultante,
        string codigoAccion,
        int idUsuario,
        CancellationToken ct)
    {
        var estadoVersion = pasoResultante?.EsInicio == true || codigoAccion == "DEVOLVER"
            ? RutaVersion.EstadoCreada
            : RutaVersion.EstadoCerrada;

        var idsVersiones = new HashSet<int>();
        if (matriz.IdRutaVersion.HasValue)
        {
            idsVersiones.Add(matriz.IdRutaVersion.Value);
        }

        var idsVinculadas = await (
            from t in _context.Talleres
            join v in _context.RutasVisitas on t.IdRutaVisita equals v.IdRutaVisita
            join r in _context.Rutas on v.IdRuta equals r.IdRuta
            where t.IdMatrizGeneral == matriz.IdMatrizGeneral
                && t.Activo
                && t.IdRutaVisita.HasValue
                && r.IdRutaVersion.HasValue
            select r.IdRutaVersion!.Value)
            .Distinct()
            .ToListAsync(ct);

        foreach (var id in idsVinculadas)
        {
            idsVersiones.Add(id);
        }

        if (idsVersiones.Count == 0)
        {
            return;
        }

        var versiones = await _context.RutasVersiones
            .Where(v => idsVersiones.Contains(v.IdRutaVersion))
            .ToListAsync(ct);

        var idsActualizadas = new HashSet<int>();
        foreach (var version in versiones)
        {
            if (version.Estado is RutaVersion.EstadoCancelada or RutaVersion.EstadoArchivada)
            {
                continue;
            }

            version.Estado = estadoVersion;
            version.FechaConfirmacion = estadoVersion == RutaVersion.EstadoCerrada
                ? (version.FechaConfirmacion ?? DateTime.UtcNow)
                : null;
            version.IdUsuarioModificacion = idUsuario;
            idsActualizadas.Add(version.IdRutaVersion);
        }

        if (idsActualizadas.Count == 0)
        {
            return;
        }

        var estadoRuta = estadoVersion == RutaVersion.EstadoCerrada
            ? Ruta.EstadoCerrada
            : Ruta.EstadoCreada;

        var rutas = await _context.Rutas
            .Where(r => r.IdRutaVersion.HasValue && idsActualizadas.Contains(r.IdRutaVersion.Value))
            .ToListAsync(ct);

        foreach (var ruta in rutas)
        {
            ruta.Estado = estadoRuta;
            ruta.FechaConfirmacion = estadoVersion == RutaVersion.EstadoCerrada
                ? (ruta.FechaConfirmacion ?? DateTime.UtcNow)
                : null;
            ruta.IdUsuarioModificacion = idUsuario;
        }

        _logger.LogInformation(
            "Matriz {IdMatrizGeneral}: planeación sincronizada a {Estado} en {Versiones} versión(es) y {Rutas} ruta(s).",
            matriz.IdMatrizGeneral, estadoVersion, idsActualizadas.Count, rutas.Count);
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
            AjustesPostCierre = detalle.AjustesPostCierre,
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

    private async Task<IReadOnlyDictionary<int, string>> CargarNombresTiposVisitaAsync(
        CancellationToken ct)
    {
        return await _context.TiposVisita.AsNoTracking()
            .Where(t => t.Activo)
            .ToDictionaryAsync(t => t.IdTipoVisita, t => t.Descripcion, ct);
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

        var versionRutas = matriz.IdRutaVersion.HasValue
            ? await _context.RutasVersiones.AsNoTracking()
                .Where(v => v.IdRutaVersion == matriz.IdRutaVersion.Value)
                .Select(v => new { v.Version, v.Estado })
                .FirstOrDefaultAsync(ct)
            : null;

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
            IdRutaVersion = matriz.IdRutaVersion,
            Version = versionRutas?.Version,
            EstadoRutaVersion = versionRutas?.Estado,
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
        var (nombresEstados, nombresProductos) = await EducacionMedicaNombres.ResolverParaTalleresAsync(
            _asokamContext, talleres, ct);

        var esEditable = false;
        var esFinal = false;
        if (matriz.IdWorkflow.HasValue && matriz.IdPasoActual.HasValue)
        {
            var paso = await _context.WorkflowPasos.AsNoTracking()
                .FirstOrDefaultAsync(
                    p => p.IdPaso == matriz.IdPasoActual.Value
                        && p.IdWorkflow == matriz.IdWorkflow.Value
                        && p.Activo,
                    ct);
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

        var solicitudesPendientes = await CargarSolicitudesPendientesAsync(talleres, ct);
        var nombresTiposVisita = await CargarNombresTiposVisitaAsync(ct);
        var talleresDto = talleres
            .Select(t =>
            {
                var dto = TallerDtoMapper.Armar(
                    t, nombresHospitales, nombresUsuarios, nombresProductos, nombresEstados,
                    nombresTiposVisita);
                dto.SolicitudCambioPendiente = solicitudesPendientes.GetValueOrDefault(t.IdTaller);
                return dto;
            })
            .ToList();

        var ajustesPostCierre = await CargarAjustesPostCierreAsync(
            matriz, talleres, nombresHospitales, ct);

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
            IdRutaVersion = resumen.IdRutaVersion,
            Version = resumen.Version,
            EstadoRutaVersion = resumen.EstadoRutaVersion,
            TotalTalleres = resumen.TotalTalleres,
            CostoTotal = resumen.CostoTotal,
            EsEditable = esEditable,
            EsFinal = esFinal,
            Talleres = talleresDto,
            Acciones = acciones,
            AjustesPostCierre = ajustesPostCierre,
        };
    }

    private async Task<List<MatrizAjustePostCierreDto>> CargarAjustesPostCierreAsync(
        MatrizGeneral matriz,
        IReadOnlyCollection<Taller> talleres,
        IReadOnlyDictionary<int, string> nombresHospitales,
        CancellationToken ct)
    {
        var idsTalleres = talleres.Select(t => t.IdTaller).ToList();
        var idsVisitas = talleres
            .Where(t => t.IdRutaVisita.HasValue)
            .Select(t => t.IdRutaVisita!.Value)
            .Distinct()
            .ToList();
        var idRutaVersion = matriz.IdRutaVersion;

        var ajustes = await _context.AjustesPostCierre.AsNoTracking()
            .Where(a =>
                (a.EntidadTipo == AjustePostCierre.EntidadTaller
                    && idsTalleres.Contains(a.IdEntidad))
                || (a.EntidadTipo == AjustePostCierre.EntidadRutaVisita
                    && idsVisitas.Contains(a.IdEntidad))
                || (a.EntidadTipo == AjustePostCierre.EntidadRutaVersion
                    && idRutaVersion.HasValue
                    && a.IdEntidad == idRutaVersion.Value))
            .OrderByDescending(a => a.FechaAjuste)
            .ToListAsync(ct);

        if (ajustes.Count == 0)
        {
            return [];
        }

        var idsUsuarios = ajustes.Select(a => a.IdUsuario).Distinct().ToList();
        var nombresUsuarios = await _asokamContext.Usuarios.AsNoTracking()
            .Where(u => idsUsuarios.Contains(u.IdUsuario))
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct);

        var tallerPorId = talleres.ToDictionary(t => t.IdTaller);
        var tallerPorVisita = talleres
            .Where(t => t.IdRutaVisita.HasValue)
            .GroupBy(t => t.IdRutaVisita!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        return ajustes.Select(a =>
        {
            var taller = a.EntidadTipo == AjustePostCierre.EntidadTaller
                ? tallerPorId.GetValueOrDefault(a.IdEntidad)
                : a.EntidadTipo == AjustePostCierre.EntidadRutaVisita
                    ? tallerPorVisita.GetValueOrDefault(a.IdEntidad)
                    : null;

            return new MatrizAjustePostCierreDto
            {
                IdAjuste = a.IdAjuste,
                EntidadTipo = a.EntidadTipo,
                IdEntidad = a.IdEntidad,
                IdTaller = taller?.IdTaller,
                Hospital = taller?.IdHospital.HasValue == true
                    ? nombresHospitales.GetValueOrDefault(taller.IdHospital.Value)
                    : null,
                Accion = a.Accion,
                ValoresAntes = a.ValoresAntes,
                ValoresDespues = a.ValoresDespues,
                Motivo = a.Motivo,
                IdUsuario = a.IdUsuario,
                NombreUsuario = nombresUsuarios.GetValueOrDefault(a.IdUsuario),
                FechaAjuste = a.FechaAjuste,
            };
        }).ToList();
    }

    /// <summary>
    /// Solicitudes de cambio pendientes por taller (join para ordenar/destacar la Matriz
    /// General; ADR-00010 decisión 15 — sin consultar la tabla desde el listado).
    /// </summary>
    private async Task<Dictionary<int, TallerSolicitudCambioResumenDto>> CargarSolicitudesPendientesAsync(
        IEnumerable<Taller> talleres,
        CancellationToken ct)
    {
        var idsTalleres = talleres.Select(t => t.IdTaller).ToList();
        if (idsTalleres.Count == 0)
        {
            return [];
        }

        var pendientes = await _context.TalleresSolicitudesCambio.AsNoTracking()
            .Where(s => idsTalleres.Contains(s.IdTaller) && s.Estado == TallerSolicitudCambio.EstadoPendiente)
            .ToListAsync(ct);

        if (pendientes.Count == 0)
        {
            return [];
        }

        var idsSolicitantes = pendientes
            .Where(s => s.IdUsuarioCreacion.HasValue)
            .Select(s => s.IdUsuarioCreacion!.Value)
            .Distinct()
            .ToList();
        var nombres = idsSolicitantes.Count > 0
            ? await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => idsSolicitantes.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct)
            : new Dictionary<int, string>();

        return pendientes.ToDictionary(
            s => s.IdTaller,
            s => new TallerSolicitudCambioResumenDto
            {
                IdSolicitud = s.IdSolicitud,
                DatosJson = s.DatosJson,
                IdSolicitante = s.IdUsuarioCreacion,
                NombreSolicitante = s.IdUsuarioCreacion.HasValue
                    ? nombres.GetValueOrDefault(s.IdUsuarioCreacion.Value)
                    : null,
                Fecha = s.FechaCreacion,
            });
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
