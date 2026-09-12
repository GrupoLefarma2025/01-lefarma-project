using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.EducacionMedica.Services;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.EducacionMedica;

public class RutasService : IRutasService
{
    public const string EstrategiaCiudad = "ciudad";
    public const string EstrategiaCentroide = "centroide";

    private const int MaxViajesForaneosPorMesDefault = 3;

    private readonly IRutaRepository _rutaRepository;
    private readonly ISeleccionMensualRepository _seleccionRepository;
    private readonly IEquipoPareoRepository _equipoRepository;
    private readonly IHospitalRepository _hospitalRepository;
    private readonly IHospitalExtensionRepository _extensionRepository;
    private readonly IParametroModuloRepository _parametroRepository;
    private readonly ILogger<RutasService> _logger;

    public RutasService(
        IRutaRepository rutaRepository,
        ISeleccionMensualRepository seleccionRepository,
        IEquipoPareoRepository equipoRepository,
        IHospitalRepository hospitalRepository,
        IHospitalExtensionRepository extensionRepository,
        IParametroModuloRepository parametroRepository,
        ILogger<RutasService> logger)
    {
        _rutaRepository = rutaRepository;
        _seleccionRepository = seleccionRepository;
        _equipoRepository = equipoRepository;
        _hospitalRepository = hospitalRepository;
        _extensionRepository = extensionRepository;
        _parametroRepository = parametroRepository;
        _logger = logger;
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
            ?? throw new InvalidOperationException($"La selección {idSeleccionMensual} no existe.");

        if (seleccion.Estado != SeleccionMensual.EstadoAutorizada)
        {
            throw new InvalidOperationException(
                $"Solo una selección Autorizada puede planificar rutas (estado actual: {seleccion.Estado}).");
        }

        var rutasExistentes = await _rutaRepository.GetBySeleccionAsync(idSeleccionMensual, null, ct);
        if (rutasExistentes.Any(r => r.Estado == Ruta.EstadoConfirmada))
        {
            throw new InvalidOperationException(
                "Esta selección ya tiene rutas confirmadas. Cancélalas antes de regenerar la propuesta.");
        }

        var regiones = await _seleccionRepository.GetRegionesAsync(idSeleccionMensual, ct);
        var hospitales = await _seleccionRepository.GetHospitalesAsync(idSeleccionMensual, ct);
        var avisos = new List<string>();

        var regionesPorId = regiones.ToDictionary(r => r.IdRegion);
        var conRegion = hospitales
            .Where(h => h.IdRegion.HasValue
                && regionesPorId.TryGetValue(h.IdRegion.Value, out var region)
                && region.IdEquipo.HasValue)
            .ToList();

        var sinPlan = hospitales.Count - conRegion.Count;
        if (sinPlan > 0)
        {
            avisos.Add($"{sinPlan} hospital(es) quedaron sin ruta: no tienen región o su región no tiene equipo asignado.");
        }

        var inicio = seleccion.FechaInicioVigencia ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var fin = seleccion.FechaFinVigencia ?? inicio.AddDays(45);
        var (maxVisitasPorDia, maxVisitasPorSemana, maxViajesForaneos) = await LeerParametrosAsync(ct);
        var capacidad = CapacidadPeriodo.Calcular(inicio, fin, maxVisitasPorDia, maxVisitasPorSemana);

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

        var draftsPrevios = rutasExistentes.Where(r => r.Estado == Ruta.EstadoDraft).ToList();
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

        var version = (await _rutaRepository.GetVersionActualAsync(idSeleccionMensual, ct) ?? 0) + 1;
        var equipos = await _equipoRepository.GetAllAsync(null, ct);
        var nombresEquipos = equipos.ToDictionary(e => e.IdEquipo, e => $"Equipo {e.IdEquipo}");

        var rutasCreadas = new List<Ruta>();
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
                Nombre = $"Ruta Equipo {idEquipo} · v{version}",
                Estado = Ruta.EstadoDraft,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario,
            }, ct);

            var visitas = DistribuirEnDias(ruta, grupoEquipo.ToList(), inicio, fin, maxVisitasPorDia, maxVisitasPorSemana, idUsuario, agruparPorCiudad: estrategia == EstrategiaCiudad);
            foreach (var visita in visitas)
            {
                await _rutaRepository.AddVisitaAsync(visita, ct);
            }

            rutasCreadas.Add(ruta);
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

    public async Task<RutaVisitaDto> MoverVisitaAsync(
        int idRuta,
        int idRutaVisita,
        MoverVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var ruta = await ObtenerRutaEditableAsync(idRuta, ct);
        var visita = await _rutaRepository.GetVisitaByIdAsync(idRutaVisita, ct)
            ?? throw new InvalidOperationException($"La visita {idRutaVisita} no existe.");

        if (visita.IdRuta != idRuta)
        {
            throw new InvalidOperationException($"La visita {idRutaVisita} no pertenece a la ruta {idRuta}.");
        }

        var (maxDia, maxSemana, _) = await LeerParametrosAsync(ct);
        await ValidarMovimientoAsync(ruta, visita.IdSeleccionHospital, request.FechaVisita, request.Orden, visita.IdRutaVisita, maxDia, maxSemana, ct);

        visita.FechaVisita = request.FechaVisita;
        visita.Orden = request.Orden;
        visita.IdUsuarioModificacion = idUsuario;
        await _rutaRepository.UpdateVisitaAsync(visita, ct);

        return await ArmarVisitaDtoAsync(visita, ct);
    }

    public async Task<RutaVisitaDto> AgregarVisitaAsync(
        int idRuta,
        AgregarVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var ruta = await ObtenerRutaEditableAsync(idRuta, ct);

        var hospital = await _seleccionRepository.GetHospitalByIdAsync(request.IdSeleccionHospital, ct)
            ?? throw new InvalidOperationException($"El hospital seleccionado {request.IdSeleccionHospital} no existe.");

        if (hospital.IdSeleccionMensual != ruta.IdSeleccionMensual)
        {
            throw new InvalidOperationException("El hospital no pertenece a la selección de esta ruta.");
        }

        // Frontera zona→equipo: Rutas no reasigna; la asignación vive en el paso Reparto.
        string? aviso = null;
        if (hospital.IdRegion.HasValue)
        {
            var region = await _seleccionRepository.GetRegionByIdAsync(hospital.IdRegion.Value, ct);
            if (region?.IdEquipo is { } idEquipoRegion && idEquipoRegion != ruta.IdEquipo)
            {
                throw new InvalidOperationException(
                    $"Este hospital pertenece a la región \"{region.Nombre ?? $"Región {region.IdRegion}"}\" asignada al equipo {region.IdEquipo}. La asignación región → equipo se corrige en el paso Reparto de la selección.");
            }

            if (region?.IdEquipo is null)
            {
                aviso = $"Alta manual: el hospital no tiene equipo asignado en su región (la región no fue asignada en el paso Reparto).";
            }
        }
        else
        {
            aviso = "Alta manual: el hospital no tiene región asignada en la selección (no fue agrupado en el paso Reparto).";
        }

        var (maxDia, maxSemana, _) = await LeerParametrosAsync(ct);
        await ValidarMovimientoAsync(ruta, request.IdSeleccionHospital, request.FechaVisita, request.Orden, idVisitaExcluida: null, maxDia, maxSemana, ct);

        var visita = await _rutaRepository.AddVisitaAsync(new RutaVisita
        {
            IdRuta = ruta.IdRuta,
            IdSeleccionHospital = request.IdSeleccionHospital,
            IdHospital = hospital.IdHospital,
            FechaVisita = request.FechaVisita,
            Orden = request.Orden,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        }, ct);

        if (aviso is not null)
        {
            _logger.LogInformation(
                "Alta manual de hospital sin asignación completa en reparto. IdSeleccionHospital {IdSeleccionHospital} agregado a la ruta {IdRuta} por el usuario {IdUsuario}. {Aviso}",
                request.IdSeleccionHospital, ruta.IdRuta, idUsuario, aviso);
        }

        var dto = await ArmarVisitaDtoAsync(visita, ct);
        dto.Aviso = aviso;
        return dto;
    }

    public async Task QuitarVisitaAsync(int idRuta, int idRutaVisita, int idUsuario, CancellationToken ct = default)
    {
        _ = await ObtenerRutaEditableAsync(idRuta, ct);

        var visita = await _rutaRepository.GetVisitaByIdAsync(idRutaVisita, ct)
            ?? throw new InvalidOperationException($"La visita {idRutaVisita} no existe.");

        if (visita.IdRuta != idRuta)
        {
            throw new InvalidOperationException($"La visita {idRutaVisita} no pertenece a la ruta {idRuta}.");
        }

        await _rutaRepository.RemoveVisitaAsync(visita, ct);
    }

    public async Task<List<RutaDto>> ConfirmarAsync(int idSeleccionMensual, int idUsuario, CancellationToken ct = default)
    {
        var seleccion = await _seleccionRepository.GetByIdAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException($"La selección {idSeleccionMensual} no existe.");

        if (seleccion.Estado != SeleccionMensual.EstadoAutorizada)
        {
            throw new InvalidOperationException($"Solo una selección Autorizada puede confirmar rutas (estado actual: {seleccion.Estado}).");
        }

        var rutas = await _rutaRepository.GetBySeleccionAsync(idSeleccionMensual, null, ct);
        var versionActual = rutas.Count > 0 ? rutas.Max(r => r.Version) : 0;
        var drafts = rutas.Where(r => r.Version == versionActual && r.Estado == Ruta.EstadoDraft).ToList();

        if (drafts.Count == 0)
        {
            throw new InvalidOperationException("No hay un draft de rutas que confirmar; genera la propuesta primero.");
        }

        var hospitales = await _seleccionRepository.GetHospitalesAsync(idSeleccionMensual, ct);
        var idsPlanificados = new HashSet<int>();
        foreach (var draft in drafts)
        {
            var visitas = await _rutaRepository.GetVisitasAsync(draft.IdRuta, ct);
            foreach (var visita in visitas)
            {
                idsPlanificados.Add(visita.IdSeleccionHospital);
            }
        }

        var faltantes = hospitales.Count(h => !idsPlanificados.Contains(h.IdSeleccionHospital));
        if (faltantes > 0)
        {
            throw new InvalidOperationException(
                $"Cobertura incompleta: {faltantes} hospital(es) de la selección quedan sin visita. Asígnales una ruta o exclúyelos de la selección antes de confirmar.");
        }

        foreach (var draft in drafts)
        {
            draft.Estado = Ruta.EstadoConfirmada;
            draft.FechaConfirmacion = DateTime.UtcNow;
            draft.IdUsuarioModificacion = idUsuario;
            await _rutaRepository.UpdateAsync(draft, ct);
        }

        return await ArmarDetalleAsync(drafts, null, ct);
    }

    public async Task<List<RutaDto>> CancelarAsync(
        int idSeleccionMensual,
        CancelarRutasRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        _ = await _seleccionRepository.GetByIdAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException($"La selección {idSeleccionMensual} no existe.");

        var rutas = await _rutaRepository.GetBySeleccionAsync(idSeleccionMensual, null, ct);
        var confirmadas = rutas.Where(r => r.Estado == Ruta.EstadoConfirmada).ToList();

        if (confirmadas.Count == 0)
        {
            throw new InvalidOperationException("No hay rutas confirmadas que cancelar.");
        }

        foreach (var ruta in confirmadas)
        {
            ruta.Estado = Ruta.EstadoCancelada;
            ruta.IdUsuarioModificacion = idUsuario;
            await _rutaRepository.UpdateAsync(ruta, ct);
        }

        _logger.LogInformation(
            "Rutas confirmadas de la selección {IdSeleccion} canceladas ({Cantidad} ruta(s)) por el usuario {IdUsuario}. Motivo: {Motivo}",
            idSeleccionMensual, confirmadas.Count, idUsuario, request.Motivo);

        return await ArmarDetalleAsync(confirmadas, null, ct);
    }

    public async Task<List<AsignacionDto>> GetAsignacionesAsync(int idUsuario, CancellationToken ct = default)
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

        var hospitalesSeleccion = new Dictionary<int, SeleccionHospital>();
        var regionesPorSeleccion = new Dictionary<int, Dictionary<int, string>>();
        foreach (var idSeleccion in rutas.Select(r => r.IdSeleccionMensual).Distinct())
        {
            hospitalesSeleccion = hospitalesSeleccion.Union(
                (await _seleccionRepository.GetHospitalesAsync(idSeleccion, ct))
                    .ToDictionary(h => h.IdSeleccionHospital))
                .ToDictionary(kv => kv.Key, kv => kv.Value);

            regionesPorSeleccion[idSeleccion] = (await _seleccionRepository.GetRegionesAsync(idSeleccion, ct))
                .ToDictionary(r => r.IdRegion, r => r.Nombre ?? $"Región {r.IdRegion}");
        }

        var idsAsokam = hospitalesSeleccion.Values
            .Where(h => h.IdHospital.HasValue)
            .Select(h => h.IdHospital!.Value)
            .Distinct()
            .ToList();

        var nombresHospitales = idsAsokam.Count > 0
            ? (await _hospitalRepository.GetByIdsAsync(idsAsokam, ct))
                .ToDictionary(h => h.CodigoContacto, h => h.NombreContacto ?? $"Hospital {h.CodigoContacto}")
            : new Dictionary<int, string>();

        var asignaciones = new List<AsignacionDto>();
        foreach (var ruta in rutas)
        {
            var visitas = await _rutaRepository.GetVisitasAsync(ruta.IdRuta, ct);
            foreach (var visita in visitas)
            {
                var hospital = hospitalesSeleccion.GetValueOrDefault(visita.IdSeleccionHospital);
                asignaciones.Add(new AsignacionDto
                {
                    IdRutaVisita = visita.IdRutaVisita,
                    IdRuta = ruta.IdRuta,
                    NombreRuta = ruta.Nombre,
                    IdSeleccionMensual = ruta.IdSeleccionMensual,
                    FechaVisita = visita.FechaVisita,
                    Orden = visita.Orden,
                    IdHospital = hospital?.IdHospital,
                    NombreHospital = hospital?.IdHospital.HasValue == true
                        ? nombresHospitales.GetValueOrDefault(hospital.IdHospital.Value, $"Hospital {hospital.IdHospital}")
                        : null,
                    NombreRegion = hospital?.IdRegion.HasValue == true
                        ? regionesPorSeleccion.GetValueOrDefault(ruta.IdSeleccionMensual)?.GetValueOrDefault(hospital.IdRegion.Value)
                        : null,
                });
            }
        }

        return asignaciones.OrderBy(a => a.FechaVisita).ThenBy(a => a.Orden).ToList();
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

    private static List<RutaVisita> DistribuirEnDias(
        Ruta ruta,
        List<SeleccionHospital> hospitales,
        DateOnly inicio,
        DateOnly fin,
        int maxVisitasPorDia,
        int maxVisitasPorSemana,
        int idUsuario,
        bool agruparPorCiudad)
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

    private async Task<Ruta> ObtenerRutaEditableAsync(int idRuta, CancellationToken ct)
    {
        var ruta = await _rutaRepository.GetByIdAsync(idRuta, ct)
            ?? throw new InvalidOperationException($"La ruta {idRuta} no existe.");

        if (ruta.Estado != Ruta.EstadoDraft)
        {
            throw new InvalidOperationException($"Solo una ruta en Draft es editable (estado actual: {ruta.Estado}).");
        }

        return ruta;
    }

    private async Task ValidarMovimientoAsync(
        Ruta ruta,
        int idSeleccionHospital,
        DateOnly fechaVisita,
        int orden,
        int? idVisitaExcluida,
        int maxVisitasPorDia,
        int maxVisitasPorSemana,
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

        var rutasMismaVersion = (await _rutaRepository.GetBySeleccionAsync(ruta.IdSeleccionMensual, ruta.Version, ct))
            .Where(r => r.Estado is Ruta.EstadoDraft or Ruta.EstadoConfirmada)
            .ToList();

        foreach (var otra in rutasMismaVersion)
        {
            var visitas = await _rutaRepository.GetVisitasAsync(otra.IdRuta, ct);

            if (otra.IdRuta != ruta.IdRuta
                && visitas.Any(v => v.IdSeleccionHospital == idSeleccionHospital && v.IdRutaVisita != idVisitaExcluida))
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
                    throw new InvalidOperationException($"El día {fechaVisita:dd/MM} ya alcanzó el máximo de {maxVisitasPorDia} visitas.");
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
                    throw new InvalidOperationException($"La semana {clave.Semana} ya alcanzó el máximo de {maxVisitasPorSemana} visitas.");
                }
            }
        }
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

        var idsEquipos = rutas.Select(r => r.IdEquipo).Distinct().ToList();
        var equipos = (await _equipoRepository.GetAllAsync(null, ct))
            .Where(e => idsEquipos.Contains(e.IdEquipo))
            .ToDictionary(e => e.IdEquipo, e => $"Equipo {e.IdEquipo}");

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
                IdEquipo = ruta.IdEquipo,
                NombreEquipo = equipos.GetValueOrDefault(ruta.IdEquipo, $"Equipo {ruta.IdEquipo}"),
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
        if (visita.IdHospital.HasValue)
        {
            var hospital = await _hospitalRepository.GetByIdAsync(visita.IdHospital.Value, ct);
            nombreHospital = hospital?.NombreContacto ?? $"Hospital {visita.IdHospital}";
        }

        var hospitalSeleccion = hospitales.GetValueOrDefault(visita.IdSeleccionHospital);
        var esForanea = visita.IdHospital.HasValue
            ? (await _extensionRepository.GetByHospitalIdAsync(visita.IdHospital.Value, ct))?.EsZonaMetropolitana != true
            : false;

        return ArmarVisitaDto(
            visita,
            hospitales,
            regiones,
            new Dictionary<int, string> { [visita.IdHospital ?? 0] = nombreHospital ?? string.Empty },
            esForanea ? null : new Dictionary<int, bool?> { [visita.IdHospital ?? 0] = true },
            nombreHospitalForzado: nombreHospital);
    }

    private static RutaVisitaDto ArmarVisitaDto(
        RutaVisita visita,
        Dictionary<int, SeleccionHospital> hospitales,
        Dictionary<int, string> regiones,
        Dictionary<int, string> nombresHospitales,
        Dictionary<int, bool?>? extensiones,
        string? nombreHospitalForzado = null)
    {
        var hospital = hospitales.GetValueOrDefault(visita.IdSeleccionHospital);
        var esForanea = visita.IdHospital.HasValue
            ? extensiones?.GetValueOrDefault(visita.IdHospital.Value) != true
            : false;

        return new RutaVisitaDto
        {
            IdRutaVisita = visita.IdRutaVisita,
            IdRuta = visita.IdRuta,
            IdSeleccionHospital = visita.IdSeleccionHospital,
            IdHospital = visita.IdHospital,
            NombreHospital = nombreHospitalForzado
                ?? (visita.IdHospital.HasValue
                    ? nombresHospitales.GetValueOrDefault(visita.IdHospital.Value, $"Hospital {visita.IdHospital}")
                    : null),
            FechaVisita = visita.FechaVisita,
            Orden = visita.Orden,
            EsForanea = esForanea,
            IdRegion = hospital?.IdRegion,
            NombreRegion = hospital?.IdRegion.HasValue == true
                ? regiones.GetValueOrDefault(hospital.IdRegion.Value)
                : null,
        };
    }
}
