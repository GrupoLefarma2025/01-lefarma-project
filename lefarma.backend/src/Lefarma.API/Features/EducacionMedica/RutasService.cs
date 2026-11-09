using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.EducacionMedica.Services;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace Lefarma.API.Features.EducacionMedica;

public class RutasService : IRutasService
{
    public const string EstrategiaCiudad = "ciudad";
    public const string EstrategiaCentroide = "centroide";

    private const int MaxViajesForaneosPorMesDefault = 3;
    private const int DiasLimiteCambioDefault = 45;

    private readonly IRutaRepository _rutaRepository;
    private readonly ISeleccionMensualRepository _seleccionRepository;
    private readonly IEquipoPareoRepository _equipoRepository;
    private readonly IHospitalRepository _hospitalRepository;
    private readonly IHospitalExtensionRepository _extensionRepository;
    private readonly IParametroModuloRepository _parametroRepository;
    private readonly ILogger<RutasService> _logger;
    private readonly AsokamDbContext _asokamContext;
    private readonly ApplicationDbContext _context;
    private readonly UserPermissionService _permissionService;
    private readonly IEjecutivoElegibilidadService _elegibilidad;

    public RutasService(
        IRutaRepository rutaRepository,
        ISeleccionMensualRepository seleccionRepository,
        IEquipoPareoRepository equipoRepository,
        IHospitalRepository hospitalRepository,
        IHospitalExtensionRepository extensionRepository,
        IParametroModuloRepository parametroRepository,
        ILogger<RutasService> logger,
        AsokamDbContext asokamContext,
        ApplicationDbContext context,
        UserPermissionService permissionService,
        IEjecutivoElegibilidadService elegibilidad)
    {
        _rutaRepository = rutaRepository;
        _seleccionRepository = seleccionRepository;
        _equipoRepository = equipoRepository;
        _hospitalRepository = hospitalRepository;
        _extensionRepository = extensionRepository;
        _parametroRepository = parametroRepository;
        _logger = logger;
        _asokamContext = asokamContext;
        _context = context;
        _permissionService = permissionService;
        _elegibilidad = elegibilidad;
    }

    public async Task<GenerarRutasResponse> GenerarAsync(
        int idSeleccionMensual,
        int idUsuario,
        GenerarRutasRequest? request = null,
        CancellationToken ct = default)
    {
        var estrategia = string.IsNullOrWhiteSpace(request?.Estrategia)
            ? EstrategiaCiudad
            : request!.Estrategia.Trim().ToLowerInvariant();
        if (estrategia is not (EstrategiaCiudad or EstrategiaCentroide))
        {
            throw new InvalidOperationException(
                $"Estrategia de reparto desconocida: '{request!.Estrategia}'. Use '{EstrategiaCiudad}' (ciudades juntas) o '{EstrategiaCentroide}' (compacto por distancia al centroide).");
        }

        var seleccion = await _seleccionRepository.GetByIdAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException("La selección solicitada no existe.");

        if (seleccion.Estado != SeleccionMensual.EstadoCerrada)
        {
            throw new InvalidOperationException(
                $"Solo una selección Cerrada (autorizada por completo) puede planificar rutas (estado actual: {seleccion.Estado}).");
        }

        var rutasExistentes = await _rutaRepository.GetBySeleccionAsync(idSeleccionMensual, null, ct);
        if (rutasExistentes.Any(r => r.Estado == Ruta.EstadoCerrada))
        {
            throw new InvalidOperationException(
                "Esta selección ya tiene rutas confirmadas. Cancélalas antes de regenerar la propuesta.");
        }

        var versionActiva = await _rutaRepository.GetVersionMaximaAsync(idSeleccionMensual, ct);
        if (versionActiva is { Estado: RutaVersion.EstadoCreada }
            && versionActiva.IdUsuarioCreacion.HasValue
            && versionActiva.IdUsuarioCreacion.Value != idUsuario)
        {
            throw new InvalidOperationException(
                "Esta versión está en captura por otro usuario; solo su creador puede regenerarla.");
        }

        var idsRutasActivas = rutasExistentes
            .Where(r => r.Estado is not (Ruta.EstadoArchivada or Ruta.EstadoCancelada or Ruta.EstadoRechazada))
            .Select(r => r.IdRuta)
            .ToList();
        var talleresCapturados = idsRutasActivas.Count == 0
            ? 0
            : await _context.Talleres
                .AsNoTracking()
                .Where(t => t.Activo
                    && t.IdRutaVisita.HasValue
                    && _context.RutasVisitas.Any(v =>
                        v.IdRutaVisita == t.IdRutaVisita.Value
                        && idsRutasActivas.Contains(v.IdRuta)))
                .CountAsync(ct);
        if (talleresCapturados > 0)
        {
            throw new InvalidOperationException(
                $"No se puede regenerar la propuesta: hay {talleresCapturados} taller(es) capturado(s) en esta selección. Ajusta o elimina los talleres antes de regenerar.");
        }

        var regiones = await _seleccionRepository.GetRegionesAsync(idSeleccionMensual, ct);
        var hospitales = await _seleccionRepository.GetHospitalesAsync(idSeleccionMensual, ct);
        var avisos = new List<string>();

        var regionesPorId = regiones.ToDictionary(r => r.IdRegion);

        // Nuevo modelo (ADR-00015): la ruta se genera por especialista. Si la selección
        // aún no tiene especialistas, se usa el ejecutivo y se crea una ruta sin especialista
        // para que la planeación no se detenga. El modelo de equipos queda como fallback legacy.
        var usaEspecialistas = regiones.Any(r => r.IdEjecutivo.HasValue || r.IdEspecialista.HasValue)
            || hospitales.Any(h => h.IdEspecialista.HasValue);

        var conRegion = hospitales
            .Where(h => h.IdRegion.HasValue
                && regionesPorId.TryGetValue(h.IdRegion.Value, out var region)
                && (usaEspecialistas
                    ? h.IdEspecialista.HasValue || region.IdEjecutivo.HasValue || region.IdEspecialista.HasValue
                    : region.IdEquipo.HasValue))
            .ToList();

        var sinPlan = hospitales.Count - conRegion.Count;
        if (sinPlan > 0)
        {
            avisos.Add(usaEspecialistas
                ? $"{sinPlan} hospital(es) quedaron sin ruta: no tienen región o su región no tiene ejecutivo/especialista asignado."
                : $"{sinPlan} hospital(es) quedaron sin ruta: no tienen región o su región no tiene equipo asignado.");
        }

        var inicio = seleccion.FechaInicioVigencia ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var fin = seleccion.FechaFinVigencia ?? inicio.AddDays(45);
        var (maxVisitasPorDia, maxVisitasPorSemana, maxViajesForaneos) = await LeerParametrosAsync(ct);
        var capacidad = CapacidadPeriodo.Calcular(inicio, fin, maxVisitasPorDia, maxVisitasPorSemana);

        if (usaEspecialistas)
        {
            var demandas = conRegion
                .Select(h => new { h, IdEspecialista = EspecialistaEfectivo(h, regionesPorId) })
                .Where(x => x.IdEspecialista.HasValue)
                .GroupBy(x => x.IdEspecialista!.Value)
                .ToDictionary(g => g.Key, g => g.Count());

            foreach (var (idEspecialista, demanda) in demandas.OrderBy(d => d.Key))
            {
                if (demanda > capacidad)
                {
                    throw new InvalidOperationException(
                        $"Capacidad insuficiente: el especialista {idEspecialista} tendría {demanda} hospital(es) contra una capacidad de {capacidad} visitas en el periodo (déficit {demanda - capacidad}).");
                }
            }
        }
        else
        {
            var demandas = conRegion
                .GroupBy(h => regionesPorId[h.IdRegion!.Value].IdEquipo!.Value)
                .ToDictionary(g => g.Key, g => g.Count());

            foreach (var (idEquipo, demanda) in demandas.OrderBy(d => d.Key))
            {
                if (demanda > capacidad)
                {
                    throw new InvalidOperationException(
                        $"Capacidad insuficiente: el equipo {idEquipo} tendría {demanda} hospital(es) contra una capacidad de {capacidad} visitas en el periodo (déficit {demanda - capacidad}).");
                }
            }
        }

        var idsHospitalesAsokam = hospitales
            .Where(h => h.IdHospital.HasValue)
            .Select(h => h.IdHospital!.Value)
            .Distinct()
            .ToList();

        var extensiones = idsHospitalesAsokam.Count > 0
            ? (await _extensionRepository.GetByHospitalIdsAsync(idsHospitalesAsokam, ct))
                .ToDictionary(e => e.IdHospital, e => e.EsZonaMetropolitana)
            : new Dictionary<int, bool?>();

        var sinClasificar = hospitales
            .Where(h => h.IdHospital.HasValue && !extensiones.ContainsKey(h.IdHospital.Value))
            .Count();

        if (sinClasificar > 0)
        {
            avisos.Add($"{sinClasificar} hospital(es) sin clasificar (es_zona_metropolitana); se cuentan como foráneos.");
        }

        var draftsPrevios = rutasExistentes.Where(r => r.Estado == Ruta.EstadoCreada).ToList();
        foreach (var draft in draftsPrevios)
        {
            draft.Estado = Ruta.EstadoArchivada;
            draft.IdUsuarioModificacion = idUsuario;
            await _rutaRepository.UpdateAsync(draft, ct);
        }

        if (draftsPrevios.Count > 0)
        {
            avisos.Add($"La versión draft anterior ({draftsPrevios.Count} ruta(s)) fue archivada.");
        }

        if (versionActiva is { Estado: RutaVersion.EstadoCreada })
        {
            versionActiva.Estado = RutaVersion.EstadoArchivada;
            versionActiva.IdUsuarioModificacion = idUsuario;
            await _rutaRepository.UpdateVersionAsync(versionActiva, ct);
        }

        var version = (await _rutaRepository.GetVersionActualAsync(idSeleccionMensual, ct) ?? 0) + 1;

        var versionRow = await _rutaRepository.CreateVersionAsync(new RutaVersion
        {
            IdSeleccionMensual = idSeleccionMensual,
            Version = version,
            IdTipoGerencia = seleccion.IdTipoGerencia,
            Estado = RutaVersion.EstadoCreada,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        }, ct);

        if (seleccion.IdTipoGerencia.HasValue)
        {
            var fechaPeriodo = seleccion.FechaInicioVigencia ?? seleccion.FechaSeleccion;
            var periodo = new DateOnly(fechaPeriodo.Year, fechaPeriodo.Month, 1);
            var matrizGeneral = await _context.MatricesGenerales
                .FirstOrDefaultAsync(m =>
                    m.IdTipoGerencia == seleccion.IdTipoGerencia.Value
                    && m.Periodo == periodo, ct);

            if (matrizGeneral is not null
                && matrizGeneral.IdRutaVersion != versionRow.IdRutaVersion)
            {
                matrizGeneral.IdRutaVersion = versionRow.IdRutaVersion;
                matrizGeneral.IdUsuarioModificacion = idUsuario;
                matrizGeneral.FechaModificacion = DateTime.UtcNow;
                await _context.SaveChangesAsync(ct);
            }
        }

        var rutasCreadas = new List<Ruta>();
        if (usaEspecialistas)
        {
            var idsEspecialistas = conRegion
                .Select(h => EspecialistaEfectivo(h, regionesPorId))
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();
            var nombresEspecialistas = idsEspecialistas.Count == 0
                ? new Dictionary<int, string>()
                : await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => idsEspecialistas.Contains(u.IdUsuario))
                    .ToDictionaryAsync(
                        u => u.IdUsuario,
                        u => u.NombreCompleto ?? $"Especialista {u.IdUsuario}",
                        ct);

            foreach (var grupoEspecialista in conRegion
                .GroupBy(h => EspecialistaEfectivo(h, regionesPorId))
                .OrderBy(g => g.Key ?? int.MaxValue))
            {
                var idEspecialista = grupoEspecialista.Key;
                var nombre = idEspecialista.HasValue
                    ? nombresEspecialistas.GetValueOrDefault(
                        idEspecialista.Value, $"Especialista {idEspecialista.Value}")
                    : "sin especialista";
                var ruta = await _rutaRepository.CreateAsync(new Ruta
                {
                    IdSeleccionMensual = idSeleccionMensual,
                    IdEquipo = null,
                    IdEspecialista = idEspecialista,
                    Version = version,
                    IdRutaVersion = versionRow.IdRutaVersion,
                    Nombre = $"Ruta {nombre} · v{version}",
                    Estado = Ruta.EstadoCreada,
                    IdUsuarioCreacion = idUsuario,
                    IdUsuarioModificacion = idUsuario,
                }, ct);

                var visitas = DistribuirEnDias(
                    ruta,
                    grupoEspecialista.ToList(),
                    inicio,
                    fin,
                    maxVisitasPorDia,
                    maxVisitasPorSemana,
                    idUsuario,
                    agruparPorCiudad: estrategia == EstrategiaCiudad,
                    idEspecialista: idEspecialista,
                    idEjecutivoSelector: h => h.IdEjecutivo
                        ?? (h.IdRegion.HasValue
                            ? regionesPorId.GetValueOrDefault(h.IdRegion.Value)?.IdEjecutivo
                            : null));
                foreach (var visita in visitas)
                {
                    await _rutaRepository.AddVisitaAsync(visita, ct);
                }

                rutasCreadas.Add(ruta);
            }
        }
        else
        {
            foreach (var grupoEquipo in conRegion
                .GroupBy(h => regionesPorId[h.IdRegion!.Value].IdEquipo!.Value)
                .OrderBy(g => g.Key))
            {
                var idEquipo = grupoEquipo.Key;
                var ruta = await _rutaRepository.CreateAsync(new Ruta
                {
                    IdSeleccionMensual = idSeleccionMensual,
                    IdEquipo = idEquipo,
                    Version = version,
                    IdRutaVersion = versionRow.IdRutaVersion,
                    Nombre = $"Ruta Equipo {idEquipo} · v{version}",
                    Estado = Ruta.EstadoCreada,
                    IdUsuarioCreacion = idUsuario,
                    IdUsuarioModificacion = idUsuario,
                }, ct);

                var visitas = DistribuirEnDias(
                    ruta,
                    grupoEquipo.ToList(),
                    inicio,
                    fin,
                    maxVisitasPorDia,
                    maxVisitasPorSemana,
                    idUsuario,
                    agruparPorCiudad: estrategia == EstrategiaCiudad,
                    idEjecutivoSelector: h => h.IdEjecutivo);
                foreach (var visita in visitas)
                {
                    await _rutaRepository.AddVisitaAsync(visita, ct);
                }

                rutasCreadas.Add(ruta);
            }
        }

