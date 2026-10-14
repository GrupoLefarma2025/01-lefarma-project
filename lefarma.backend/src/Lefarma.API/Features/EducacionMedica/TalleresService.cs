using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace Lefarma.API.Features.EducacionMedica;

public class TalleresService : ITalleresService
{
    private const int DiasLimiteCambioDefault = 45;
    private const string RolCem = "Coordinador de Educación Médica";

    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IWorkflowResolver _workflowResolver;
    private readonly IJefeInmediatoResolver _jefeInmediatoResolver;
    private readonly INotificationService _notificationService;
    private readonly UserPermissionService _permissionService;
    private readonly ILogger<TalleresService> _logger;

    public TalleresService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IWorkflowResolver workflowResolver,
        IJefeInmediatoResolver jefeInmediatoResolver,
        INotificationService notificationService,
        UserPermissionService permissionService,
        ILogger<TalleresService> logger)
    {
        _context = context;
        _asokamContext = asokamContext;
        _workflowResolver = workflowResolver;
        _jefeInmediatoResolver = jefeInmediatoResolver;
        _notificationService = notificationService;
        _permissionService = permissionService;
        _logger = logger;
    }

    public async Task<MisTalleresResponse> GetMisTalleresAsync(int idUsuario, string? periodo, CancellationToken ct = default)
    {
        var periodoDate = ParsePeriodo(periodo);
        var equipo = await ObtenerEquipoDelUsuarioAsync(idUsuario, ct);

        var response = new MisTalleresResponse
        {
            IdEquipo = equipo?.IdEquipo,
            NombreRegion = equipo?.Region?.Nombre,
            Periodo = periodoDate,
        };

        if (equipo is null)
        {
            return response;
        }

        var matriz = await _context.MatricesIndividuales.AsNoTracking()
            .FirstOrDefaultAsync(m => m.IdEquipo == equipo.IdEquipo && m.Periodo == periodoDate, ct);

        var talleres = matriz is null
            ? []
            : await _context.Talleres.AsNoTracking()
                .Include(t => t.Recursos)
                .Where(t => t.IdMatrizIndividual == matriz.IdMatrizIndividual && t.Activo)
                .OrderBy(t => t.FechaTaller)
                .ThenBy(t => t.IdTaller)
                .ToListAsync(ct);

        var (nombresHospitales, nombresUsuarios) = await ResolverNombresAsync(
            talleres.Select(t => t.IdHospital),
            [equipo.IdEjecutivo, equipo.IdEspecialista],
            ct);
        var (nombresEstados, nombresProductos) = await EducacionMedicaNombres.ResolverParaTalleresAsync(
            _asokamContext, talleres, ct);
        var solicitudesPendientes = await CargarSolicitudesPendientesAsync(talleres, ct);

        response.NombreEjecutivo = nombresUsuarios.GetValueOrDefault(equipo.IdEjecutivo);
        response.NombreEspecialista = nombresUsuarios.GetValueOrDefault(equipo.IdEspecialista);
        response.Matriz = matriz is null
            ? null
            : ArmarMatrizIndividualDto(matriz, equipo, talleres.Count, nombresUsuarios);
        response.Talleres = talleres
            .Select(t =>
            {
                var dto = TallerDtoMapper.Armar(t, nombresHospitales, nombresUsuarios, nombresProductos, nombresEstados);
                dto.SolicitudCambioPendiente = solicitudesPendientes.GetValueOrDefault(t.IdTaller);
                return dto;
            })
            .ToList();

        // Estado real del flujo: la matriz general (GV → AEM → CA → DC) es la entidad del workflow.
        var idMatrizGeneral = talleres
            .Select(t => t.IdMatrizGeneral)
            .FirstOrDefault(id => id.HasValue);
        if (idMatrizGeneral.HasValue)
        {
            var general = await _context.MatricesGenerales.AsNoTracking()
                .Include(m => m.EstadoWorkflow)
                .FirstOrDefaultAsync(m => m.IdMatrizGeneral == idMatrizGeneral.Value, ct);
            if (general is not null)
            {
                response.EstadoMatrizGeneral = general.EstadoWorkflow?.Nombre;
                response.EstadoMatrizGeneralColor = general.EstadoWorkflow?.ColorHex;
                if (general.IdPasoActual.HasValue)
                {
                    response.PasoActualMatrizGeneral = await _context.WorkflowPasos.AsNoTracking()
                        .Where(p => p.IdPaso == general.IdPasoActual.Value)
                        .Select(p => p.NombrePaso)
                        .FirstOrDefaultAsync(ct);
                }
            }
        }

        return response;
    }

    public async Task<TallerDto> CrearAsync(CrearTallerRequest request, int idUsuario, CancellationToken ct = default)
    {
        if (request.EsExtraordinario)
        {
            return await CrearExtraordinarioAsync(request, idUsuario, ct);
        }

        var hospitalSeleccion = await _context.SeleccionesHospitales
            .FirstOrDefaultAsync(h => h.IdSeleccionHospital == request.IdSeleccionHospital, ct)
            ?? throw new InvalidOperationException($"El hospital de la selección {request.IdSeleccionHospital} no existe.");

        // Solo se capturan talleres de hospitales cuya ruta de visitas ya fue autorizada (cerrada).
        var tieneRutaAutorizada = await _context.RutasVisitas.AsNoTracking()
            .AnyAsync(v => v.IdSeleccionHospital == hospitalSeleccion.IdSeleccionHospital
                && _context.Rutas.Any(r => r.IdRuta == v.IdRuta && r.Estado == Ruta.EstadoCerrada), ct);
        if (!tieneRutaAutorizada)
        {
            throw new InvalidOperationException(
                "El hospital aún no tiene una ruta autorizada; el taller se captura cuando la ruta de visitas está cerrada.");
        }

        var seleccion = await _context.SeleccionesMensuales
            .FirstOrDefaultAsync(s => s.IdSeleccionMensual == hospitalSeleccion.IdSeleccionMensual && s.Activo, ct)
            ?? throw new InvalidOperationException("La selección mensual del hospital no existe.");

        if (seleccion.IdTipoGerencia is null)
        {
            throw new InvalidOperationException(
                "La selección no tiene tipo de gerencia configurado; no se puede determinar la matriz general.");
        }

        // El equipo del taller es el asignado a la región del hospital; la captura asistida
        // permite al CEM crearlo a nombre de ese equipo (ADR-00011).
        var equipo = await ObtenerEquipoDelHospitalAsync(hospitalSeleccion, ct)
            ?? throw new InvalidOperationException(
                "El hospital no tiene equipo asignado en la selección (la región no fue asignada en el paso Reparto).");

        if (request.IdEquipo.HasValue && request.IdEquipo.Value != equipo.IdEquipo)
        {
            throw new InvalidOperationException(
                "El hospital no pertenece a la selección del equipo indicado; elige un hospital de la lista de su selección.");
        }

        await ValidarCapturaDelUsuarioAsync(equipo, idUsuario, ct);

        var periodo = new DateOnly(seleccion.FechaSeleccion.Year, seleccion.FechaSeleccion.Month, 1);

        var matrizGeneral = await GetOrCreateMatrizGeneralAsync(seleccion.IdTipoGerencia.Value, periodo, idUsuario, ct);
        await ValidarMatrizGeneralEditableAsync(matrizGeneral, "capturar talleres", ct);

        var matrizIndividual = await GetOrCreateMatrizIndividualAsync(equipo.IdEquipo, periodo, idUsuario, ct);
        if (matrizIndividual.EsBloqueado)
        {
            throw new InvalidOperationException(
                "La matriz individual del equipo ya está bloqueada (generada). Pide al Gerente de Ventas que reabra la captura.");
        }

        var taller = new Taller
        {
            IdSeleccionHospital = hospitalSeleccion.IdSeleccionHospital,
            IdHospital = hospitalSeleccion.IdHospital,
            Region = hospitalSeleccion.Region,
            EntidadFederativa = hospitalSeleccion.EntidadFederativa,
            CiudadMunicipio = hospitalSeleccion.CiudadMunicipio,
            NumeroParticipantes = request.NumeroParticipantes,
            IdEjecutivo = equipo.IdEjecutivo,
            IdEspecialista = equipo.IdEspecialista,
            UnidadMedica = request.UnidadMedica,
            Lugar = request.Lugar,
            FechaTaller = request.FechaTaller,
            HoraTaller = request.HoraTaller,
            RequiereEquipoProyeccion = request.RequiereEquipoProyeccion,
            TipoEquipoProyeccion = request.TipoEquipoProyeccion,
            Estado = Taller.EstadoCreada,
            Observaciones = request.Observaciones,
            Activo = true,
            IdMatrizIndividual = matrizIndividual.IdMatrizIndividual,
            IdMatrizGeneral = matrizGeneral.IdMatrizGeneral,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        };

        ReemplazarRecursos(taller, request.Recursos, idUsuario);

        _context.Talleres.Add(taller);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Taller {IdTaller} capturado por el usuario {IdUsuario} (equipo {IdEquipo}, matriz general {IdMatrizGeneral}).",
            taller.IdTaller, idUsuario, equipo.IdEquipo, matrizGeneral.IdMatrizGeneral);

        return await ArmarTallerDtoConNombresAsync(taller, ct);
    }

    /// <summary>
    /// Taller extraordinario (ADR-00011): hospital del catálogo fuera de la selección, equipo
    /// explícito, motivo obligatorio; nace Programado con historial de origen Automático.
    /// </summary>
    private async Task<TallerDto> CrearExtraordinarioAsync(CrearTallerRequest request, int idUsuario, CancellationToken ct)
    {
        await ValidarPermisoAsync(
            idUsuario,
            Permissions.EducacionMedica.TalleresCapturarExtraordinarios,
            "No tienes permiso para capturar talleres extraordinarios (educacion_medica.talleres.puede_capturar_extraordinarios).");

        if (request.IdEquipo is not int idEquipo)
        {
            throw new InvalidOperationException("El taller extraordinario exige un equipo (idEquipo).");
        }

        if (request.IdHospital is not int idHospital)
        {
            throw new InvalidOperationException("El taller extraordinario exige un hospital del catálogo (idHospital).");
        }

        if (string.IsNullOrWhiteSpace(request.MotivoExtraordinario))
        {
            throw new InvalidOperationException("El motivo del taller extraordinario es obligatorio.");
        }

        if (request.FechaTaller is not DateOnly fechaTaller)
        {
            throw new InvalidOperationException("El taller extraordinario exige fecha (se usa para el mes y la matriz).");
        }

        var equipo = await _context.EquiposPareo.AsNoTracking()
            .Include(e => e.Region)
            .FirstOrDefaultAsync(e => e.IdEquipo == idEquipo && e.Activo, ct)
            ?? throw new InvalidOperationException($"El equipo {idEquipo} no existe o está inactivo.");

        if (equipo.Region?.IdTipoGerencia is not int idTipoGerencia)
        {
            throw new InvalidOperationException(
                "El equipo no tiene región/gerencia configurada; no se puede determinar la matriz general del extraordinario.");
        }

        var hospital = await _asokamContext.Hospitales.AsNoTracking()
            .FirstOrDefaultAsync(h => h.CodigoContacto == idHospital, ct)
            ?? throw new InvalidOperationException($"El hospital {idHospital} no existe en el catálogo.");

        var extension = await _context.HospitalesExtension.AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdHospital == idHospital, ct);

        string? nombreRegion = null;
        if (extension?.IdRegion is int idRegion)
        {
            nombreRegion = await _context.RegionesCat.AsNoTracking()
                .Where(r => r.IdRegion == idRegion)
                .Select(r => r.Nombre)
                .FirstOrDefaultAsync(ct);
        }

        var periodo = new DateOnly(fechaTaller.Year, fechaTaller.Month, 1);

        var matrizGeneral = await GetOrCreateMatrizGeneralAsync(idTipoGerencia, periodo, idUsuario, ct);
        var matrizIndividual = await GetOrCreateMatrizIndividualAsync(equipo.IdEquipo, periodo, idUsuario, ct);

        var taller = new Taller
        {
            IdSeleccionHospital = null,
            IdHospital = idHospital,
            Region = nombreRegion,
            EntidadFederativa = hospital.CodigoEstado,
            CiudadMunicipio = hospital.Ciudad,
            NumeroParticipantes = request.NumeroParticipantes,
            IdEjecutivo = equipo.IdEjecutivo,
            IdEspecialista = equipo.IdEspecialista,
            UnidadMedica = request.UnidadMedica ?? hospital.NombreContacto,
            Lugar = request.Lugar,
            FechaTaller = fechaTaller,
            HoraTaller = request.HoraTaller,
            RequiereEquipoProyeccion = request.RequiereEquipoProyeccion,
            TipoEquipoProyeccion = request.TipoEquipoProyeccion,
            Estado = Taller.EstadoProgramado,
            Observaciones = request.Observaciones,
            EsExtraordinario = true,
            MotivoExtraordinario = request.MotivoExtraordinario.Trim(),
            Activo = true,
            IdMatrizIndividual = matrizIndividual.IdMatrizIndividual,
            IdMatrizGeneral = matrizGeneral.IdMatrizGeneral,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        };

        ReemplazarRecursos(taller, request.Recursos, idUsuario);

        _context.Talleres.Add(taller);
        await _context.SaveChangesAsync(ct);

        _context.TalleresEstadosHistorial.Add(new TallerEstadoHistorial
        {
            IdTaller = taller.IdTaller,
            EstadoAnterior = null,
            EstadoNuevo = Taller.EstadoProgramado,
            Origen = TallerEstadoHistorial.OrigenAutomatico,
            Motivo = request.MotivoExtraordinario.Trim(),
            IdUsuario = idUsuario,
            Fecha = DateTime.Now,
        });
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Taller extraordinario {IdTaller} creado por el usuario {IdUsuario} (equipo {IdEquipo}, hospital {IdHospital}).",
            taller.IdTaller, idUsuario, equipo.IdEquipo, idHospital);

        return await ArmarTallerDtoConNombresAsync(taller, ct);
    }

    public async Task<TallerDto> ActualizarAsync(int idTaller, ActualizarTallerRequest request, int idUsuario, CancellationToken ct = default)
    {
        var taller = await _context.Talleres
            .Include(t => t.Recursos)
            .FirstOrDefaultAsync(t => t.IdTaller == idTaller && t.Activo, ct)
            ?? throw new InvalidOperationException($"El taller {idTaller} no existe.");

        // Ajuste post-cierre (ADR-00010): Autorizado/Programado con permiso + motivo.
        if (taller.Estado is Taller.EstadoAutorizado or Taller.EstadoProgramado)
        {
            return await AplicarAjusteAsync(taller, request, idUsuario, motivo: request.Motivo, ct);
        }

        if (taller.Estado is Taller.EstadoEnCurso or Taller.EstadoRealizado)
        {
            throw new InvalidOperationException(
                $"El taller está {taller.Estado}; no se ajusta (la operación la gobierna el ciclo de impartición, ADR-00008).");
        }

        await ValidarEdicionNormalAsync(taller, idUsuario, ct);

        taller.NumeroParticipantes = request.NumeroParticipantes;
        taller.UnidadMedica = request.UnidadMedica;
        taller.Lugar = request.Lugar;
        taller.FechaTaller = request.FechaTaller;
        taller.HoraTaller = request.HoraTaller;
        taller.RequiereEquipoProyeccion = request.RequiereEquipoProyeccion;
        taller.TipoEquipoProyeccion = request.TipoEquipoProyeccion;
        taller.Observaciones = request.Observaciones;
        taller.IdUsuarioModificacion = idUsuario;

        ReemplazarRecursos(taller, request.Recursos, idUsuario);

        await _context.SaveChangesAsync(ct);
        return await ArmarTallerDtoConNombresAsync(taller, ct);
    }

    /// <summary>
    /// Ajuste post-cierre del taller (ADR-00010): solo FechaTaller, HoraTaller, Lugar y
    /// NumeroParticipantes, con motivo obligatorio, límite temporal y sincronización de la
    /// visita de la ruta activa en la misma transacción.
    /// </summary>
    private async Task<TallerDto> AplicarAjusteAsync(
        Taller taller,
        ActualizarTallerRequest request,
        int idUsuario,
        string? motivo,
        CancellationToken ct)
    {
        await ValidarPermisoAsync(
            idUsuario,
            Permissions.EducacionMedica.TalleresAjustar,
            "No tienes permiso para ajustar talleres cerrados (educacion_medica.talleres.puede_ajustar).");

        if (string.IsNullOrWhiteSpace(motivo))
        {
            throw new InvalidOperationException("El motivo del ajuste post-cierre es obligatorio.");
        }

        if (taller.FechaTaller.HasValue)
        {
            await ValidarLimiteTemporalAsync(taller.FechaTaller.Value, ct);
        }

        var antes = new
        {
            fechaTaller = taller.FechaTaller,
            horaTaller = taller.HoraTaller,
            lugar = taller.Lugar,
            numeroParticipantes = taller.NumeroParticipantes,
        };

        var cambiaFecha = request.FechaTaller.HasValue && request.FechaTaller != taller.FechaTaller;

        await using var tx = await _context.Database.BeginTransactionAsync(ct);

        if (cambiaFecha && request.FechaTaller.HasValue)
        {
            await SincronizarVisitaDeRutaAsync(taller, request.FechaTaller.Value, ct);
        }

        if (request.FechaTaller.HasValue)
        {
            taller.FechaTaller = request.FechaTaller;
        }

        if (request.HoraTaller.HasValue)
        {
            taller.HoraTaller = request.HoraTaller;
        }

        if (request.Lugar is not null)
        {
            taller.Lugar = request.Lugar;
        }

        if (request.NumeroParticipantes.HasValue)
        {
            taller.NumeroParticipantes = request.NumeroParticipantes;
        }

        taller.IdUsuarioModificacion = idUsuario;

        _context.AjustesPostCierre.Add(new AjustePostCierre
        {
            EntidadTipo = AjustePostCierre.EntidadTaller,
            IdEntidad = taller.IdTaller,
            Accion = AjustePostCierre.AccionEditarTaller,
            ValoresAntes = JsonSerializer.Serialize(antes),
            ValoresDespues = JsonSerializer.Serialize(new
            {
                fechaTaller = taller.FechaTaller,
                horaTaller = taller.HoraTaller,
                lugar = taller.Lugar,
                numeroParticipantes = taller.NumeroParticipantes,
            }),
            Motivo = motivo,
            IdUsuario = idUsuario,
            FechaAjuste = DateTime.Now,
        });

        await _context.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        _logger.LogInformation(
            "Taller {IdTaller} ajustado por el usuario {IdUsuario}. Motivo: {Motivo}",
            taller.IdTaller, idUsuario, motivo);

        return await ArmarTallerDtoConNombresAsync(taller, ct);
    }

    /// <summary>
    /// Sincronización taller → ruta (ADR-00010 decisión 12): mueve la visita de la ruta activa
    /// (normal por id_seleccion_hospital; extraordinaria por id_hospital) a la nueva fecha,
    /// revalidando 3/día y 8/semana; conflicto → error y rollback.
    /// </summary>
    private async Task SincronizarVisitaDeRutaAsync(Taller taller, DateOnly nuevaFecha, CancellationToken ct)
    {
        if (nuevaFecha.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
        {
            throw new InvalidOperationException("La nueva fecha del taller debe ser un día laboral (Lun–Vie).");
        }

        var visitasActivas = _context.RutasVisitas
            .Where(v => _context.Rutas.Any(r => r.IdRuta == v.IdRuta && r.Estado == Ruta.EstadoCerrada));

        var visita = taller.EsExtraordinario
            ? await visitasActivas.FirstOrDefaultAsync(
                v => v.EsExtraordinaria && v.IdHospital == taller.IdHospital, ct)
            : taller.IdSeleccionHospital.HasValue
                ? await visitasActivas.FirstOrDefaultAsync(
                    v => !v.EsExtraordinaria && v.IdSeleccionHospital == taller.IdSeleccionHospital, ct)
                : null;

        if (visita is null)
        {
            _logger.LogInformation(
                "Taller {IdTaller}: no se encontró visita en ruta activa que sincronizar (fecha {NuevaFecha}).",
                taller.IdTaller, nuevaFecha);
            return;
        }

        if (visita.FechaVisita == nuevaFecha)
        {
            return;
        }

        var parametros = await _context.ParametrosModulo.AsNoTracking()
            .Where(p => p.Activo)
            .ToListAsync(ct);
        var maxDia = (int)(parametros.FirstOrDefault(p => p.Clave == "max_visitas_dia")?.Valor ?? 3);
        var maxSemana = (int)(parametros.FirstOrDefault(p => p.Clave == "max_visitas_semana")?.Valor ?? 8);

        var visitasRuta = await _context.RutasVisitas
            .Where(v => v.IdRuta == visita.IdRuta && v.IdRutaVisita != visita.IdRutaVisita)
            .ToListAsync(ct);

        if (visitasRuta.Any(v => v.FechaVisita == nuevaFecha && v.Orden == visita.Orden))
        {
            throw new InvalidOperationException(
                $"El día {nuevaFecha:dd/MM} ya tiene una visita en la posición {visita.Orden} de la ruta; el ajuste no se aplicó.");
        }

        var delDia = visitasRuta.Count(v => v.FechaVisita == nuevaFecha);
        if (delDia >= maxDia)
        {
            throw new InvalidOperationException(
                $"El día {nuevaFecha:dd/MM} ya alcanzó el máximo de {maxDia} visitas en la ruta; el ajuste no se aplicó.");
        }

        var dt = nuevaFecha.ToDateTime(TimeOnly.MinValue);
        var anio = System.Globalization.ISOWeek.GetYear(dt);
        var semana = System.Globalization.ISOWeek.GetWeekOfYear(dt);
        var deLaSemana = visitasRuta.Count(v =>
            System.Globalization.ISOWeek.GetYear(v.FechaVisita.ToDateTime(TimeOnly.MinValue)) == anio
            && System.Globalization.ISOWeek.GetWeekOfYear(v.FechaVisita.ToDateTime(TimeOnly.MinValue)) == semana);
        if (deLaSemana >= maxSemana)
        {
            throw new InvalidOperationException(
                $"La semana {semana} ya alcanzó el máximo de {maxSemana} visitas en la ruta; el ajuste no se aplicó.");
        }

        visita.FechaVisita = nuevaFecha;
        visita.IdUsuarioModificacion = taller.IdUsuarioModificacion;

        _logger.LogInformation(
            "Taller {IdTaller}: visita {IdRutaVisita} de la ruta {IdRuta} movida a {NuevaFecha} por sincronización.",
            taller.IdTaller, visita.IdRutaVisita, visita.IdRuta, nuevaFecha);
    }

    public async Task EliminarAsync(int idTaller, int idUsuario, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerEditableAsync(idTaller, idUsuario, "eliminar", ct);

        _context.TalleresRecursos.RemoveRange(taller.Recursos);
        _context.Talleres.Remove(taller);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Taller {IdTaller} eliminado por el usuario {IdUsuario}.", idTaller, idUsuario);
    }

    // ----- Solicitudes de cambio del equipo (ADR-00010, decisiones 13-15) -----

    public async Task<TallerSolicitudCambioDto> CrearSolicitudCambioAsync(
        int idTaller,
        CrearSolicitudCambioRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var taller = await _context.Talleres
            .FirstOrDefaultAsync(t => t.IdTaller == idTaller && t.Activo, ct)
            ?? throw new InvalidOperationException($"El taller {idTaller} no existe.");

        if (taller.Estado is Taller.EstadoRealizado or Taller.EstadoCancelado or Taller.EstadoCreada)
        {
            throw new InvalidOperationException(
                $"No se puede solicitar cambio con el taller en estado {taller.Estado}.");
        }

        // La crea cualquier integrante del equipo; el CEM con captura asistida también.
        var esMiembro = taller.IdEjecutivo == idUsuario || taller.IdEspecialista == idUsuario;
        if (!esMiembro)
        {
            await ValidarPermisoAsync(
                idUsuario,
                Permissions.EducacionMedica.TalleresCapturarAsistida,
                "Solo un integrante del equipo (o el CEM con captura asistida) puede solicitar el cambio.");
        }

        if (request.FechaTaller is null && request.HoraTaller is null
            && request.Lugar is null && request.NumeroParticipantes is null)
        {
            throw new InvalidOperationException("La solicitud debe incluir al menos un cambio (fecha, hora, lugar o participantes).");
        }

        var pendiente = await _context.TalleresSolicitudesCambio.AnyAsync(
            s => s.IdTaller == idTaller && s.Estado == TallerSolicitudCambio.EstadoPendiente, ct);
        if (pendiente)
        {
            throw new InvalidOperationException("El taller ya tiene una solicitud de cambio pendiente de resolución.");
        }

        var datos = new
        {
            antes = new
            {
                fechaTaller = taller.FechaTaller,
                horaTaller = taller.HoraTaller,
                lugar = taller.Lugar,
                numeroParticipantes = taller.NumeroParticipantes,
            },
            despues = new
            {
                fechaTaller = request.FechaTaller,
                horaTaller = request.HoraTaller,
                lugar = request.Lugar,
                numeroParticipantes = request.NumeroParticipantes,
            },
            motivoSolicitante = request.Motivo,
            idSolicitante = idUsuario,
        };

        var solicitud = new TallerSolicitudCambio
        {
            IdTaller = idTaller,
            Estado = TallerSolicitudCambio.EstadoPendiente,
            DatosJson = JsonSerializer.Serialize(datos),
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
            FechaCreacion = DateTime.UtcNow,
            FechaModificacion = DateTime.UtcNow,
        };

        _context.TalleresSolicitudesCambio.Add(solicitud);
        await _context.SaveChangesAsync(ct);

        await NotificarSolicitudCreadaAsync(taller, solicitud, request.Motivo, ct);

        _logger.LogInformation(
            "Solicitud de cambio {IdSolicitud} creada para el taller {IdTaller} por el usuario {IdUsuario}.",
            solicitud.IdSolicitud, idTaller, idUsuario);

        return await ArmarSolicitudDtoAsync(solicitud, ct);
    }

    public async Task<TallerSolicitudCambioDto> ResolverSolicitudCambioAsync(
        int idSolicitud,
        ResolverSolicitudCambioRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        await ValidarPermisoAsync(
            idUsuario,
            Permissions.EducacionMedica.TalleresAjustar,
            "No tienes permiso para resolver solicitudes de cambio (educacion_medica.talleres.puede_ajustar).");

        var solicitud = await _context.TalleresSolicitudesCambio
            .FirstOrDefaultAsync(s => s.IdSolicitud == idSolicitud, ct)
            ?? throw new InvalidOperationException($"La solicitud {idSolicitud} no existe.");

        if (solicitud.Estado != TallerSolicitudCambio.EstadoPendiente)
        {
            throw new InvalidOperationException($"La solicitud ya fue resuelta (estado: {solicitud.Estado}).");
        }

        var taller = await _context.Talleres
            .Include(t => t.Recursos)
            .FirstOrDefaultAsync(t => t.IdTaller == solicitud.IdTaller && t.Activo, ct)
            ?? throw new InvalidOperationException($"El taller {solicitud.IdTaller} no existe.");

        var datos = string.IsNullOrWhiteSpace(solicitud.DatosJson)
            ? null
            : JsonSerializer.Deserialize<SolicitudCambioDatos>(solicitud.DatosJson, JsonOptions);

        if (request.Aprobar)
        {
            if (datos?.Despues is null)
            {
                throw new InvalidOperationException("La solicitud no contiene el cambio solicitado.");
            }

            var ajusteRequest = new ActualizarTallerRequest
            {
                FechaTaller = datos.Despues.FechaTaller,
                HoraTaller = datos.Despues.HoraTaller,
                Lugar = datos.Despues.Lugar,
                NumeroParticipantes = datos.Despues.NumeroParticipantes,
                Motivo = request.Motivo,
            };

            await AplicarAjusteAsync(taller, ajusteRequest, idUsuario, request.Motivo, ct);
        }

        solicitud.Estado = request.Aprobar
            ? TallerSolicitudCambio.EstadoAprobada
            : TallerSolicitudCambio.EstadoRechazada;
        solicitud.IdUsuarioModificacion = idUsuario;
        solicitud.FechaModificacion = DateTime.UtcNow;
        solicitud.DatosJson = JsonSerializer.Serialize(new
        {
            antes = datos?.Antes,
            despues = datos?.Despues,
            motivoSolicitante = datos?.MotivoSolicitante,
            idSolicitante = datos?.IdSolicitante,
            resolucion = new
            {
                aprobada = request.Aprobar,
                motivo = request.Motivo,
                idUsuarioResolutor = idUsuario,
                fecha = DateTime.UtcNow,
            },
        });

        await _context.SaveChangesAsync(ct);

        await NotificarSolicitudResueltaAsync(taller, solicitud, request.Aprobar, request.Motivo, ct);

        _logger.LogInformation(
            "Solicitud de cambio {IdSolicitud} del taller {IdTaller} {Resolucion} por el usuario {IdUsuario}.",
            idSolicitud, taller.IdTaller, request.Aprobar ? "aprobada" : "rechazada", idUsuario);

        return await ArmarSolicitudDtoAsync(solicitud, ct);
    }

    public async Task<List<TallerSolicitudCambioDto>> GetSolicitudesCambioAsync(int idTaller, CancellationToken ct = default)
    {
        _ = await _context.Talleres.AsNoTracking()
            .FirstOrDefaultAsync(t => t.IdTaller == idTaller && t.Activo, ct)
            ?? throw new InvalidOperationException($"El taller {idTaller} no existe.");

        var solicitudes = await _context.TalleresSolicitudesCambio.AsNoTracking()
            .Where(s => s.IdTaller == idTaller)
            .OrderByDescending(s => s.FechaCreacion)
            .ToListAsync(ct);

        var resultado = new List<TallerSolicitudCambioDto>();
        foreach (var solicitud in solicitudes)
        {
            resultado.Add(await ArmarSolicitudDtoAsync(solicitud, ct));
        }

        return resultado;
    }

    public async Task<MatrizIndividualDto> GenerarMatrizIndividualAsync(int idMatrizIndividual, int idUsuario, CancellationToken ct = default)
    {
        var matriz = await _context.MatricesIndividuales
            .Include(m => m.Equipo)
            .FirstOrDefaultAsync(m => m.IdMatrizIndividual == idMatrizIndividual, ct)
            ?? throw new InvalidOperationException($"La matriz individual {idMatrizIndividual} no existe.");

        ValidarMiembroEquipo(matriz.Equipo, idUsuario);

        if (matriz.EsBloqueado)
        {
            throw new InvalidOperationException("La matriz individual ya está bloqueada (generada).");
        }

        var matrizGeneral = await ObtenerMatrizGeneralDeIndividualAsync(matriz, ct)
            ?? throw new InvalidOperationException(
                "La matriz individual no tiene talleres capturados; captura al menos un taller antes de generar.");

        await ValidarMatrizGeneralEditableAsync(matrizGeneral, "generar la matriz individual", ct);

        matriz.EsBloqueado = true;
        matriz.FechaBloqueo = DateTime.UtcNow;
        matriz.FechaDesbloqueo = null;
        matriz.IdUsuarioModificacion = idUsuario;
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Matriz individual {IdMatrizIndividual} (equipo {IdEquipo}) bloqueada por el usuario {IdUsuario}.",
            matriz.IdMatrizIndividual, matriz.IdEquipo, idUsuario);

        return await ArmarMatrizIndividualDtoConNombresAsync(matriz, ct);
    }

    public async Task<MatrizIndividualDto> ReabrirMatrizIndividualAsync(int idMatrizIndividual, int idUsuario, CancellationToken ct = default)
    {
        var matriz = await _context.MatricesIndividuales
            .Include(m => m.Equipo)
            .FirstOrDefaultAsync(m => m.IdMatrizIndividual == idMatrizIndividual, ct)
            ?? throw new InvalidOperationException($"La matriz individual {idMatrizIndividual} no existe.");

        if (!matriz.EsBloqueado)
        {
            throw new InvalidOperationException("La matriz individual no está bloqueada; no hay captura que reabrir.");
        }

        var matrizGeneral = await ObtenerMatrizGeneralDeIndividualAsync(matriz, ct)
            ?? throw new InvalidOperationException("La matriz individual no tiene matriz general asociada.");

        // Solo mientras la general sigue en el paso inicial (CREADA) se puede reabrir.
        // El permiso de quien reabre lo valida el endpoint (talleres.puede_revisar = GV/CA).
        var pasoActual = await ObtenerPasoActualAsync(matrizGeneral, ct);
        if (pasoActual is null || !pasoActual.EsInicio)
        {
            throw new InvalidOperationException(
                "No se puede reabrir la captura: la matriz general ya está en autorización. Devuélvela a Creada primero.");
        }

        matriz.EsBloqueado = false;
        matriz.FechaDesbloqueo = DateTime.UtcNow;
        matriz.IdUsuarioModificacion = idUsuario;
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Matriz individual {IdMatrizIndividual} (equipo {IdEquipo}) reabierta por el usuario {IdUsuario}.",
            matriz.IdMatrizIndividual, matriz.IdEquipo, idUsuario);

        return await ArmarMatrizIndividualDtoConNombresAsync(matriz, ct);
    }

    // ----- Helpers -----

    private sealed class SolicitudCambioDatos
    {
        public SolicitudCambioDiff? Antes { get; set; }
        public SolicitudCambioDiff? Despues { get; set; }
        public string? MotivoSolicitante { get; set; }
        public int? IdSolicitante { get; set; }
    }

    private sealed class SolicitudCambioDiff
    {
        public DateOnly? FechaTaller { get; set; }
        public TimeOnly? HoraTaller { get; set; }
        public string? Lugar { get; set; }
        public int? NumeroParticipantes { get; set; }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static DateOnly ParsePeriodo(string? periodo)
    {
        if (string.IsNullOrWhiteSpace(periodo))
        {
            var hoy = DateTime.UtcNow.Date;
            return new DateOnly(hoy.Year, hoy.Month, 1);
        }

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

    private async Task<EquipoPareo?> ObtenerEquipoDelUsuarioAsync(int idUsuario, CancellationToken ct)
    {
        return await _context.EquiposPareo.AsNoTracking()
            .Include(e => e.Region)
            .FirstOrDefaultAsync(e => e.Activo
                && (e.IdEjecutivo == idUsuario || e.IdEspecialista == idUsuario), ct);
    }

    private async Task<EquipoPareo?> ObtenerEquipoDelHospitalAsync(SeleccionHospital hospital, CancellationToken ct)
    {
        if (hospital.IdRegion is null)
        {
            return null;
        }

        var region = await _context.SeleccionesRegiones.AsNoTracking()
            .FirstOrDefaultAsync(r => r.IdRegion == hospital.IdRegion.Value, ct);

        if (region?.IdEquipo is null)
        {
            return null;
        }

        return await _context.EquiposPareo.AsNoTracking()
            .FirstOrDefaultAsync(e => e.IdEquipo == region.IdEquipo.Value && e.Activo, ct);
    }

    private static void ValidarMiembroEquipo(EquipoPareo? equipo, int idUsuario)
    {
        if (equipo is null || (equipo.IdEjecutivo != idUsuario && equipo.IdEspecialista != idUsuario))
        {
            throw new InvalidOperationException(
                "Solo el Ejecutivo de Ventas o el Especialista de Producto del equipo puede ejecutar esta acción.");
        }
    }

    /// <summary>
    /// Captura normal: EV/EP del equipo. Captura asistida (ADR-00011): el CEM con permiso
    /// crea a nombre de cualquier equipo.
    /// </summary>
    private async Task ValidarCapturaDelUsuarioAsync(EquipoPareo equipo, int idUsuario, CancellationToken ct)
    {
        if (equipo.IdEjecutivo == idUsuario || equipo.IdEspecialista == idUsuario)
        {
            return;
        }

        var permisos = await _permissionService.GetPermissionsAsync(idUsuario);
        if (!permisos.Contains(Permissions.EducacionMedica.TalleresCapturarAsistida))
        {
            throw new InvalidOperationException(
                "Solo el Ejecutivo de Ventas o el Especialista de Producto del equipo asignado a la región del hospital puede capturar el taller.");
        }
    }

    private async Task ValidarPermisoAsync(int idUsuario, string permiso, string mensaje)
    {
        var permisos = await _permissionService.GetPermissionsAsync(idUsuario);
        if (!permisos.Contains(permiso))
        {
            throw new InvalidOperationException(mensaje);
        }
    }

    private async Task ValidarLimiteTemporalAsync(DateOnly fechaOriginal, CancellationToken ct)
    {
        var parametro = await _context.ParametrosModulo.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Clave == "dias_limite_cambio" && p.Activo, ct);
        var diasLimite = (int)(parametro?.Valor ?? DiasLimiteCambioDefault);

        var hoy = DateOnly.FromDateTime(DateTime.Today);
        if (fechaOriginal < hoy.AddDays(-diasLimite))
        {
            throw new InvalidOperationException(
                $"El ajuste excede el límite de {diasLimite} días (fecha original: {fechaOriginal:dd/MM/yyyy}). Solicita un cambio estructural.");
        }
    }

    private async Task<MatrizIndividual> GetOrCreateMatrizIndividualAsync(int idEquipo, DateOnly periodo, int idUsuario, CancellationToken ct)
    {
        var matriz = await _context.MatricesIndividuales
            .FirstOrDefaultAsync(m => m.IdEquipo == idEquipo && m.Periodo == periodo, ct);

        if (matriz is not null)
        {
            return matriz;
        }

        matriz = new MatrizIndividual
        {
            IdEquipo = idEquipo,
            Periodo = periodo,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        };
        _context.MatricesIndividuales.Add(matriz);
        await _context.SaveChangesAsync(ct);
        return matriz;
    }

    private async Task<MatrizGeneral> GetOrCreateMatrizGeneralAsync(int idTipoGerencia, DateOnly periodo, int idUsuario, CancellationToken ct)
    {
        var matriz = await _context.MatricesGenerales
            .FirstOrDefaultAsync(m => m.IdTipoGerencia == idTipoGerencia && m.Periodo == periodo, ct);

        if (matriz is not null)
        {
            return matriz;
        }

        // La matriz general nace con el primer taller de la gerencia/mes, ya en el paso inicial
        var workflow = await _workflowResolver.ResolveWorkflowIdAsync(
            CodigoProceso.EDUCACION_MEDICA_MATRIZ,
            new Dictionary<string, int?> { [WorkflowScope.TIPO_GERENCIA] = idTipoGerencia })
            ?? throw new InvalidOperationException(
                "No hay workflow configurado para la matriz de talleres de esa gerencia. Aplica el script 0015 y crea el mapping (EDUCACION_MEDICA_MATRIZ + Tipo de gerencia) en el admin de workflows.");

        var pasoInicio = workflow.Pasos.FirstOrDefault(p => p.EsInicio)
            ?? throw new InvalidOperationException("El workflow de la matriz de talleres no tiene paso inicial configurado.");

        matriz = new MatrizGeneral
        {
            IdTipoGerencia = idTipoGerencia,
            Periodo = periodo,
            IdWorkflow = workflow.IdWorkflow,
            IdPasoActual = pasoInicio.IdPaso,
            IdEstado = pasoInicio.IdEstado,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        };
        _context.MatricesGenerales.Add(matriz);
        await _context.SaveChangesAsync(ct);
        return matriz;
    }

    /// <summary>Candado de edición estilo OC/Solicitudes: solo en el paso inicial (estado CREADA).</summary>
    private async Task ValidarMatrizGeneralEditableAsync(MatrizGeneral matrizGeneral, string accion, CancellationToken ct)
    {
        var pasoActual = await ObtenerPasoActualAsync(matrizGeneral, ct);
        if (pasoActual is null || !pasoActual.EsInicio)
        {
            throw new InvalidOperationException($"Solo se pueden {accion} en estado Creada.");
        }
    }

    private async Task<WorkflowPaso?> ObtenerPasoActualAsync(MatrizGeneral matrizGeneral, CancellationToken ct)
    {
        if (matrizGeneral.IdPasoActual is null)
        {
            return null;
        }

        return await _context.WorkflowPasos.AsNoTracking()
            .Include(p => p.Participantes)
            .FirstOrDefaultAsync(p => p.IdPaso == matrizGeneral.IdPasoActual.Value, ct);
    }

    /// <summary>Edición normal (matriz en Creada): membresía del equipo + candados de captura.</summary>
    private async Task ValidarEdicionNormalAsync(Taller taller, int idUsuario, CancellationToken ct)
    {
        if (taller.IdEjecutivo != idUsuario && taller.IdEspecialista != idUsuario)
        {
            throw new InvalidOperationException(
                "Solo el Ejecutivo de Ventas o el Especialista de Producto del equipo puede modificar el taller.");
        }

        if (taller.IdMatrizIndividual is not null)
        {
            var matrizIndividual = await _context.MatricesIndividuales.AsNoTracking()
                .FirstOrDefaultAsync(m => m.IdMatrizIndividual == taller.IdMatrizIndividual.Value, ct);
            if (matrizIndividual?.EsBloqueado == true)
            {
                throw new InvalidOperationException(
                    "La matriz individual del equipo ya está bloqueada (generada). Pide al Gerente de Ventas que reabra la captura.");
            }
        }

        if (taller.IdMatrizGeneral is not null)
        {
            var matrizGeneral = await _context.MatricesGenerales.AsNoTracking()
                .FirstOrDefaultAsync(m => m.IdMatrizGeneral == taller.IdMatrizGeneral.Value, ct);
            if (matrizGeneral is not null)
            {
                await ValidarMatrizGeneralEditableAsync(matrizGeneral, "editar talleres", ct);
            }
        }
    }

    private async Task<Taller> ObtenerTallerEditableAsync(int idTaller, int idUsuario, string accion, CancellationToken ct)
    {
        var taller = await _context.Talleres
            .Include(t => t.Recursos)
            .FirstOrDefaultAsync(t => t.IdTaller == idTaller && t.Activo, ct)
            ?? throw new InvalidOperationException($"El taller {idTaller} no existe.");

        await ValidarEdicionNormalAsync(taller, idUsuario, ct);
        return taller;
    }

    private async Task<MatrizGeneral?> ObtenerMatrizGeneralDeIndividualAsync(MatrizIndividual matriz, CancellationToken ct)
    {
        var idMatrizGeneral = await _context.Talleres.AsNoTracking()
            .Where(t => t.IdMatrizIndividual == matriz.IdMatrizIndividual && t.IdMatrizGeneral != null)
            .Select(t => t.IdMatrizGeneral)
            .FirstOrDefaultAsync(ct);

        if (idMatrizGeneral is null or 0)
        {
            return null;
        }

        return await _context.MatricesGenerales
            .FirstOrDefaultAsync(m => m.IdMatrizGeneral == idMatrizGeneral.Value, ct);
    }

    private void ReemplazarRecursos(Taller taller, List<GuardarTallerRecursoRequest>? recursos, int idUsuario)
    {
        if (recursos is null)
        {
            return;
        }

        foreach (var request in recursos)
        {
            if (!TallerRecurso.TiposValidos.Contains(request.TipoRecurso))
            {
                throw new InvalidOperationException(
                    $"Tipo de recurso desconocido: '{request.TipoRecurso}'. Use {string.Join(", ", TallerRecurso.TiposValidos)}.");
            }
        }

        _context.TalleresRecursos.RemoveRange(taller.Recursos);
        taller.Recursos.Clear();

        foreach (var request in recursos)
        {
            taller.Recursos.Add(new TallerRecurso
            {
                TipoRecurso = request.TipoRecurso,
                IdProducto = request.IdProducto,
                Descripcion = request.Descripcion,
                TipoEnvio = request.TipoEnvio,
                Cantidad = request.Cantidad,
                Observaciones = request.Observaciones,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario,
            });
        }
    }

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

    private async Task<TallerSolicitudCambioDto> ArmarSolicitudDtoAsync(TallerSolicitudCambio solicitud, CancellationToken ct)
    {
        var idsUsuarios = new[] { solicitud.IdUsuarioCreacion, solicitud.IdUsuarioModificacion }
            .Where(i => i.HasValue)
            .Select(i => i!.Value)
            .Distinct()
            .ToList();

        var nombres = idsUsuarios.Count > 0
            ? await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => idsUsuarios.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct)
            : new Dictionary<int, string>();

        return new TallerSolicitudCambioDto
        {
            IdSolicitud = solicitud.IdSolicitud,
            IdTaller = solicitud.IdTaller,
            Estado = solicitud.Estado,
            DatosJson = solicitud.DatosJson,
            FechaCreacion = solicitud.FechaCreacion,
            FechaModificacion = solicitud.FechaModificacion,
            IdUsuarioCreacion = solicitud.IdUsuarioCreacion,
            NombreUsuarioCreacion = solicitud.IdUsuarioCreacion.HasValue
                ? nombres.GetValueOrDefault(solicitud.IdUsuarioCreacion.Value)
                : null,
            IdUsuarioModificacion = solicitud.IdUsuarioModificacion,
            NombreUsuarioModificacion = solicitud.IdUsuarioModificacion.HasValue
                ? nombres.GetValueOrDefault(solicitud.IdUsuarioModificacion.Value)
                : null,
        };
    }

    private async Task NotificarSolicitudCreadaAsync(
        Taller taller,
        TallerSolicitudCambio solicitud,
        string motivo,
        CancellationToken ct)
    {
        var nombreHospital = taller.IdHospital.HasValue
            ? (await _asokamContext.Hospitales.AsNoTracking()
                .Where(h => h.CodigoContacto == taller.IdHospital.Value)
                .Select(h => h.NombreContacto)
                .FirstOrDefaultAsync(ct)) ?? $"Hospital {taller.IdHospital}"
            : $"Taller {taller.IdTaller}";

        try
        {
            await _notificationService.SendAsync(new SendNotificationRequest
            {
                Title = "Solicitud de cambio de taller",
                Message = $"El equipo solicita un cambio en el taller de {nombreHospital} ({taller.FechaTaller:dd/MM/yyyy}). Motivo: {motivo}. Resuélvela desde la Matriz General.",
                Type = "info",
                Category = "educacion-medica-solicitud-cambio",
                Priority = "normal",
                Channels =
                [
                    new NotificationChannelRequest { ChannelType = "in-app", RoleNames = [RolCem] },
                    // Correo deshabilitado temporalmente (decisión del usuario 2026-10-10): solo notificación in-app.
                    // new NotificationChannelRequest { ChannelType = "email", RoleNames = [RolCem] },
                ],
            }, ct);
        }
        catch (Exception ex)
        {
            // La notificación no debe tumbar la solicitud (precedente IncidenciasChecado: best-effort).
            _logger.LogWarning(ex,
                "No se pudo notificar al CEM la solicitud de cambio {IdSolicitud}.", solicitud.IdSolicitud);
        }
    }

    private async Task NotificarSolicitudResueltaAsync(
        Taller taller,
        TallerSolicitudCambio solicitud,
        bool aprobada,
        string motivo,
        CancellationToken ct)
    {
        if (solicitud.IdUsuarioCreacion is not int idSolicitante)
        {
            return;
        }

        try
        {
            await _notificationService.SendAsync(new SendNotificationRequest
            {
                Title = aprobada ? "Solicitud de cambio aprobada" : "Solicitud de cambio rechazada",
                Message = $"Tu solicitud de cambio del taller {taller.IdTaller} fue {(aprobada ? "aprobada y aplicada" : "rechazada")}. Motivo: {motivo}.",
                Type = aprobada ? "success" : "warning",
                Category = "educacion-medica-solicitud-cambio",
                Priority = "normal",
                Channels =
                [
                    new NotificationChannelRequest { ChannelType = "in-app", UserIds = [idSolicitante] },
                    // Correo deshabilitado temporalmente (decisión del usuario 2026-10-10): solo notificación in-app.
                    // new NotificationChannelRequest { ChannelType = "email", UserIds = [idSolicitante] },
                ],
            }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "No se pudo notificar al solicitante la resolución de la solicitud {IdSolicitud}.", solicitud.IdSolicitud);
        }
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

    private async Task<TallerDto> ArmarTallerDtoConNombresAsync(Taller taller, CancellationToken ct)
    {
        var (nombresHospitales, nombresUsuarios) = await ResolverNombresAsync(
            [taller.IdHospital],
            [taller.IdEjecutivo, taller.IdEspecialista, taller.IdUsuarioCreacion],
            ct);
        var (nombresEstados, nombresProductos) = await EducacionMedicaNombres.ResolverParaTalleresAsync(
            _asokamContext, [taller], ct);
        return TallerDtoMapper.Armar(taller, nombresHospitales, nombresUsuarios, nombresProductos, nombresEstados);
    }

    private async Task<MatrizIndividualDto> ArmarMatrizIndividualDtoConNombresAsync(MatrizIndividual matriz, CancellationToken ct)
    {
        var equipo = matriz.Equipo ?? await _context.EquiposPareo.AsNoTracking()
            .FirstOrDefaultAsync(e => e.IdEquipo == matriz.IdEquipo, ct);

        var totalTalleres = await _context.Talleres.AsNoTracking()
            .CountAsync(t => t.IdMatrizIndividual == matriz.IdMatrizIndividual && t.Activo, ct);

        var (_, nombresUsuarios) = await ResolverNombresAsync(
            [],
            [equipo?.IdEjecutivo, equipo?.IdEspecialista],
            ct);

        return ArmarMatrizIndividualDto(matriz, equipo, totalTalleres, nombresUsuarios);
    }

    private static MatrizIndividualDto ArmarMatrizIndividualDto(
        MatrizIndividual matriz,
        EquipoPareo? equipo,
        int totalTalleres,
        IReadOnlyDictionary<int, string> nombresUsuarios)
    {
        return new MatrizIndividualDto
        {
            IdMatrizIndividual = matriz.IdMatrizIndividual,
            IdEquipo = matriz.IdEquipo,
            Periodo = matriz.Periodo,
            EsBloqueado = matriz.EsBloqueado,
            FechaBloqueo = matriz.FechaBloqueo,
            FechaDesbloqueo = matriz.FechaDesbloqueo,
            IdEjecutivo = equipo?.IdEjecutivo,
            NombreEjecutivo = equipo is not null ? nombresUsuarios.GetValueOrDefault(equipo.IdEjecutivo) : null,
            IdEspecialista = equipo?.IdEspecialista,
            NombreEspecialista = equipo is not null ? nombresUsuarios.GetValueOrDefault(equipo.IdEspecialista) : null,
            TotalTalleres = totalTalleres,
        };
    }
}