        foreach (var ruta in rutasCreadas)
        {
            var visitasRuta = await _rutaRepository.GetVisitasAsync(ruta.IdRuta, ct);
            var viajes = ViajesForaneos.Contar(visitasRuta
                .Where(v => v.IdHospital.HasValue)
                .Select(v => (
                    v.FechaVisita,
                    EsForanea: extensiones.GetValueOrDefault(v.IdHospital!.Value) != true,
                    IdRegion: (int?)regionesPorId.GetValueOrDefault(
                        hospitales.First(h => h.IdSeleccionHospital == v.IdSeleccionHospital).IdRegion!.Value)?.IdRegion)));

            if (viajes > maxViajesForaneos)
            {
                avisos.Add($"{ruta.Nombre}: {viajes} viajes foráneos superan el límite de {maxViajesForaneos} al mes; ajusta la distribución antes de confirmar.");
            }
        }

        var detalle = await ArmarDetalleAsync(rutasCreadas, extensiones, ct);
        _logger.LogInformation(
            "Draft de rutas v{Version} generado para la selección {IdSeleccion} por el usuario {IdUsuario} con estrategia '{Estrategia}' ({Rutas} ruta(s), {Avisos} aviso(s)).",
            version, idSeleccionMensual, idUsuario, estrategia, rutasCreadas.Count, avisos.Count);
        return new GenerarRutasResponse
        {
            Version = version,
            IdRutaVersion = versionRow.IdRutaVersion,
            Estrategia = estrategia,
            Rutas = detalle,
            Avisos = avisos,
        };
    }

    public async Task<List<RutaDto>> GetBySeleccionAsync(int idSeleccionMensual, int? version, CancellationToken ct = default)
    {
        var rutas = await _rutaRepository.GetBySeleccionAsync(idSeleccionMensual, version, ct);
        return await ArmarDetalleAsync(rutas, null, ct);
    }

    public async Task<RutaVisitaDto> AsignarEjecutivoVisitaAsync(
        int idRuta,
        int idRutaVisita,
        AsignarEjecutivoVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var ruta = await ObtenerRutaAsync(idRuta, ct);
        var visita = await _rutaRepository.GetVisitaByIdAsync(idRutaVisita, ct)
            ?? throw new InvalidOperationException($"La visita {idRutaVisita} no existe.");

        if (visita.IdRuta != idRuta)
        {
            throw new InvalidOperationException($"La visita {idRutaVisita} no pertenece a la ruta {idRuta}.");
        }

        var esAjuste = ruta.Estado == Ruta.EstadoCerrada;
        if (esAjuste)
        {
            await ValidarPermisoAjusteAsync(idUsuario, ct);
            ValidarMotivoAjuste(request.Motivo);
            await ValidarLimiteTemporalAsync(visita.FechaVisita, ct);
        }
        else
        {
            await ValidarRutaEditableAsync(ruta, ct);
        }

        if (!visita.IdSeleccionHospital.HasValue)
        {
            throw new InvalidOperationException(
                "La visita no tiene hospital de la selección; no se puede validar el ejecutivo.");
        }

        var hospital = await _seleccionRepository.GetHospitalByIdAsync(
            visita.IdSeleccionHospital.Value, ct)
            ?? throw new InvalidOperationException(
                $"El hospital de la selección {visita.IdSeleccionHospital} no existe.");
        var region = hospital.IdRegion.HasValue
            ? await _seleccionRepository.GetRegionByIdAsync(hospital.IdRegion.Value, ct)
            : null;
        if (region is null)
        {
            throw new InvalidOperationException(
                "El hospital de la visita no tiene región asignada; no se puede validar el ejecutivo.");
        }

        var seleccion = await _seleccionRepository.GetByIdAsync(hospital.IdSeleccionMensual, ct)
            ?? throw new InvalidOperationException(
                $"La selección {hospital.IdSeleccionMensual} no existe.");

        if (request.IdEjecutivo.HasValue)
        {
            var esPrimario = await _elegibilidad.EsEjecutivoPrimarioAsync(
                request.IdEjecutivo.Value, region.IdRegionCatalogo, seleccion.IdTipoGerencia, ct);
            var esSuplente = !esPrimario && await _elegibilidad.EsEjecutivoSuplenteAsync(
                request.IdEjecutivo.Value, region.IdRegionCatalogo, seleccion.IdTipoGerencia, ct);

            if (!esPrimario && !esSuplente)
            {
                throw new InvalidOperationException(
                    "El ejecutivo no está activo para la misma región y gerencia de la visita.");
            }
        }

        var antes = new { idEjecutivo = visita.IdEjecutivo };
        visita.IdEjecutivo = request.IdEjecutivo;
        visita.IdUsuarioModificacion = idUsuario;
        visita.FechaModificacion = DateTime.UtcNow;

        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        await _rutaRepository.UpdateVisitaAsync(visita, ct);

        if (esAjuste)
        {
            await RegistrarAjusteAsync(
                AjustePostCierre.EntidadRutaVisita, visita.IdRutaVisita,
                AjustePostCierre.AccionEditarEjecutivo,
                antes, new { idEjecutivo = request.IdEjecutivo },
                request.Motivo!, idUsuario, ct);
        }

        await tx.CommitAsync(ct);
        return await ArmarVisitaDtoAsync(visita, ct);
    }

    public async Task<RutaVisitaDto> MoverVisitaAsync(
        int idRuta,
        int idRutaVisita,
        MoverVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var ruta = await ObtenerRutaAsync(idRuta, ct);
        var visita = await _rutaRepository.GetVisitaByIdAsync(idRutaVisita, ct)
            ?? throw new InvalidOperationException($"La visita {idRutaVisita} no existe.");

        if (visita.IdRuta != idRuta)
        {
            throw new InvalidOperationException($"La visita {idRutaVisita} no pertenece a la ruta {idRuta}.");
        }

        var esAjuste = ruta.Estado == Ruta.EstadoCerrada;
        if (esAjuste)
        {
            await ValidarPermisoAjusteAsync(idUsuario, ct);
            ValidarMotivoAjuste(request.Motivo);
            await ValidarLimiteTemporalAsync(visita.FechaVisita, ct);
        }
        else
        {
            await ValidarRutaEditableAsync(ruta, ct);
        }

        var tieneTalleres = await _context.Talleres
            .AsNoTracking()
            .AnyAsync(t => t.Activo && t.IdRutaVisita == idRutaVisita, ct);
        if (tieneTalleres)
        {
            throw new InvalidOperationException(
                "La visita tiene talleres capturados. Ajusta o elimina los talleres antes de reprogramarla.");
        }

        var (maxDia, maxSemana, _) = await LeerParametrosAsync(ct);
        var avisos = await ValidarMovimientoAsync(
            ruta, visita.IdSeleccionHospital, visita.EsExtraordinaria,
            request.FechaVisita, request.Orden, visita.IdRutaVisita,
            maxDia, maxSemana, esAjuste, ct);

        var antes = new { fechaVisita = visita.FechaVisita, orden = visita.Orden };
        visita.FechaVisita = request.FechaVisita;
        visita.Orden = request.Orden;
        visita.IdUsuarioModificacion = idUsuario;

        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        await _rutaRepository.UpdateVisitaAsync(visita, ct);

        if (esAjuste)
        {
            await RegistrarAjusteAsync(
                AjustePostCierre.EntidadRutaVisita, visita.IdRutaVisita, AjustePostCierre.AccionMoverVisita,
                antes, new { fechaVisita = request.FechaVisita, orden = request.Orden },
                request.Motivo!, idUsuario, ct);
        }

        await tx.CommitAsync(ct);

        var dto = await ArmarVisitaDtoAsync(visita, ct);
        dto.Avisos = avisos;
        return dto;
    }

    /// <summary>Edición de horas de la visita: normal en Creada; ajuste auditado en Cerrada (ADR-00010).</summary>
    public async Task<RutaVisitaDto> EditarHorasVisitaAsync(
        int idRuta,
        int idRutaVisita,
        EditarHorasVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var ruta = await ObtenerRutaAsync(idRuta, ct);
        var visita = await _rutaRepository.GetVisitaByIdAsync(idRutaVisita, ct)
            ?? throw new InvalidOperationException($"La visita {idRutaVisita} no existe.");

        if (visita.IdRuta != idRuta)
        {
            throw new InvalidOperationException($"La visita {idRutaVisita} no pertenece a la ruta {idRuta}.");
        }

        var esAjuste = ruta.Estado == Ruta.EstadoCerrada;
        if (esAjuste)
        {
            await ValidarPermisoAjusteAsync(idUsuario, ct);
            ValidarMotivoAjuste(request.Motivo);
            await ValidarLimiteTemporalAsync(visita.FechaVisita, ct);
        }
        else
        {
            await ValidarRutaEditableAsync(ruta, ct);
        }

        var antes = new { horaSalida = visita.HoraSalida, horaLlegada = visita.HoraLlegada };
        visita.HoraSalida = request.HoraSalida;
        visita.HoraLlegada = request.HoraLlegada;
        visita.IdUsuarioModificacion = idUsuario;

        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        await _rutaRepository.UpdateVisitaAsync(visita, ct);

        if (esAjuste)
        {
            await RegistrarAjusteAsync(
                AjustePostCierre.EntidadRutaVisita, visita.IdRutaVisita, AjustePostCierre.AccionEditarHoras,
                antes, new { horaSalida = request.HoraSalida, horaLlegada = request.HoraLlegada },
                request.Motivo!, idUsuario, ct);
        }

        await tx.CommitAsync(ct);
        return await ArmarVisitaDtoAsync(visita, ct);
    }

    public async Task<RutaVisitaDto> AgregarVisitaAsync(
        int idRuta,
        AgregarVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var ruta = await ObtenerRutaAsync(idRuta, ct);

        var esAjuste = ruta.Estado == Ruta.EstadoCerrada;
        if (esAjuste)
        {
            await ValidarPermisoAjusteAsync(idUsuario, ct);
            ValidarMotivoAjuste(request.Motivo);
            await ValidarLimiteTemporalAsync(request.FechaVisita, ct);
        }
        else
        {
            await ValidarRutaEditableAsync(ruta, ct);
        }

        var hospital = await _seleccionRepository.GetHospitalByIdAsync(request.IdSeleccionHospital, ct)
            ?? throw new InvalidOperationException($"El hospital seleccionado {request.IdSeleccionHospital} no existe.");

        if (hospital.IdSeleccionMensual != ruta.IdSeleccionMensual)
        {
            throw new InvalidOperationException("El hospital no pertenece a la selección de esta ruta.");
        }

        // Frontera región→responsable: Rutas no reasigna; la asignación vive en el paso Reparto.
        string? aviso = null;
        int? idEjecutivoRegion = null;
        int? idEspecialistaRegion = null;
        if (hospital.IdRegion.HasValue)
        {
            var region = await _seleccionRepository.GetRegionByIdAsync(hospital.IdRegion.Value, ct);
            idEjecutivoRegion = region?.IdEjecutivo;
            idEspecialistaRegion = region?.IdEspecialista;

            if (ruta.IdEspecialista.HasValue)
            {
                if (region?.IdEspecialista is { } idEspecialistaRegionAsignado
                    && idEspecialistaRegionAsignado != ruta.IdEspecialista)
                {
                    throw new InvalidOperationException(
                        $"Este hospital pertenece a la región \"{region.Nombre ?? $"Región {region.IdRegion}"}\" asignada al especialista {idEspecialistaRegionAsignado}. La asignación región → especialista se corrige en el paso Reparto de la selección.");
                }

                if (region?.IdEspecialista is null)
                {
                    aviso = "Alta manual: la región del hospital no tiene especialista asignado en el reparto.";
                }
            }
            else if (ruta.IdEquipo.HasValue)
            {
                if (region?.IdEquipo is { } idEquipoRegion && idEquipoRegion != ruta.IdEquipo)
                {
                    throw new InvalidOperationException(
                        $"Este hospital pertenece a la región \"{region.Nombre ?? $"Región {region.IdRegion}"}\" asignada al equipo {region.IdEquipo}. La asignación región → equipo se corrige en el paso Reparto de la selección.");
                }

                if (region?.IdEquipo is null)
                {
                    aviso = "Alta manual: el hospital no tiene equipo asignado en su región (la región no fue asignada en el paso Reparto).";
                }
            }
            else if (region is not null && !region.IdEjecutivo.HasValue)
            {
                aviso = "Alta manual: la región del hospital no tiene ejecutivo asignado en el reparto.";
            }
        }
        else
        {
            aviso = "Alta manual: el hospital no tiene región asignada en la selección (no fue agrupado en el paso Reparto).";
        }

        var (maxDia, maxSemana, _) = await LeerParametrosAsync(ct);
        var avisos = await ValidarMovimientoAsync(
            ruta, request.IdSeleccionHospital, esExtraordinaria: false,
            request.FechaVisita, request.Orden, idVisitaExcluida: null,
            maxDia, maxSemana, esAjuste, ct);

        var transaccionPropia = _context.Database.CurrentTransaction is null;
        await using var tx = transaccionPropia
            ? await _context.Database.BeginTransactionAsync(ct)
            : null;

        var visita = await _rutaRepository.AddVisitaAsync(new RutaVisita
        {
            IdRuta = ruta.IdRuta,
            IdSeleccionHospital = request.IdSeleccionHospital,
            IdHospital = hospital.IdHospital,
            IdTipoVisita = request.IdTipoVisita,
            IdEjecutivo = hospital.IdEjecutivo ?? idEjecutivoRegion,
            IdEspecialista = ruta.IdEspecialista ?? idEspecialistaRegion,
            FechaVisita = request.FechaVisita,
            Orden = request.Orden,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        }, ct);

        if (esAjuste)
        {
            await RegistrarAjusteAsync(
                AjustePostCierre.EntidadRutaVisita, visita.IdRutaVisita, AjustePostCierre.AccionAltaVisita,
                null,
                new { idSeleccionHospital = request.IdSeleccionHospital, fechaVisita = request.FechaVisita, orden = request.Orden },
                request.Motivo!, idUsuario, ct);
        }

        if (transaccionPropia)
        {
            await tx!.CommitAsync(ct);
        }


        if (aviso is not null)
        {
            _logger.LogInformation(
                "Alta manual de hospital sin asignación completa en reparto. IdSeleccionHospital {IdSeleccionHospital} agregado a la ruta {IdRuta} por el usuario {IdUsuario}. {Aviso}",
                request.IdSeleccionHospital, ruta.IdRuta, idUsuario, aviso);
        }
        var dto = await ArmarVisitaDtoAsync(visita, ct);
        dto.Aviso = aviso;
        dto.Avisos = avisos;
        return dto;
    }

    /// <summary>
    /// Alta de visita extraordinaria (ADR-00011): hospital del catálogo fuera de la selección,
    /// en la versión activa Cerrada, con get-or-create de la ruta del equipo.
    /// </summary>
    public async Task<RutaVisitaDto> AgregarVisitaExtraordinariaAsync(
        int idSeleccionMensual,
        VisitaExtraordinariaRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        await ValidarPermisoAjusteAsync(idUsuario, ct);

        var version = await _rutaRepository.GetVersionMaximaAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException("No hay versiones de rutas en esta selección.");

        if (version.Estado != RutaVersion.EstadoCerrada)
        {
            throw new InvalidOperationException(
                $"Las visitas extraordinarias se agregan a la versión activa Cerrada (estado actual: {version.Estado}).");
        }

        var hospital = await _hospitalRepository.GetByIdAsync(request.IdHospital, ct)
            ?? throw new InvalidOperationException($"El hospital {request.IdHospital} no existe en el catálogo.");

        if (request.FechaVisita.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
        {
            throw new InvalidOperationException("Las visitas solo pueden caer en días laborales (Lun–Vie).");
        }

        await ValidarLimiteTemporalAsync(request.FechaVisita, ct);

        var ruta = (await _rutaRepository.GetBySeleccionAsync(idSeleccionMensual, version.Version, ct))
            .FirstOrDefault(r => r.IdEquipo == request.IdEquipo);

        if (ruta is null)
        {
            ruta = await _rutaRepository.CreateAsync(new Ruta
            {
                IdSeleccionMensual = idSeleccionMensual,
                IdEquipo = request.IdEquipo,
                Version = version.Version,
                IdRutaVersion = version.IdRutaVersion,
                Estado = Ruta.EstadoCerrada,
                Nombre = "Ruta extraordinaria",
                FechaConfirmacion = DateTime.UtcNow,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario,
            }, ct);

            _logger.LogInformation(
                "Ruta get-or-create para el equipo {IdEquipo} en la versión v{Version} de la selección {IdSeleccion} (visita extraordinaria).",
                request.IdEquipo, version.Version, idSeleccionMensual);
        }
        else if (ruta.Estado != Ruta.EstadoCerrada)
        {
            throw new InvalidOperationException(
                $"La ruta del equipo {request.IdEquipo} no está confirmada (estado actual: {ruta.Estado}).");
        }

        var visitasRuta = await _rutaRepository.GetVisitasAsync(ruta.IdRuta, ct);
        var orden = request.Orden ?? visitasRuta
            .Where(v => v.FechaVisita == request.FechaVisita)
            .Select(v => v.Orden)
            .DefaultIfEmpty(0)
            .Max() + 1;

        var (maxDia, maxSemana, _) = await LeerParametrosAsync(ct);
        var avisos = await ValidarMovimientoAsync(
            ruta, idSeleccionHospital: null, esExtraordinaria: true,
            request.FechaVisita, orden, idVisitaExcluida: null,
            maxDia, maxSemana, modoAjuste: true, ct);

        await using var tx = await _context.Database.BeginTransactionAsync(ct);

        var visita = await _rutaRepository.AddVisitaAsync(new RutaVisita
        {
            IdRuta = ruta.IdRuta,
            IdSeleccionHospital = null,
            IdHospital = request.IdHospital,
            FechaVisita = request.FechaVisita,
            Orden = orden,
            EsExtraordinaria = true,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        }, ct);

        await RegistrarAjusteAsync(
            AjustePostCierre.EntidadRutaVisita, visita.IdRutaVisita, AjustePostCierre.AccionAltaVisita,
            null,
            new { idHospital = request.IdHospital, fechaVisita = request.FechaVisita, orden, esExtraordinaria = true },
            request.Motivo, idUsuario, ct);

        await tx.CommitAsync(ct);

        _logger.LogInformation(
            "Visita extraordinaria {IdRutaVisita} (hospital {IdHospital}) agregada a la ruta {IdRuta} por el usuario {IdUsuario}.",
            visita.IdRutaVisita, request.IdHospital, ruta.IdRuta, idUsuario);

        var dto = await ArmarVisitaDtoAsync(visita, ct);
        dto.Aviso = $"Visita extraordinaria: {hospital.NombreContacto ?? $"Hospital {request.IdHospital}"}";
        dto.Avisos = avisos;
        return dto;
    }

    public async Task QuitarVisitaAsync(
        int idRuta,
        int idRutaVisita,
        string? motivo,
        int idUsuario,
        CancellationToken ct = default)
    {
        var ruta = await ObtenerRutaAsync(idRuta, ct);

        var visita = await _rutaRepository.GetVisitaByIdAsync(idRutaVisita, ct)
            ?? throw new InvalidOperationException($"La visita {idRutaVisita} no existe.");

        if (visita.IdRuta != idRuta)
        {
            throw new InvalidOperationException($"La visita {idRutaVisita} no pertenece a la ruta {idRuta}.");
        }

        var esAjuste = ruta.Estado == Ruta.EstadoCerrada;
        if (esAjuste)
        {
            await ValidarPermisoAjusteAsync(idUsuario, ct);
            ValidarMotivoAjuste(motivo);
            await ValidarLimiteTemporalAsync(visita.FechaVisita, ct);
        }
        else
        {
            await ValidarRutaEditableAsync(ruta, ct);
        }

        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        await _rutaRepository.RemoveVisitaAsync(visita, ct);

        if (esAjuste)
        {
            await RegistrarAjusteAsync(
                AjustePostCierre.EntidadRutaVisita, visita.IdRutaVisita, AjustePostCierre.AccionBajaVisita,
                new
                {
                    idSeleccionHospital = visita.IdSeleccionHospital,
                    idHospital = visita.IdHospital,
                    fechaVisita = visita.FechaVisita,
                    orden = visita.Orden,
                    esExtraordinaria = visita.EsExtraordinaria,
                },
                null, motivo!, idUsuario, ct);
        }

        await tx.CommitAsync(ct);
    }

    public async Task<List<RutaDto>> CancelarAsync(
        int idSeleccionMensual,
        CancelarRutasRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        _ = await _seleccionRepository.GetByIdAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException("La selección solicitada no existe.");

        var version = await _rutaRepository.GetVersionMaximaAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException("No hay versiones de rutas que cancelar.");

        if (version.Estado is RutaVersion.EstadoCancelada or RutaVersion.EstadoArchivada)
        {
            throw new InvalidOperationException($"La versión v{version.Version} está {version.Estado.ToLowerInvariant()} y no se puede cancelar.");
        }

        await using var tx = await _context.Database.BeginTransactionAsync(ct);

        var estadoAnterior = version.Estado;
        await AplicarEstadoVersionAsync(version, RutaVersion.EstadoCancelada, idUsuario, ct);

        // El motivo deja de perderse en logs: queda persistido en la bitácora de ajustes (ADR-00010, decisión 8).
        await RegistrarAjusteAsync(
            AjustePostCierre.EntidadRutaVersion, version.IdRutaVersion, AjustePostCierre.AccionCancelarVersion,
            new { estado = estadoAnterior },
            new { estado = RutaVersion.EstadoCancelada },
            request.Motivo, idUsuario, ct);

        await tx.CommitAsync(ct);

        _logger.LogInformation(
            "Versión de rutas v{Version} de la selección {IdSeleccion} cancelada por el usuario {IdUsuario}. Motivo: {Motivo}",
            version.Version, idSeleccionMensual, idUsuario, request.Motivo);

        var rutas = await _rutaRepository.GetBySeleccionAsync(idSeleccionMensual, version.Version, ct);
        return await ArmarDetalleAsync(rutas, null, ct);
    }

    /// <summary>Escribe el estado de negocio en la versión y lo sincroniza en sus filas de rutas.</summary>
    private async Task AplicarEstadoVersionAsync(RutaVersion version, string estado, int idUsuario, CancellationToken ct)
    {
        version.Estado = estado;
        version.IdUsuarioModificacion = idUsuario;
        version.FechaConfirmacion = estado == RutaVersion.EstadoCerrada
            ? (version.FechaConfirmacion ?? DateTime.UtcNow)
            : null;
        await _rutaRepository.UpdateVersionAsync(version, ct);

        var estadoRuta = estado switch
        {
            RutaVersion.EstadoCerrada => Ruta.EstadoCerrada,
            RutaVersion.EstadoRechazada => Ruta.EstadoRechazada,
            RutaVersion.EstadoCancelada => Ruta.EstadoCancelada,
            RutaVersion.EstadoArchivada => Ruta.EstadoArchivada,
            _ => Ruta.EstadoCreada,
        };

        var rutas = await _rutaRepository.GetBySeleccionAsync(version.IdSeleccionMensual, version.Version, ct);
        foreach (var ruta in rutas)
        {
            ruta.Estado = estadoRuta;
            ruta.FechaConfirmacion = estado == RutaVersion.EstadoCerrada
                ? (ruta.FechaConfirmacion ?? DateTime.UtcNow)
                : null;
            ruta.IdUsuarioModificacion = idUsuario;
            await _rutaRepository.UpdateAsync(ruta, ct);
        }
    }

    public async Task<List<AsignacionDto>> GetAsignacionesAsync(
        int idUsuario,
        DateOnly? desde = null,
        DateOnly? hasta = null,
        CancellationToken ct = default)
    {
        var equipos = await _equipoRepository.GetAllAsync(null, ct);
        var idsEquipos = equipos
            .Where(e => e.Activo && (e.IdEjecutivo == idUsuario || e.IdEspecialista == idUsuario))
            .Select(e => e.IdEquipo)
            .ToList();

        if (idsEquipos.Count == 0)
        {
            return [];
        }

        var rutas = await _rutaRepository.GetConfirmadasPorEquiposAsync(idsEquipos, ct);
        if (rutas.Count == 0)
        {
            return [];
        }

        var hoy = DateOnly.FromDateTime(DateTime.Today);
        var hospitalesSeleccion = new Dictionary<int, SeleccionHospital>();
        var regionesPorSeleccion = new Dictionary<int, Dictionary<int, string>>();
        var seleccionesVigentes = new HashSet<int>();
        foreach (var idSeleccion in rutas.Select(r => r.IdSeleccionMensual).Distinct())
        {
            // Solo la planeación vigente o próxima ("mis hospitales del mes"), no selecciones vencidas:
            // la selección recién autorizada puede empezar su vigencia en los próximos días y es la que se trabaja.
            var seleccion = await _seleccionRepository.GetByIdAsync(idSeleccion, ct);
            if (seleccion is null || hoy > seleccion.FechaFinVigencia)
            {
                continue;
            }

            seleccionesVigentes.Add(idSeleccion);
            hospitalesSeleccion = hospitalesSeleccion.Union(
                (await _seleccionRepository.GetHospitalesAsync(idSeleccion, ct))
                    .ToDictionary(h => h.IdSeleccionHospital))
                .ToDictionary(kv => kv.Key, kv => kv.Value);

            regionesPorSeleccion[idSeleccion] = (await _seleccionRepository.GetRegionesAsync(idSeleccion, ct))
                .ToDictionary(r => r.IdRegion, r => r.Nombre ?? $"Región {r.IdRegion}");
        }

        if (seleccionesVigentes.Count == 0)
        {
            return [];
        }

        rutas = rutas.Where(r => seleccionesVigentes.Contains(r.IdSeleccionMensual)).ToList();

        var visitasPorRuta = new Dictionary<int, List<RutaVisita>>();
        foreach (var ruta in rutas)
        {
            visitasPorRuta[ruta.IdRuta] = await _rutaRepository.GetVisitasAsync(ruta.IdRuta, ct);
        }

        var idsAsokam = hospitalesSeleccion.Values
            .Where(h => h.IdHospital.HasValue)
            .Select(h => h.IdHospital!.Value)
            .Concat(visitasPorRuta.Values.SelectMany(v => v)
                .Where(v => v.EsExtraordinaria && v.IdHospital.HasValue)
                .Select(v => v.IdHospital!.Value))
            .Distinct()
            .ToList();

        var hospitalesAsokam = idsAsokam.Count > 0
            ? await _hospitalRepository.GetByIdsAsync(idsAsokam, ct)
            : [];
        var hospitalesAsokamPorId = hospitalesAsokam.ToDictionary(h => h.CodigoContacto);
        var nombresHospitales = hospitalesAsokam
            .ToDictionary(h => h.CodigoContacto, h => h.NombreContacto ?? $"Hospital {h.CodigoContacto}");

        var idsInstituciones = hospitalesAsokam
            .Where(h => h.CodigoContactoPrincipal.HasValue)
            .Select(h => h.CodigoContactoPrincipal!.Value)
            .Distinct()
            .ToList();
        var instituciones = idsInstituciones.Count > 0
            ? await _hospitalRepository.GetByIdsAsync(idsInstituciones, ct)
            : [];
        var nombresInstituciones = instituciones
            .ToDictionary(h => h.CodigoContacto, h => h.NombreContacto ?? $"Institución {h.CodigoContacto}");
        var institucionPorHospital = hospitalesAsokam
            .Where(h => h.CodigoContactoPrincipal.HasValue
                && nombresInstituciones.ContainsKey(h.CodigoContactoPrincipal.Value))
            .ToDictionary(h => h.CodigoContacto, h => nombresInstituciones[h.CodigoContactoPrincipal!.Value]);

        var nombresEstados = await EducacionMedicaNombres.ResolverEstadosAsync(
            _asokamContext, hospitalesSeleccion.Values.Select(h => h.EntidadFederativa), ct);

        var asignaciones = new List<AsignacionDto>();
        foreach (var ruta in rutas)
        {
            foreach (var visita in visitasPorRuta[ruta.IdRuta])
            {
                if (desde.HasValue && visita.FechaVisita < desde.Value)
                {
                    continue;
                }

                if (hasta.HasValue && visita.FechaVisita > hasta.Value)
                {
                    continue;
                }

                var hospital = visita.IdSeleccionHospital.HasValue
                    ? hospitalesSeleccion.GetValueOrDefault(visita.IdSeleccionHospital.Value)
                    : null;
                var idHospital = hospital?.IdHospital ?? visita.IdHospital;
                var hospitalAsokam = idHospital.HasValue
                    ? hospitalesAsokamPorId.GetValueOrDefault(idHospital.Value)
                    : null;
                asignaciones.Add(new AsignacionDto
                {
                    IdRutaVisita = visita.IdRutaVisita,
                    IdRuta = ruta.IdRuta,
                    NombreRuta = ruta.Nombre,
                    IdSeleccionMensual = ruta.IdSeleccionMensual,
                    IdSeleccionHospital = visita.IdSeleccionHospital,
                    FechaVisita = visita.FechaVisita,
                    Orden = visita.Orden,
                    HoraSalida = visita.HoraSalida,
                    HoraLlegada = visita.HoraLlegada,
                    IdHospital = idHospital,
                    NombreHospital = idHospital.HasValue
                        ? nombresHospitales.GetValueOrDefault(idHospital.Value, $"Hospital {idHospital}")
                        : null,
                    NombreRegion = hospital?.IdRegion.HasValue == true
                        ? regionesPorSeleccion.GetValueOrDefault(ruta.IdSeleccionMensual)?.GetValueOrDefault(hospital.IdRegion.Value)
                        : null,
                    EntidadFederativa = hospital?.EntidadFederativa is { } entidad
                        ? nombresEstados.GetValueOrDefault(entidad, entidad)
                        : null,
                    CiudadMunicipio = hospital?.CiudadMunicipio,
                    Institucion = idHospital.HasValue
                        ? institucionPorHospital.GetValueOrDefault(idHospital.Value)
                        : null,
                    EsExtraordinaria = visita.EsExtraordinaria,
                    Latitud = hospital?.LatitudSnapshot ?? hospitalAsokam?.Latitud,
                    Longitud = hospital?.LongitudSnapshot ?? hospitalAsokam?.Longitud,
                    Calle = hospitalAsokam?.Calle,
                    Colonia = hospitalAsokam?.Colonia,
                    CodigoPostal = hospitalAsokam?.Cp,
                    Email = hospitalAsokam?.Email,
                });
            }
        }

        return asignaciones.OrderBy(a => a.FechaVisita).ThenBy(a => a.Orden).ToList();
    }

    /// <summary>
    /// Hospitales elegibles para la captura asistida (ADR-00011): hospitales de la selección
    /// del equipo elegido cuya ruta está Cerrada, con snapshots para el buscador.
    /// </summary>
    public async Task<List<HospitalElegibleDto>> GetHospitalesElegiblesAsync(int idEquipo, CancellationToken ct = default)
    {
        var rutas = (await _rutaRepository.GetByEquipoAsync(idEquipo, ct))
            .Where(r => r.Estado == Ruta.EstadoCerrada)
            .ToList();

        if (rutas.Count == 0)
        {
            return [];
        }

        var resultado = new List<HospitalElegibleDto>();
        var idsHospitales = new HashSet<int>();

        foreach (var ruta in rutas)
        {
            var hospitales = (await _seleccionRepository.GetHospitalesAsync(ruta.IdSeleccionMensual, ct))
                .ToDictionary(h => h.IdSeleccionHospital);
            var visitas = await _rutaRepository.GetVisitasAsync(ruta.IdRuta, ct);

            foreach (var visita in visitas)
            {
                if (visita.EsExtraordinaria || !visita.IdSeleccionHospital.HasValue)
                {
                    continue;
                }

                var hospital = hospitales.GetValueOrDefault(visita.IdSeleccionHospital.Value);
                if (hospital is null)
                {
                    continue;
                }

                if (hospital.IdHospital.HasValue)
                {
                    idsHospitales.Add(hospital.IdHospital.Value);
                }

                resultado.Add(new HospitalElegibleDto
                {
                    IdSeleccionHospital = hospital.IdSeleccionHospital,
                    IdSeleccionMensual = ruta.IdSeleccionMensual,
                    IdHospital = hospital.IdHospital,
                    Region = hospital.Region,
                    EntidadFederativa = hospital.EntidadFederativa,
                    CiudadMunicipio = hospital.CiudadMunicipio,
                    IdRuta = ruta.IdRuta,
                    FechaVisita = visita.FechaVisita,
                });
            }
        }

        var nombres = idsHospitales.Count > 0
            ? (await _hospitalRepository.GetByIdsAsync(idsHospitales, ct))
                .ToDictionary(h => h.CodigoContacto, h => h.NombreContacto ?? $"Hospital {h.CodigoContacto}")
            : new Dictionary<int, string>();

        foreach (var elegible in resultado)
        {
            elegible.NombreHospital = elegible.IdHospital.HasValue
                ? nombres.GetValueOrDefault(elegible.IdHospital.Value, $"Hospital {elegible.IdHospital}")
                : null;
        }

        return resultado
            .OrderBy(e => e.FechaVisita)
            .ThenBy(e => e.NombreHospital)
            .ToList();
    }

    private async Task<(int MaxDia, int MaxSemana, int MaxForaneos)> LeerParametrosAsync(CancellationToken ct)
    {
        var parametros = await _parametroRepository.GetAllAsync(ct);
        var maxDia = (int)(parametros.FirstOrDefault(p => p.Clave == "max_visitas_dia")?.Valor
            ?? CapacidadPeriodo.MaxVisitasPorDia);
        var maxSemana = (int)(parametros.FirstOrDefault(p => p.Clave == "max_visitas_semana")?.Valor
            ?? CapacidadPeriodo.MaxVisitasPorSemana);
        var maxForaneos = (int)(parametros.FirstOrDefault(p => p.Clave == "max_viajes_foraneos_mes")?.Valor
            ?? MaxViajesForaneosPorMesDefault);
        return (maxDia, maxSemana, maxForaneos);
    }

    private static int? EspecialistaEfectivo(
        SeleccionHospital hospital,
        IReadOnlyDictionary<int, SeleccionRegion> regiones)
        => hospital.IdEspecialista
            ?? (hospital.IdRegion.HasValue
                ? regiones.GetValueOrDefault(hospital.IdRegion.Value)?.IdEspecialista
                : null);

    private static List<RutaVisita> DistribuirEnDias(
        Ruta ruta,
        List<SeleccionHospital> hospitales,
        DateOnly inicio,
        DateOnly fin,
        int maxVisitasPorDia,
        int maxVisitasPorSemana,
        int idUsuario,
        bool agruparPorCiudad,
        int? idEspecialista = null,
        Func<SeleccionHospital, int?>? idEjecutivoSelector = null)
    {
        // Dos criterios deterministas:
        //  - "ciudad": bloques por localidad (vecino más cercano entre ciudades de la región).
        //  - "centroide": orden clásico por distancia al centroide regional (compacta días
        //    aunque mezcle ciudades).
        var ordenados = agruparPorCiudad
            ? OrdenarPorLocalidad(hospitales)
            : OrdenarPorCentroideRegional(hospitales);

        var visitas = new List<RutaVisita>();
        var siguiente = 0;
        var fecha = inicio;
        var visitasSemana = new Dictionary<(int Anio, int Semana), int>();

        while (siguiente < ordenados.Count && fecha <= fin)
        {
            if (fecha.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            {
                fecha = fecha.AddDays(1);
                continue;
            }

            var dt = fecha.ToDateTime(TimeOnly.MinValue);
            var clave = (System.Globalization.ISOWeek.GetYear(dt), System.Globalization.ISOWeek.GetWeekOfYear(dt));
            visitasSemana.TryAdd(clave, 0);

            var usadosDia = 0;
            while (siguiente < ordenados.Count)
            {
                var restanteDia = maxVisitasPorDia - usadosDia;
                var restanteSemana = maxVisitasPorSemana - visitasSemana[clave];
                if (restanteDia <= 0 || restanteSemana <= 0)
                {
                    break;
                }

                // Bloque = hospitales consecutivos de la misma localidad (solo en modo ciudad).
                var bloque = agruparPorCiudad ? ContarBloqueLocalidad(ordenados, siguiente) : 1;

                // Mantener la ciudad junta: si el bloque no cabe en lo que queda del día pero
                // cabría en un día fresco, se pasa al siguiente día en vez de fragmentar la ciudad.
                if (bloque > restanteDia && usadosDia > 0 && bloque <= maxVisitasPorDia)
                {
                    break;
                }

                var paraHoy = Math.Min(Math.Min(bloque, restanteDia), restanteSemana);
                for (var k = 0; k < paraHoy; k++)
                {
                    var hospital = ordenados[siguiente++];
                    visitas.Add(new RutaVisita
                    {
                        IdRuta = ruta.IdRuta,
                        IdSeleccionHospital = hospital.IdSeleccionHospital,
                        IdHospital = hospital.IdHospital,
                        IdEjecutivo = idEjecutivoSelector?.Invoke(hospital),
                        IdEspecialista = idEspecialista,
                        FechaVisita = fecha,
                        Orden = usadosDia + k + 1,
                        IdUsuarioCreacion = idUsuario,
                        IdUsuarioModificacion = idUsuario,
                    });

                    visitasSemana[clave]++;
                }

                usadosDia += paraHoy;
            }

            fecha = fecha.AddDays(1);
        }

        return visitas;
    }

    private static string ClaveLocalidad(SeleccionHospital h)
    {
        var entidad = (h.EntidadFederativa ?? string.Empty).Trim().ToUpperInvariant();
        var ciudad = (h.CiudadMunicipio ?? string.Empty).Trim().ToUpperInvariant();
        if (entidad.Length == 0 && ciudad.Length == 0)
        {
            return $"#sin-ubicacion-{h.IdSeleccionHospital}";
        }
        return $"{entidad}|{ciudad}";
    }

    private static int ContarBloqueLocalidad(List<SeleccionHospital> ordenados, int desde)
    {
        var bloque = 1;
        while (desde + bloque < ordenados.Count
            && ClaveLocalidad(ordenados[desde + bloque]) == ClaveLocalidad(ordenados[desde]))
        {
            bloque++;
        }
        return bloque;
    }

    /// <summary>Criterio original: regiones en orden y hospitales por cercanía al centroide regional.</summary>
    private static List<SeleccionHospital> OrdenarPorCentroideRegional(List<SeleccionHospital> hospitales)
    {
        var centroides = hospitales
            .GroupBy(h => h.IdRegion!.Value)
            .ToDictionary(
                g => g.Key,
                g => (
                    Lat: g.Where(h => h.LatitudSnapshot.HasValue).Select(h => (double)h.LatitudSnapshot!.Value).DefaultIfEmpty(0).Average(),
                    Lon: g.Where(h => h.LongitudSnapshot.HasValue).Select(h => (double)h.LongitudSnapshot!.Value).DefaultIfEmpty(0).Average()));

        return hospitales
            .OrderBy(h => h.IdRegion)
            .ThenBy(h => h.LatitudSnapshot.HasValue && h.LongitudSnapshot.HasValue && centroides.TryGetValue(h.IdRegion!.Value, out var c)
                ? Haversine.DistanciaKm(c.Lat, c.Lon, (double)h.LatitudSnapshot!.Value, (double)h.LongitudSnapshot!.Value)
                : 0)
            .ThenBy(h => h.IdSeleccionHospital)
            .ToList();
    }

    private static List<SeleccionHospital> OrdenarPorLocalidad(List<SeleccionHospital> hospitales)
    {
        return hospitales
            .GroupBy(h => h.IdRegion ?? int.MaxValue)
            .OrderBy(g => g.Key)
            .SelectMany(OrdenarCiudadesDeRegion)
            .ToList();
    }

    private sealed record CiudadLocal(
        string Clave,
        List<SeleccionHospital> Hospitales,
        double? Lat,
        double? Lon);

    private static IEnumerable<SeleccionHospital> OrdenarCiudadesDeRegion(IEnumerable<SeleccionHospital> hospitalesRegion)
    {
        var lista = hospitalesRegion.ToList();

        var ciudades = lista
            .GroupBy(ClaveLocalidad)
            .Select(g => new CiudadLocal(
                g.Key,
                g.OrderBy(h => h.IdSeleccionHospital).ToList(),
                PromedioCoordenada(g.Select(h => (double?)h.LatitudSnapshot)),
                PromedioCoordenada(g.Select(h => (double?)h.LongitudSnapshot))))
            .ToList();

        if (ciudades.Count == 0)
        {
            return [];
        }

        if (ciudades.Count == 1)
        {
            return OrdenarDentroDeCiudad(ciudades[0]);
        }

        var centroLat = PromedioCoordenada(lista.Select(h => (double?)h.LatitudSnapshot));
        var centroLon = PromedioCoordenada(lista.Select(h => (double?)h.LongitudSnapshot));

        double DistanciaAlCentroide(CiudadLocal c) =>
            c.Lat is null || c.Lon is null || centroLat is null || centroLon is null
                ? double.PositiveInfinity
                : Haversine.DistanciaKm(centroLat.Value, centroLon.Value, c.Lat.Value, c.Lon.Value);

        // Recorrido glotón de vecino más cercano empezando por la ciudad más cercana al centroide.
        var restantes = ciudades
            .OrderBy(DistanciaAlCentroide)
            .ThenBy(c => c.Clave, StringComparer.Ordinal)
            .ToList();

        var orden = new List<CiudadLocal> { restantes[0] };
        restantes.RemoveAt(0);

        while (restantes.Count > 0)
        {
            var ultima = orden[^1];

            double DistanciaDesdeUltima(CiudadLocal c) =>
                ultima.Lat is null || ultima.Lon is null || c.Lat is null || c.Lon is null
                    ? double.PositiveInfinity
                    : Haversine.DistanciaKm(ultima.Lat.Value, ultima.Lon.Value, c.Lat.Value, c.Lon.Value);

            var siguiente = restantes
                .OrderBy(DistanciaDesdeUltima)
                .ThenBy(c => c.Clave, StringComparer.Ordinal)
                .First();

            orden.Add(siguiente);
            restantes.Remove(siguiente);
        }

        return orden.SelectMany(OrdenarDentroDeCiudad);
    }

    private static IEnumerable<SeleccionHospital> OrdenarDentroDeCiudad(CiudadLocal ciudad)
    {
        if (ciudad.Lat is null || ciudad.Lon is null)
        {
            return ciudad.Hospitales;
        }

        return ciudad.Hospitales
            .OrderBy(h => h.LatitudSnapshot is not null && h.LongitudSnapshot is not null
                ? Haversine.DistanciaKm(
                    ciudad.Lat.Value, ciudad.Lon.Value,
                    (double)h.LatitudSnapshot.Value, (double)h.LongitudSnapshot.Value)
                : 0)
            .ThenBy(h => h.IdSeleccionHospital);
    }

    private static double? PromedioCoordenada(IEnumerable<double?> valores)
    {
        var conValor = valores.Where(v => v.HasValue).Select(v => v!.Value).ToList();
        return conValor.Count == 0 ? null : conValor.Average();
    }

    private async Task<Ruta> ObtenerRutaAsync(int idRuta, CancellationToken ct)
    {
        return await _rutaRepository.GetByIdAsync(idRuta, ct)
            ?? throw new InvalidOperationException($"La ruta {idRuta} no existe.");
    }

    private Task ValidarRutaEditableAsync(Ruta ruta, CancellationToken ct)
    {
        if (ruta.Estado != Ruta.EstadoCreada)
        {
            throw new InvalidOperationException(
                $"Solo una ruta en Creada es editable (estado actual: {ruta.Estado}).");
        }

        return Task.CompletedTask;
    }

    private async Task<List<string>> ValidarMovimientoAsync(
        Ruta ruta,
        int? idSeleccionHospital,
        bool esExtraordinaria,
        DateOnly fechaVisita,
        int orden,
        int? idVisitaExcluida,
        int maxVisitasPorDia,
        int maxVisitasPorSemana,
        bool modoAjuste,
        CancellationToken ct)
    {
        if (fechaVisita.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
        {
            throw new InvalidOperationException("Las visitas solo pueden caer en días laborales (Lun–Vie).");
        }

        if (orden < 1)
        {
            throw new InvalidOperationException("El orden debe ser mayor a cero.");
        }

        var avisos = new List<string>();

        var rutasMismaVersion = (await _rutaRepository.GetBySeleccionAsync(ruta.IdSeleccionMensual, ruta.Version, ct))
            .Where(r => r.Estado is Ruta.EstadoCreada or Ruta.EstadoCerrada)
            .ToList();

        foreach (var otra in rutasMismaVersion)
        {
            var visitas = await _rutaRepository.GetVisitasAsync(otra.IdRuta, ct);

            if (!esExtraordinaria
                && idSeleccionHospital.HasValue
                && otra.IdRuta != ruta.IdRuta
                && visitas.Any(v => !v.EsExtraordinaria
                    && v.IdSeleccionHospital == idSeleccionHospital.Value
                    && v.IdRutaVisita != idVisitaExcluida))
            {
                throw new InvalidOperationException("Ese hospital ya tiene una visita en otra ruta de la versión actual.");
            }

            if (otra.IdRuta == ruta.IdRuta)
            {
                if (visitas.Any(v => v.FechaVisita == fechaVisita && v.Orden == orden && v.IdRutaVisita != idVisitaExcluida))
                {
                    throw new InvalidOperationException($"El día {fechaVisita:dd/MM} ya tiene una visita en la posición {orden}.");
                }

                var delDia = visitas.Count(v => v.FechaVisita == fechaVisita && v.IdRutaVisita != idVisitaExcluida);
                if (delDia >= maxVisitasPorDia)
                {
                    var mensaje = $"El día {fechaVisita:dd/MM} ya alcanzó el máximo de {maxVisitasPorDia} visitas.";
                    if (modoAjuste) avisos.Add($"{mensaje} (ajuste post-cierre: se permite con motivo).");
                    else throw new InvalidOperationException(mensaje);
                }

                var dt = fechaVisita.ToDateTime(TimeOnly.MinValue);
                var clave = (
                    Anio: System.Globalization.ISOWeek.GetYear(dt),
                    Semana: System.Globalization.ISOWeek.GetWeekOfYear(dt));
                var deLaSemana = visitas
                    .Where(v => v.IdRutaVisita != idVisitaExcluida
                        && System.Globalization.ISOWeek.GetYear(v.FechaVisita.ToDateTime(TimeOnly.MinValue)) == clave.Anio
                        && System.Globalization.ISOWeek.GetWeekOfYear(v.FechaVisita.ToDateTime(TimeOnly.MinValue)) == clave.Semana)
                    .Count();

                if (deLaSemana >= maxVisitasPorSemana)
                {
                    var mensaje = $"La semana {clave.Semana} ya alcanzó el máximo de {maxVisitasPorSemana} visitas.";
                    if (modoAjuste) avisos.Add($"{mensaje} (ajuste post-cierre: se permite con motivo).");
                    else throw new InvalidOperationException(mensaje);
                }
            }
        }

        return avisos;
    }

    // ----- Ajustes post-cierre (ADR-00010) -----

    private async Task ValidarPermisoAjusteAsync(int idUsuario, CancellationToken ct)
    {
        var permisos = await _permissionService.GetPermissionsAsync(idUsuario);
        if (!permisos.Contains(Permissions.EducacionMedica.RutasAjustar))
        {
            throw new InvalidOperationException(
                "No tienes permiso para ajustar documentos cerrados (educacion_medica.rutas.puede_ajustar).");
        }
    }

    private static void ValidarMotivoAjuste(string? motivo)
    {
        if (string.IsNullOrWhiteSpace(motivo))
        {
            throw new InvalidOperationException("El motivo del ajuste post-cierre es obligatorio.");
        }
    }

    /// <summary>Límite temporal del ajuste: la fecha original no puede superar dias_limite_cambio (ADR-00010).</summary>
    private async Task ValidarLimiteTemporalAsync(DateOnly fechaOriginal, CancellationToken ct)
    {
        var parametros = await _parametroRepository.GetAllAsync(ct);
        var diasLimite = (int)(parametros.FirstOrDefault(p => p.Clave == "dias_limite_cambio")?.Valor
            ?? DiasLimiteCambioDefault);

        var hoy = DateOnly.FromDateTime(DateTime.Today);
        if (fechaOriginal < hoy.AddDays(-diasLimite))
        {
            throw new InvalidOperationException(
                $"El ajuste excede el límite de {diasLimite} días (fecha original: {fechaOriginal:dd/MM/yyyy}). Solicita un cambio estructural.");
        }
    }

    private async Task RegistrarAjusteAsync(
        string entidadTipo,
        int idEntidad,
        string accion,
        object? valoresAntes,
        object? valoresDespues,
        string motivo,
        int idUsuario,
        CancellationToken ct)
    {
        _context.AjustesPostCierre.Add(new AjustePostCierre
        {
            EntidadTipo = entidadTipo,
            IdEntidad = idEntidad,
            Accion = accion,
            ValoresAntes = valoresAntes is null ? null : JsonSerializer.Serialize(valoresAntes),
            ValoresDespues = valoresDespues is null ? null : JsonSerializer.Serialize(valoresDespues),
            Motivo = motivo,
            IdUsuario = idUsuario,
            FechaAjuste = DateTime.Now,
        });

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Ajuste post-cierre {Accion} sobre {EntidadTipo} {IdEntidad} por el usuario {IdUsuario}. Motivo: {Motivo}",
            accion, entidadTipo, idEntidad, idUsuario, motivo);
    }

    private async Task<List<RutaDto>> ArmarDetalleAsync(
        List<Ruta> rutas,
        Dictionary<int, bool?>? extensiones,
        CancellationToken ct)
    {
        if (rutas.Count == 0)
        {
            return [];
        }

        var idsEquipos = rutas
            .Where(r => r.IdEquipo.HasValue)
            .Select(r => r.IdEquipo!.Value)
            .Distinct()
            .ToList();
        var equipos = (await _equipoRepository.GetAllAsync(null, ct))
            .Where(e => idsEquipos.Contains(e.IdEquipo))
            .ToDictionary(e => e.IdEquipo, e => $"Equipo {e.IdEquipo}");

        var idsEspecialistas = rutas
            .Where(r => r.IdEspecialista.HasValue)
            .Select(r => r.IdEspecialista!.Value)
            .Distinct()
            .ToList();
        var especialistas = idsEspecialistas.Count == 0
            ? new Dictionary<int, string>()
            : await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => idsEspecialistas.Contains(u.IdUsuario))
                .ToDictionaryAsync(
                    u => u.IdUsuario,
                    u => u.NombreCompleto ?? $"Especialista {u.IdUsuario}",
                    ct);

        var idsSeleccion = rutas.Select(r => r.IdSeleccionMensual).Distinct().ToList();
        var nombresHospitalesPorSeleccion = new Dictionary<int, Dictionary<int, string>>();
        var regionesPorSeleccion = new Dictionary<int, Dictionary<int, string>>();
        var hospitalesPorSeleccion = new Dictionary<int, Dictionary<int, SeleccionHospital>>();

        foreach (var idSeleccion in idsSeleccion)
        {
            var hospitales = await _seleccionRepository.GetHospitalesAsync(idSeleccion, ct);
            hospitalesPorSeleccion[idSeleccion] = hospitales.ToDictionary(h => h.IdSeleccionHospital);
            regionesPorSeleccion[idSeleccion] = (await _seleccionRepository.GetRegionesAsync(idSeleccion, ct))
                .ToDictionary(r => r.IdRegion, r => r.Nombre ?? $"Región {r.IdRegion}");

            var idsAsokam = hospitales
                .Where(h => h.IdHospital.HasValue)
                .Select(h => h.IdHospital!.Value)
                .Distinct()
                .ToList();

            nombresHospitalesPorSeleccion[idSeleccion] = idsAsokam.Count > 0
                ? (await _hospitalRepository.GetByIdsAsync(idsAsokam, ct))
                    .ToDictionary(h => h.CodigoContacto, h => h.NombreContacto ?? $"Hospital {h.CodigoContacto}")
                : new Dictionary<int, string>();
        }

        var detalle = new List<RutaDto>();
        foreach (var ruta in rutas)
        {
            var visitas = await _rutaRepository.GetVisitasAsync(ruta.IdRuta, ct);
            var hospitales = hospitalesPorSeleccion[ruta.IdSeleccionMensual];
            var regiones = regionesPorSeleccion[ruta.IdSeleccionMensual];
            var nombres = nombresHospitalesPorSeleccion[ruta.IdSeleccionMensual];

            detalle.Add(new RutaDto
            {
                IdRuta = ruta.IdRuta,
                IdSeleccionMensual = ruta.IdSeleccionMensual,
                IdEquipo = ruta.IdEquipo ?? 0,
                NombreEquipo = ruta.IdEspecialista.HasValue
                    ? especialistas.GetValueOrDefault(
                        ruta.IdEspecialista.Value, $"Especialista {ruta.IdEspecialista.Value}")
                    : ruta.IdEquipo.HasValue
                        ? equipos.GetValueOrDefault(ruta.IdEquipo.Value, $"Equipo {ruta.IdEquipo.Value}")
                        : "Sin equipo",
                IdEspecialista = ruta.IdEspecialista,
                NombreEspecialista = ruta.IdEspecialista.HasValue
                    ? especialistas.GetValueOrDefault(
                        ruta.IdEspecialista.Value, $"Especialista {ruta.IdEspecialista.Value}")
                    : null,
                Version = ruta.Version,
                Nombre = ruta.Nombre,
                Estado = ruta.Estado,
                FechaConfirmacion = ruta.FechaConfirmacion,
                Visitas = visitas
                    .Select(v => ArmarVisitaDto(v, hospitales, regiones, nombres, extensiones))
                    .ToList(),
            });
        }

        return detalle;
    }

    private async Task<RutaVisitaDto> ArmarVisitaDtoAsync(RutaVisita visita, CancellationToken ct)
    {
        var ruta = await _rutaRepository.GetByIdAsync(visita.IdRuta, ct)
            ?? throw new InvalidOperationException($"La ruta {visita.IdRuta} no existe.");

        var hospitales = (await _seleccionRepository.GetHospitalesAsync(ruta.IdSeleccionMensual, ct))
            .ToDictionary(h => h.IdSeleccionHospital);
        var regiones = (await _seleccionRepository.GetRegionesAsync(ruta.IdSeleccionMensual, ct))
            .ToDictionary(r => r.IdRegion, r => r.Nombre ?? $"Región {r.IdRegion}");

        string? nombreHospital = null;
        Hospital? hospitalAsokam = null;
        if (visita.IdHospital.HasValue)
        {
            hospitalAsokam = await _hospitalRepository.GetByIdAsync(visita.IdHospital.Value, ct);
            nombreHospital = hospitalAsokam?.NombreContacto ?? $"Hospital {visita.IdHospital}";
        }

        var esForanea = visita.IdHospital.HasValue
            ? (await _extensionRepository.GetByHospitalIdAsync(visita.IdHospital.Value, ct))?.EsZonaMetropolitana != true
            : false;

        var dto = ArmarVisitaDto(
            visita,
            hospitales,
            regiones,
            new Dictionary<int, string> { [visita.IdHospital ?? 0] = nombreHospital ?? string.Empty },
            esForanea ? null : new Dictionary<int, bool?> { [visita.IdHospital ?? 0] = true },
            nombreHospitalForzado: nombreHospital);

        if (!dto.Latitud.HasValue)
        {
            dto.Latitud = hospitalAsokam?.Latitud;
            dto.Longitud = hospitalAsokam?.Longitud;
        }

        return dto;
    }

    private static RutaVisitaDto ArmarVisitaDto(
        RutaVisita visita,
        Dictionary<int, SeleccionHospital> hospitales,
        Dictionary<int, string> regiones,
        Dictionary<int, string> nombresHospitales,
        Dictionary<int, bool?>? extensiones,
        string? nombreHospitalForzado = null)
    {
        var hospital = visita.IdSeleccionHospital.HasValue
            ? hospitales.GetValueOrDefault(visita.IdSeleccionHospital.Value)
            : null;
        var esForanea = visita.IdHospital.HasValue
            ? extensiones?.GetValueOrDefault(visita.IdHospital.Value) != true
            : false;

        return new RutaVisitaDto
        {
            IdRutaVisita = visita.IdRutaVisita,
            IdRuta = visita.IdRuta,
            IdSeleccionHospital = visita.IdSeleccionHospital,
            IdHospital = visita.IdHospital,
            IdEjecutivo = visita.IdEjecutivo,
            IdEspecialista = visita.IdEspecialista,
            IdTipoVisita = visita.IdTipoVisita,
            NombreHospital = nombreHospitalForzado
                ?? (visita.IdHospital.HasValue
                    ? nombresHospitales.GetValueOrDefault(visita.IdHospital.Value, $"Hospital {visita.IdHospital}")
                    : null),
            FechaVisita = visita.FechaVisita,
            Orden = visita.Orden,
            HoraSalida = visita.HoraSalida,
            HoraLlegada = visita.HoraLlegada,
            EsForanea = esForanea,
            EsExtraordinaria = visita.EsExtraordinaria,
            IdRegion = hospital?.IdRegion,
            NombreRegion = hospital?.IdRegion.HasValue == true
                ? regiones.GetValueOrDefault(hospital.IdRegion.Value)
                : null,
            EntidadFederativa = hospital?.EntidadFederativa,
            CiudadMunicipio = hospital?.CiudadMunicipio,
            Latitud = hospital?.LatitudSnapshot,
            Longitud = hospital?.LongitudSnapshot,
        };
    }
}
