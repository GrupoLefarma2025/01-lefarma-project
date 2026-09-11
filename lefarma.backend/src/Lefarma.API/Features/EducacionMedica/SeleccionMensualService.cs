using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.EducacionMedica.Services;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.EducacionMedica;

public class SeleccionMensualService : ISeleccionMensualService
{
    public const string AlgoritmoClustering = "haversine-greedy-v1";
    public const string AlgoritmoRegionesCatalogo = "regiones-catalogo-v1";
    private const int MinimoHospitalesPorRegion = 4;
    private const double RadioCercaniaDefaultKm = 50;

    private readonly ISeleccionMensualRepository _repository;
    private readonly IHospitalRepository _hospitalRepository;
    private readonly IEquipoPareoRepository _equipoRepository;
    private readonly ITipoGerenciaRepository _tipoGerenciaRepository;
    private readonly IParametroModuloRepository _parametroRepository;
    private readonly IRegionRepository _regionRepository;
    private readonly IHospitalExtensionRepository _extensionRepository;
    private readonly AsokamDbContext _asokamContext;
    private readonly ILogger<SeleccionMensualService> _logger;

    public SeleccionMensualService(
        ISeleccionMensualRepository repository,
        IHospitalRepository hospitalRepository,
        IEquipoPareoRepository equipoRepository,
        ITipoGerenciaRepository tipoGerenciaRepository,
        IParametroModuloRepository parametroRepository,
        IRegionRepository regionRepository,
        IHospitalExtensionRepository extensionRepository,
        AsokamDbContext asokamContext,
        ILogger<SeleccionMensualService> logger)
    {
        _repository = repository;
        _hospitalRepository = hospitalRepository;
        _equipoRepository = equipoRepository;
        _tipoGerenciaRepository = tipoGerenciaRepository;
        _parametroRepository = parametroRepository;
        _regionRepository = regionRepository;
        _extensionRepository = extensionRepository;
        _asokamContext = asokamContext;
        _logger = logger;
    }

    public async Task<List<SeleccionMensualDto>> GetAllAsync(int? anio, int? mes, CancellationToken ct = default)
    {
        var selecciones = await _repository.GetAllAsync(anio, mes, ct);
        if (selecciones.Count == 0)
        {
            return [];
        }

        var tiposDict = await ObtenerTiposGerenciaAsync(ct);

        // Secuencial a proposito: el repositorio comparte la instancia de ApplicationDbContext
        // y EF no permite operaciones concurrentes sobre el mismo contexto.
        var conteosDict = new Dictionary<int, (int TotalHospitales, int TotalRegiones)>();
        foreach (var s in selecciones)
        {
            var hospitales = await _repository.GetHospitalesAsync(s.IdSeleccionMensual, ct);
            var regiones = await _repository.GetRegionesAsync(s.IdSeleccionMensual, ct);
            conteosDict[s.IdSeleccionMensual] = (hospitales.Count, regiones.Count);
        }

        return selecciones
            .Select(s =>
            {
                var (totalHospitales, totalRegiones) = conteosDict[s.IdSeleccionMensual];
                return s.ToResponse(tiposDict, totalHospitales, totalRegiones);
            })
            .ToList();
    }

    public async Task<SeleccionDetalleDto?> GetByIdAsync(int idSeleccionMensual, CancellationToken ct = default)
    {
        var seleccion = await _repository.GetByIdAsync(idSeleccionMensual, ct);
        if (seleccion is null)
        {
            return null;
        }

        var hospitales = await _repository.GetHospitalesAsync(idSeleccionMensual, ct);
        var regiones = await _repository.GetRegionesAsync(idSeleccionMensual, ct);
        var tiposDict = await ObtenerTiposGerenciaAsync(ct);

        var idsHospitales = hospitales
            .Where(h => h.IdHospital.HasValue)
            .Select(h => h.IdHospital!.Value)
            .Distinct()
            .ToList();

        var hospitalesCatalogo = idsHospitales.Count > 0
            ? await _hospitalRepository.GetByIdsAsync(idsHospitales, ct)
            : [];

        var nombresHospitales = hospitalesCatalogo
            .ToDictionary(h => h.CodigoContacto, h => h.NombreContacto ?? $"Hospital {h.CodigoContacto}");

        var idsPadres = hospitalesCatalogo
            .Where(h => h.CodigoContactoPrincipal.HasValue)
            .Select(h => h.CodigoContactoPrincipal!.Value)
            .Distinct()
            .ToList();
        var padres = idsPadres.Count > 0
            ? await _hospitalRepository.GetByIdsAsync(idsPadres, ct)
            : [];
        var nombresInstituciones = padres
            .ToDictionary(p => p.CodigoContacto, p => p.NombreContacto ?? $"Institución {p.CodigoContacto}");
        var institucionPorHospital = hospitalesCatalogo
            .Where(h => h.CodigoContactoPrincipal.HasValue
                && nombresInstituciones.ContainsKey(h.CodigoContactoPrincipal.Value))
            .ToDictionary(h => h.CodigoContacto, h => nombresInstituciones[h.CodigoContactoPrincipal!.Value]);

        var extensiones = idsHospitales.Count > 0
            ? (await _extensionRepository.GetByHospitalIdsAsync(idsHospitales, ct))
                .ToDictionary(e => e.IdHospital)
            : new Dictionary<int, HospitalExtension>();

        var regionesDict = regiones.ToDictionary(z => z.IdRegion, z => z.Nombre ?? $"Región {z.IdRegion}");
        var nombresEquipos = await ResolverNombresEquiposAsync(regiones, ct);
        var nombresEstados = await CargarNombresEstadosAsync(
            hospitales.Select(h => h.EntidadFederativa ?? string.Empty), ct);

        return new SeleccionDetalleDto
        {
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            FechaSeleccion = seleccion.FechaSeleccion,
            IdTipoGerencia = seleccion.IdTipoGerencia,
            TipoGerencia = tiposDict.GetValueOrDefault(seleccion.IdTipoGerencia ?? 0),
            FechaInicioVigencia = seleccion.FechaInicioVigencia,
            FechaFinVigencia = seleccion.FechaFinVigencia,
            TalleresObjetivoMes = seleccion.TalleresObjetivoMes,
            Estado = seleccion.Estado,
            FirmaGvFecha = seleccion.FirmaGvFecha,
            FirmaGgFecha = seleccion.FirmaGgFecha,
            TotalHospitales = hospitales.Count,
            TotalRegiones = regiones.Count,
            Hospitales = hospitales
                .Select(h =>
                {
                    var tieneExtension = h.IdHospital.HasValue
                        && extensiones.TryGetValue(h.IdHospital.Value, out _);
                    var extension = tieneExtension ? extensiones[h.IdHospital!.Value] : null;
                    return new SeleccionHospitalDto
                    {
                        IdSeleccionHospital = h.IdSeleccionHospital,
                        IdHospital = h.IdHospital,
                        NombreHospital = h.IdHospital.HasValue
                            ? nombresHospitales.GetValueOrDefault(h.IdHospital.Value, $"Hospital {h.IdHospital}")
                            : null,
                        Region = h.Region,
                        EntidadFederativa = h.EntidadFederativa is null
                            ? null
                            : nombresEstados.GetValueOrDefault(h.EntidadFederativa, h.EntidadFederativa),
                        CiudadMunicipio = h.CiudadMunicipio,
                        Institucion = h.IdHospital.HasValue
                            ? institucionPorHospital.GetValueOrDefault(h.IdHospital.Value)
                            : null,
                        NumeroQuirofanos = extension?.NumeroQuirofanos,
                        AnestesiasTotales = extension?.AnestesiasTotales,
                        ProductoAPromocionar = h.ProductoAPromocionar,
                        Observaciones = h.Observaciones,
                        LatitudSnapshot = h.LatitudSnapshot,
                        LongitudSnapshot = h.LongitudSnapshot,
                        IdRegion = h.IdRegion,
                        NombreRegion = h.IdRegion.HasValue ? regionesDict.GetValueOrDefault(h.IdRegion.Value) : null,
                        ScoreSugerencia = h.ScoreSugerencia,
                        Origen = h.Origen ?? (h.IdRankingEjecucion.HasValue ? "Sugerencia" : "Manual"),
                    };
                })
                .ToList(),
            Regiones = regiones
                .Select(z => z.ToResponse(nombresEquipos))
                .ToList(),
        };
    }

    public async Task<List<HospitalCercanoOtraSeleccionDto>> ObtenerHospitalesCercanosAsync(
        int idSeleccionMensual,
        CancellationToken ct = default)
    {
        var seleccion = await _repository.GetByIdAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException($"La selección {idSeleccionMensual} no existe.");

        if (seleccion.FechaInicioVigencia is null || seleccion.FechaFinVigencia is null)
        {
            return [];
        }

        var hospitalesActuales = await _repository.GetHospitalesAsync(idSeleccionMensual, ct);
        var propios = hospitalesActuales
            .Where(h => h.LatitudSnapshot.HasValue && h.LongitudSnapshot.HasValue)
            .ToList();

        var solapadas = await _repository.GetSeleccionesSolapadasAsync(
            idSeleccionMensual,
            seleccion.FechaInicioVigencia.Value,
            seleccion.FechaFinVigencia.Value,
            seleccion.IdTipoGerencia,
            ct);
        if (solapadas.Count == 0)
        {
            return [];
        }

        // Defensa: un hospital fisico no deberia estar en dos gerencias, pero si
        // aparece en la seleccion actual se omite del cruce.
        var idsActuales = hospitalesActuales
            .Where(h => h.IdHospital.HasValue)
            .Select(h => h.IdHospital!.Value)
            .ToHashSet();

        var ajenos = (await _repository.GetHospitalesDeSeleccionesAsync(
                solapadas.Select(s => s.IdSeleccionMensual), ct))
            .Where(h => !h.IdHospital.HasValue || !idsActuales.Contains(h.IdHospital.Value))
            .ToList();
        if (ajenos.Count == 0)
        {
            return [];
        }

        var radioKm = await LeerRadioCercaniaAsync(ct);

        var idsHospitales = hospitalesActuales.Select(h => h.IdHospital)
            .Concat(ajenos.Select(h => h.IdHospital))
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var hospitalesCatalogo = idsHospitales.Count > 0
            ? await _hospitalRepository.GetByIdsAsync(idsHospitales, ct)
            : [];
        var nombresHospitales = hospitalesCatalogo
            .ToDictionary(h => h.CodigoContacto, h => h.NombreContacto ?? $"Hospital {h.CodigoContacto}");

        var gerenciasDict = (await _tipoGerenciaRepository.GetAllAsync(ct))
            .ToDictionary(t => t.IdTipoGerencia, t => t.Descripcion);
        var seleccionesDict = solapadas.ToDictionary(s => s.IdSeleccionMensual);
        var nombresEstados = await CargarNombresEstadosAsync(
            ajenos.Select(h => h.EntidadFederativa ?? string.Empty), ct);

        var resultado = new List<HospitalCercanoOtraSeleccionDto>();
        foreach (var ajeno in ajenos)
        {
            SeleccionHospital? masCercano = null;
            double? distanciaMinima = null;
            if (ajeno.LatitudSnapshot.HasValue && ajeno.LongitudSnapshot.HasValue)
            {
                foreach (var propio in propios)
                {
                    var distancia = Haversine.DistanciaKm(
                        (double)ajeno.LatitudSnapshot.Value,
                        (double)ajeno.LongitudSnapshot.Value,
                        (double)propio.LatitudSnapshot!.Value,
                        (double)propio.LongitudSnapshot!.Value);
                    if (distanciaMinima is null || distancia < distanciaMinima.Value)
                    {
                        distanciaMinima = distancia;
                        masCercano = propio;
                    }
                }
            }

            var porDistancia = distanciaMinima.HasValue && distanciaMinima.Value <= radioKm;
            var porEstado = !string.IsNullOrWhiteSpace(ajeno.EntidadFederativa)
                && hospitalesActuales.Any(h =>
                    !string.IsNullOrWhiteSpace(h.EntidadFederativa)
                    && string.Equals(h.EntidadFederativa, ajeno.EntidadFederativa, StringComparison.OrdinalIgnoreCase));
            var porCiudad = !string.IsNullOrWhiteSpace(ajeno.CiudadMunicipio)
                && hospitalesActuales.Any(h =>
                    NormalizarTexto(h.CiudadMunicipio) == NormalizarTexto(ajeno.CiudadMunicipio));

            if (!porDistancia && !porEstado && !porCiudad)
            {
                continue;
            }

            var origen = seleccionesDict.GetValueOrDefault(ajeno.IdSeleccionMensual);
            resultado.Add(new HospitalCercanoOtraSeleccionDto
            {
                IdSeleccionHospitalAjeno = ajeno.IdSeleccionHospital,
                IdHospital = ajeno.IdHospital,
                NombreHospital = ajeno.IdHospital.HasValue
                    ? nombresHospitales.GetValueOrDefault(ajeno.IdHospital.Value, $"Hospital {ajeno.IdHospital}")
                    : null,
                GerenciaOrigen = origen?.IdTipoGerencia is int idGerencia
                    ? gerenciasDict.GetValueOrDefault(idGerencia)
                    : null,
                IdSeleccionMensualOrigen = ajeno.IdSeleccionMensual,
                FechaSeleccionOrigen = origen?.FechaSeleccion ?? default,
                EntidadFederativa = ajeno.EntidadFederativa is null
                    ? null
                    : nombresEstados.GetValueOrDefault(ajeno.EntidadFederativa, ajeno.EntidadFederativa),
                CiudadMunicipio = ajeno.CiudadMunicipio,
                Latitud = ajeno.LatitudSnapshot,
                Longitud = ajeno.LongitudSnapshot,
                DistanciaKm = distanciaMinima.HasValue
                    ? (decimal)Math.Round(distanciaMinima.Value, 1)
                    : null,
                Criterio = porDistancia ? "distancia" : porEstado ? "mismoEstado" : "mismaCiudad",
                IdSeleccionHospitalCercano = masCercano?.IdSeleccionHospital,
                NombreHospitalCercano = masCercano?.IdHospital is int idH
                    ? nombresHospitales.GetValueOrDefault(idH, $"Hospital {idH}")
                    : null,
            });
        }

        var prioridadCriterio = new Dictionary<string, int>
        {
            ["distancia"] = 0,
            ["mismoEstado"] = 1,
            ["mismaCiudad"] = 2,
        };
        // Un mismo hospital fisico puede aparecer en dos selecciones ajenas
        // solapadas; se reporta una sola vez, con la menor distancia.
        return resultado
            .GroupBy(r => r.IdHospital ?? -r.IdSeleccionHospitalAjeno)
            .Select(g => g.OrderBy(x => x.DistanciaKm ?? decimal.MaxValue).First())
            .OrderBy(r => prioridadCriterio[r.Criterio])
            .ThenBy(r => r.DistanciaKm ?? decimal.MaxValue)
            .ToList();
    }

    private async Task<double> LeerRadioCercaniaAsync(CancellationToken ct)
    {
        var parametros = await _parametroRepository.GetAllAsync(ct);
        return (double)(parametros.FirstOrDefault(p => p.Clave == "radio_clustering_km")?.Valor
            ?? (decimal)RadioCercaniaDefaultKm);
    }

    private static string NormalizarTexto(string? valor) =>
        (valor ?? string.Empty).Trim().ToUpperInvariant();

    public async Task<SeleccionMensualDto> CreateAsync(CrearSeleccionMensualRequest request, int idUsuario, CancellationToken ct = default)
    {
        if (request.FechaFinVigencia < request.FechaInicioVigencia)
        {
            throw new InvalidOperationException("La fecha de fin de vigencia no puede ser anterior a la de inicio.");
        }

        var duplicada = await _repository.ExisteSeleccionActivaAsync(
            request.FechaInicioVigencia, request.FechaFinVigencia, request.IdTipoGerencia, ct);
        if (duplicada)
        {
            throw new InvalidOperationException(
                "Ya existe una selección activa que se traslapa con este periodo para la misma gerencia.");
        }

        var seleccion = await _repository.CreateAsync(new SeleccionMensual
        {
            FechaSeleccion = request.FechaSeleccion,
            IdTipoGerencia = request.IdTipoGerencia,
            FechaInicioVigencia = request.FechaInicioVigencia,
            FechaFinVigencia = request.FechaFinVigencia,
            TalleresObjetivoMes = request.TalleresObjetivoMes,
            Estado = SeleccionMensual.EstadoBorrador,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        }, ct);

        var tiposDict = await ObtenerTiposGerenciaAsync(ct);
        return seleccion.ToResponse(tiposDict, 0, 0);
    }

    public async Task<SeleccionHospitalDto> AgregarHospitalAsync(
        int idSeleccionMensual,
        AgregarHospitalSeleccionRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var seleccion = await ObtenerSeleccionEditableAsync(idSeleccionMensual, ct);

        var hospitales = await _repository.GetHospitalesAsync(idSeleccionMensual, ct);
        if (hospitales.Any(h => h.IdHospital == request.IdHospital))
        {
            throw new InvalidOperationException($"El hospital {request.IdHospital} ya pertenece a esta selección.");
        }

        var hospital = await _hospitalRepository.GetByIdAsync(request.IdHospital, ct)
            ?? throw new InvalidOperationException($"El hospital {request.IdHospital} no existe en el catálogo de Asokam.");

        var agregado = await _repository.AddHospitalAsync(new SeleccionHospital
        {
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            IdHospital = request.IdHospital,
            Region = hospital.Zona,
            EntidadFederativa = hospital.CodigoEstado,
            CiudadMunicipio = hospital.Ciudad,
            ProductoAPromocionar = request.ProductoAPromocionar,
            Observaciones = request.Observaciones,
            LatitudSnapshot = hospital.Latitud,
            LongitudSnapshot = hospital.Longitud,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        }, ct);

        return new SeleccionHospitalDto
        {
            IdSeleccionHospital = agregado.IdSeleccionHospital,
            IdHospital = agregado.IdHospital,
            NombreHospital = hospital.NombreContacto ?? $"Hospital {hospital.CodigoContacto}",
            Region = agregado.Region,
            EntidadFederativa = agregado.EntidadFederativa,
            CiudadMunicipio = agregado.CiudadMunicipio,
            ProductoAPromocionar = agregado.ProductoAPromocionar,
            Observaciones = agregado.Observaciones,
            LatitudSnapshot = agregado.LatitudSnapshot,
            LongitudSnapshot = agregado.LongitudSnapshot,
            IdRegion = agregado.IdRegion,
            ScoreSugerencia = null,
            Origen = "Manual",
        };
    }

    public async Task QuitarHospitalAsync(int idSeleccionMensual, int idSeleccionHospital, CancellationToken ct = default)
    {
        _ = await ObtenerSeleccionEditableAsync(idSeleccionMensual, ct);

        var hospital = await _repository.GetHospitalByIdAsync(idSeleccionHospital, ct)
            ?? throw new InvalidOperationException($"El hospital seleccionado {idSeleccionHospital} no existe.");

        if (hospital.IdSeleccionMensual != idSeleccionMensual)
        {
            throw new InvalidOperationException($"El hospital seleccionado {idSeleccionHospital} no pertenece a la selección {idSeleccionMensual}.");
        }

        await _repository.RemoveHospitalAsync(hospital, ct);
        await EliminarRegionesVaciasAsync(idSeleccionMensual, ct);
    }

    public async Task<AgruparSeleccionResponse> AgruparAsync(int idSeleccionMensual, int idUsuario, CancellationToken ct = default)
    {
        _ = await ObtenerSeleccionEditableAsync(idSeleccionMensual, ct);

        var hospitales = await _repository.GetHospitalesAsync(idSeleccionMensual, ct);
        var avisos = new List<string>();

        // Regiones de catálogo: la agrupación ya no clusteriza por GPS,
        // ubica cada hospital en la región asignada en hospital_extension.
        var regionesCatalogo = (await _regionRepository.GetAllAsync(ct))
            .Where(z => z.Activo)
            .ToList();
        var regionesCatalogoDict = regionesCatalogo.ToDictionary(z => z.IdRegion);
        var conCentroide = regionesCatalogo
            .Where(z => z.CentroLatitud.HasValue && z.CentroLongitud.HasValue)
            .ToList();

        // Región fija (vigente) de cada hospital según su extensión.
        var idsHospitales = hospitales
            .Where(h => h.IdHospital.HasValue)
            .Select(h => h.IdHospital!.Value)
            .Distinct()
            .ToList();
        var extensiones = idsHospitales.Count > 0
            ? (await _extensionRepository.GetByHospitalIdsAsync(idsHospitales, ct))
                .ToDictionary(e => e.IdHospital)
            : new Dictionary<int, HospitalExtension>();

        foreach (var hospital in hospitales)
        {
            hospital.IdRegion = null;
            hospital.Origen = null;
            hospital.IdUsuarioModificacion = idUsuario;
        }

        await _repository.SaveChangesAsync(ct);

        var regionesPrevias = await _repository.GetRegionesAsync(idSeleccionMensual, ct);
        foreach (var regionPrev in regionesPrevias)
        {
            await _repository.RemoveRegionAsync(regionPrev, ct);
        }

        // Equipo vigente de cada región (1 equipo = 1 región): asignación automática.
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        var equiposVigentes = await _equipoRepository.GetAllAsync(
            new EquipoPareoFiltro { SoloVigentes = true }, ct);
        var equipoPorRegion = equiposVigentes
            .Where(e => e.FechaFin is null || e.FechaFin >= hoy)
            .GroupBy(e => e.IdRegion)
            .ToDictionary(g => g.Key, g => g.First());

        var miembrosPorRegion = new Dictionary<int, List<SeleccionHospital>>();
        var gpsFallback = 0;
        var regionInvalida = 0;
        var sinRegionNiCoordenadas = 0;

        foreach (var hospital in hospitales.OrderBy(h => h.IdSeleccionHospital))
        {
            int? idRegionCatalogo = null;

            if (hospital.IdHospital.HasValue
                && extensiones.TryGetValue(hospital.IdHospital.Value, out var extension)
                && extension.IdRegion.HasValue)
            {
                if (regionesCatalogoDict.ContainsKey(extension.IdRegion.Value))
                {
                    idRegionCatalogo = extension.IdRegion.Value;
                }
                else
                {
                    regionInvalida++;
                }
            }

            if (!idRegionCatalogo.HasValue)
            {
                if (hospital.LatitudSnapshot.HasValue
                    && hospital.LongitudSnapshot.HasValue
                    && conCentroide.Count > 0)
                {
                    var masCercana = conCentroide
                        .OrderBy(z => Haversine.DistanciaKm(
                            (double)z.CentroLatitud!.Value,
                            (double)z.CentroLongitud!.Value,
                            (double)hospital.LatitudSnapshot!.Value,
                            (double)hospital.LongitudSnapshot!.Value))
                        .First();
                    idRegionCatalogo = masCercana.IdRegion;
                    hospital.Origen = "GPS";
                    gpsFallback++;
                }
                else
                {
                    sinRegionNiCoordenadas++;
                    continue;
                }
            }

            if (!miembrosPorRegion.TryGetValue(idRegionCatalogo.Value, out var lista))
            {
                lista = [];
                miembrosPorRegion[idRegionCatalogo.Value] = lista;
            }
            lista.Add(hospital);
        }

        if (gpsFallback > 0)
        {
            avisos.Add($"{gpsFallback} hospital(es) sin región asignada se ubicaron por GPS en la región con centroide más cercano.");
        }
        if (regionInvalida > 0)
        {
            avisos.Add($"{regionInvalida} hospital(es) tenían una región inactiva o inexistente; se trataron como sin región.");
        }
        if (sinRegionNiCoordenadas > 0)
        {
            avisos.Add($"{sinRegionNiCoordenadas} hospital(es) sin región ni coordenadas GPS no fueron agrupados.");
        }

        var regionesCreadas = new List<SeleccionRegion>();
        foreach (var (idRegionCatalogo, miembros) in miembrosPorRegion
            .OrderBy(kv => regionesCatalogoDict[kv.Key].Nombre))
        {
            var catalogo = regionesCatalogoDict[idRegionCatalogo];
            var equipo = equipoPorRegion.GetValueOrDefault(idRegionCatalogo);

            var region = await _repository.CreateRegionAsync(new SeleccionRegion
            {
                IdSeleccionMensual = idSeleccionMensual,
                Nombre = catalogo.Nombre,
                IdRegionCatalogo = catalogo.IdRegion,
                CentroLatitud = catalogo.CentroLatitud,
                CentroLongitud = catalogo.CentroLongitud,
                CantidadHospitales = miembros.Count,
                Algoritmo = AlgoritmoRegionesCatalogo,
                FechaCalculo = DateTime.UtcNow,
                IdEquipo = equipo?.IdEquipo,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario,
            }, ct);

            foreach (var miembro in miembros)
            {
                miembro.IdRegion = region.IdRegion;
            }

            await _repository.SaveChangesAsync(ct);
            regionesCreadas.Add(region);

            if (equipo is null)
            {
                avisos.Add($"La región {catalogo.Nombre} no tiene equipo vigente asignado.");
            }
            if (miembros.Count < MinimoHospitalesPorRegion)
            {
                avisos.Add($"{catalogo.Nombre} tiene {miembros.Count} hospital(es); la regla de viaje foráneo recomienda mínimo {MinimoHospitalesPorRegion}.");
            }
        }

        if (regionesPrevias.Any(z => z.IdEquipo.HasValue))
        {
            avisos.Add("Las asignaciones de equipo se restablecieron al recalcular la agrupación.");
        }

        _logger.LogInformation(
            "Selección {IdSeleccion} agrupada por regiones de catálogo: {Regiones} región(es), {Gps} por GPS, {SinAgrupar} sin agrupar.",
            idSeleccionMensual, regionesCreadas.Count, gpsFallback, sinRegionNiCoordenadas);

        var nombresEquipos = await ResolverNombresEquiposAsync(regionesCreadas, ct);
        return new AgruparSeleccionResponse
        {
            Regiones = regionesCreadas.Select(z => z.ToResponse(nombresEquipos)).ToList(),
            Avisos = avisos,
        };
    }

    public async Task<SeleccionRegionDto> AsignarEquipoAsync(
        int idSeleccionMensual,
        int idRegion,
        AsignarEquipoRegionRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        _ = await ObtenerSeleccionEditableAsync(idSeleccionMensual, ct);

        var region = await _repository.GetRegionByIdAsync(idRegion, ct)
            ?? throw new InvalidOperationException($"La región {idRegion} no existe.");

        if (region.IdSeleccionMensual != idSeleccionMensual)
        {
            throw new InvalidOperationException($"La región {idRegion} no pertenece a la selección {idSeleccionMensual}.");
        }

        var equipo = await _equipoRepository.GetByIdAsync(request.IdEquipo, ct)
            ?? throw new InvalidOperationException($"El equipo {request.IdEquipo} no existe.");

        if (!equipo.Activo)
        {
            throw new InvalidOperationException($"El equipo {request.IdEquipo} está inactivo; seleccione un equipo vigente.");
        }

        var seleccion = await _repository.GetByIdAsync(idSeleccionMensual, ct);
        var (maxDia, maxSemana) = await LeerCapacidadesAsync(ct);
        var capacidad = CapacidadPeriodo.Calcular(
            seleccion?.FechaInicioVigencia ?? DateOnly.FromDateTime(DateTime.UtcNow),
            seleccion?.FechaFinVigencia ?? DateOnly.FromDateTime(DateTime.UtcNow).AddDays(45),
            maxDia,
            maxSemana);

        var regiones = await _repository.GetRegionesAsync(idSeleccionMensual, ct);
        var demanda = regiones
            .Where(z => z.IdEquipo == request.IdEquipo && z.IdRegion != idRegion)
            .Sum(z => z.CantidadHospitales) + region.CantidadHospitales;

        if (demanda > capacidad)
        {
            throw new InvalidOperationException(
                $"Capacidad insuficiente: el equipo quedaría con {demanda} hospital(es) contra una capacidad de {capacidad} visitas en el periodo (déficit {demanda - capacidad}). Reasigne otra región o divida esta región.");
        }

        region.IdEquipo = request.IdEquipo;
        region.IdUsuarioModificacion = idUsuario;
        await _repository.UpdateRegionAsync(region, ct);

        var nombresEquipos = await ResolverNombresEquiposAsync([region], ct);
        return region.ToResponse(nombresEquipos);
    }

    public async Task<List<SeleccionRegionDto>> DividirRegionAsync(
        int idSeleccionMensual,
        int idRegion,
        DividirRegionRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        _ = await ObtenerSeleccionEditableAsync(idSeleccionMensual, ct);

        var region = await _repository.GetRegionByIdAsync(idRegion, ct)
            ?? throw new InvalidOperationException($"La región {idRegion} no existe.");

        if (region.IdSeleccionMensual != idSeleccionMensual)
        {
            throw new InvalidOperationException($"La región {idRegion} no pertenece a la selección {idSeleccionMensual}.");
        }

        var hospitales = (await _repository.GetHospitalesAsync(idSeleccionMensual, ct))
            .Where(h => h.IdRegion == idRegion)
            .ToList();

        if (hospitales.Count < 2)
        {
            throw new InvalidOperationException("La región necesita al menos 2 hospitales para poder dividirse.");
        }

        var conCoordenadas = hospitales
            .Where(h => h.LatitudSnapshot.HasValue && h.LongitudSnapshot.HasValue)
            .ToList();

        var ordenados = conCoordenadas
            .OrderByDescending(h => region.CentroLatitud.HasValue && region.CentroLongitud.HasValue
                ? Haversine.DistanciaKm(
                    (double)region.CentroLatitud.Value, (double)region.CentroLongitud.Value,
                    (double)h.LatitudSnapshot!.Value, (double)h.LongitudSnapshot!.Value)
                : 0)
            .ThenBy(h => h.IdSeleccionHospital)
            .ToList();

        var mitad = (int)Math.Ceiling(ordenados.Count / 2.0);
        var seVan = ordenados.Take(mitad).ToList();

        var regiones = await _repository.GetRegionesAsync(idSeleccionMensual, ct);
        var nuevaRegion = await _repository.CreateRegionAsync(new SeleccionRegion
        {
            IdSeleccionMensual = idSeleccionMensual,
            Nombre = $"{region.Nombre} (división)",
            CantidadHospitales = seVan.Count,
            Algoritmo = AlgoritmoClustering,
            FechaCalculo = DateTime.UtcNow,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        }, ct);

        foreach (var hospital in seVan)
        {
            hospital.IdRegion = nuevaRegion.IdRegion;
        }

        RecalcularCentroide(region, hospitales.Where(h => h.IdRegion == idRegion).ToList());
        RecalcularCentroide(nuevaRegion, seVan);

        region.IdUsuarioModificacion = idUsuario;
        await _repository.UpdateRegionAsync(region, ct);

        _logger.LogInformation(
            "Región {IdRegion} ({NombreRegion}) dividida en la selección {IdSeleccion} por el usuario {IdUsuario}. Motivo: {Motivo}",
            idRegion, region.Nombre, idSeleccionMensual, idUsuario, request.Motivo);

        var nombresEquipos = await ResolverNombresEquiposAsync([region, nuevaRegion], ct);
        return (await _repository.GetRegionesAsync(idSeleccionMensual, ct))
            .Select(z => z.ToResponse(nombresEquipos))
            .ToList();
    }

    public async Task AsignarRegionAHospitalAsync(
        int idSeleccionMensual,
        int idSeleccionHospital,
        MoverHospitalARegionRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        _ = await ObtenerSeleccionEditableAsync(idSeleccionMensual, ct);

        var hospital = await _repository.GetHospitalByIdAsync(idSeleccionHospital, ct)
            ?? throw new InvalidOperationException($"El hospital {idSeleccionHospital} no existe.");

        if (hospital.IdSeleccionMensual != idSeleccionMensual)
        {
            throw new InvalidOperationException($"El hospital {idSeleccionHospital} no pertenece a la selección {idSeleccionMensual}.");
        }

        if (hospital.IdRegion.HasValue)
        {
            throw new InvalidOperationException(
                "El hospital ya tiene una región asignada; use Recalcular regiones para reagruparlo.");
        }

        var region = await _repository.GetRegionByIdAsync(request.IdRegion, ct)
            ?? throw new InvalidOperationException($"La región {request.IdRegion} no existe.");

        if (region.IdSeleccionMensual != idSeleccionMensual)
        {
            throw new InvalidOperationException($"La región {request.IdRegion} no pertenece a la selección {idSeleccionMensual}.");
        }

        hospital.IdRegion = region.IdRegion;
        hospital.IdUsuarioModificacion = idUsuario;

        var miembros = await _repository.GetHospitalesAsync(idSeleccionMensual, ct);
        RecalcularCentroide(region, miembros.Where(m => m.IdRegion == region.IdRegion).ToList());
        region.IdUsuarioModificacion = idUsuario;

        await _repository.UpdateRegionAsync(region, ct);
        await _repository.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Hospital {IdSeleccionHospital} asignado a la región {IdRegion} en la selección {IdSeleccion} por el usuario {IdUsuario}.",
            idSeleccionHospital, region.IdRegion, idSeleccionMensual, idUsuario);
    }

    public async Task<SeleccionMensualDto> EnviarRevisionAsync(int idSeleccionMensual, int idUsuario, CancellationToken ct = default)
    {
        var seleccion = await ObtenerSeleccionEditableAsync(idSeleccionMensual, ct);

        if (seleccion.Estado != SeleccionMensual.EstadoBorrador)
        {
            throw new InvalidOperationException($"Solo una selección en Borrador puede enviarse a revisión (estado actual: {seleccion.Estado}).");
        }

        var regiones = await _repository.GetRegionesAsync(idSeleccionMensual, ct);
        if (!regiones.Any(z => z.IdEquipo.HasValue))
        {
            throw new InvalidOperationException("Asigne al menos una región a un equipo antes de enviar a revisión.");
        }

        seleccion.Estado = SeleccionMensual.EstadoEnRevision;
        seleccion.IdUsuarioModificacion = idUsuario;
        await _repository.UpdateAsync(seleccion, ct);

        var tiposDict = await ObtenerTiposGerenciaAsync(ct);
        var hospitales = await _repository.GetHospitalesAsync(idSeleccionMensual, ct);
        return seleccion.ToResponse(tiposDict, hospitales.Count, regiones.Count);
    }

    public async Task<SeleccionMensualDto> AutorizarAsync(
        int idSeleccionMensual,
        AutorizarSeleccionRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var seleccion = await _repository.GetByIdAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException($"La selección {idSeleccionMensual} no existe.");

        if (seleccion.Estado != SeleccionMensual.EstadoEnRevision)
        {
            throw new InvalidOperationException(
                seleccion.Estado == SeleccionMensual.EstadoBorrador
                    ? "La selección está en Borrador; envíela a revisión antes de autorizar."
                    : $"La selección no puede autorizarse en estado {seleccion.Estado}.");
        }

        if (request.Rol == "GV")
        {
            if (seleccion.FirmaGvFecha.HasValue)
            {
                throw new InvalidOperationException("El Gerente de Ventas ya firmó esta selección.");
            }

            seleccion.FirmaGvFecha = DateTime.UtcNow;
        }
        else
        {
            if (!seleccion.FirmaGvFecha.HasValue)
            {
                throw new InvalidOperationException("Primero debe firmar el Gerente de Ventas (doble firma GV → GG).");
            }

            if (seleccion.FirmaGgFecha.HasValue)
            {
                throw new InvalidOperationException("La Gerencia General ya firmó esta selección.");
            }

            seleccion.FirmaGgFecha = DateTime.UtcNow;
            seleccion.Estado = SeleccionMensual.EstadoAutorizada;
        }

        seleccion.IdUsuarioModificacion = idUsuario;
        await _repository.UpdateAsync(seleccion, ct);

        var tiposDict = await ObtenerTiposGerenciaAsync(ct);
        var hospitales = await _repository.GetHospitalesAsync(idSeleccionMensual, ct);
        var regiones = await _repository.GetRegionesAsync(idSeleccionMensual, ct);
        return seleccion.ToResponse(tiposDict, hospitales.Count, regiones.Count);
    }

    public async Task<SeleccionMensualDto> CerrarAsync(int idSeleccionMensual, int idUsuario, CancellationToken ct = default)
    {
        var seleccion = await _repository.GetByIdAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException($"La selección {idSeleccionMensual} no existe.");

        if (seleccion.Estado != SeleccionMensual.EstadoAutorizada)
        {
            throw new InvalidOperationException($"Solo una selección Autorizada puede cerrarse (estado actual: {seleccion.Estado}).");
        }

        seleccion.Estado = SeleccionMensual.EstadoCerrada;
        seleccion.IdUsuarioModificacion = idUsuario;
        await _repository.UpdateAsync(seleccion, ct);

        var tiposDict = await ObtenerTiposGerenciaAsync(ct);
        var hospitales = await _repository.GetHospitalesAsync(idSeleccionMensual, ct);
        var regiones = await _repository.GetRegionesAsync(idSeleccionMensual, ct);
        return seleccion.ToResponse(tiposDict, hospitales.Count, regiones.Count);
    }

    private async Task<(int MaxDia, int MaxSemana)> LeerCapacidadesAsync(CancellationToken ct)
    {
        var parametros = await _parametroRepository.GetAllAsync(ct);
        var maxDia = (int)(parametros.FirstOrDefault(p => p.Clave == "max_visitas_dia")?.Valor
            ?? CapacidadPeriodo.MaxVisitasPorDia);
        var maxSemana = (int)(parametros.FirstOrDefault(p => p.Clave == "max_visitas_semana")?.Valor
            ?? CapacidadPeriodo.MaxVisitasPorSemana);
        return (maxDia, maxSemana);
    }

    private async Task<SeleccionMensual> ObtenerSeleccionEditableAsync(int idSeleccionMensual, CancellationToken ct)
    {
        var seleccion = await _repository.GetByIdAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException($"La selección {idSeleccionMensual} no existe.");

        if (seleccion.Estado is SeleccionMensual.EstadoAutorizada or SeleccionMensual.EstadoCerrada)
        {
            throw new InvalidOperationException($"La selección está {seleccion.Estado.ToLowerInvariant()} y ya no admite cambios.");
        }

        return seleccion;
    }

    private async Task EliminarRegionesVaciasAsync(int idSeleccionMensual, CancellationToken ct)
    {
        var hospitales = await _repository.GetHospitalesAsync(idSeleccionMensual, ct);
        var regiones = await _repository.GetRegionesAsync(idSeleccionMensual, ct);

        foreach (var region in regiones.Where(z => hospitales.All(h => h.IdRegion != z.IdRegion)))
        {
            await _repository.RemoveRegionAsync(region, ct);
        }
    }

    private static void RecalcularCentroide(SeleccionRegion region, List<SeleccionHospital> miembros)
    {
        region.CantidadHospitales = miembros.Count;

        if (miembros.Count > 0 && miembros.All(m => m.LatitudSnapshot.HasValue && m.LongitudSnapshot.HasValue))
        {
            region.CentroLatitud = Math.Round(miembros.Average(m => m.LatitudSnapshot!.Value), 7);
            region.CentroLongitud = Math.Round(miembros.Average(m => m.LongitudSnapshot!.Value), 7);
        }
        else
        {
            region.CentroLatitud = null;
            region.CentroLongitud = null;
        }
    }

    private async Task<Dictionary<int, string>> ObtenerTiposGerenciaAsync(CancellationToken ct)
    {
        var tipos = await _tipoGerenciaRepository.GetAllAsync(ct);
        return tipos.ToDictionary(t => t.IdTipoGerencia, t => t.Descripcion);
    }

    private async Task<Dictionary<string, string>> CargarNombresEstadosAsync(
        IEnumerable<string> codigos, CancellationToken ct)
    {
        var limpios = codigos
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (limpios.Count == 0)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        var enteros = limpios
            .Select(c => int.TryParse(c, out var v) ? (int?)v : null)
            .Where(v => v.HasValue)
            .Select(v => v!.Value)
            .ToList();

        return await _asokamContext.GenEstados
            .AsNoTracking()
            .Where(e => enteros.Contains(e.CodigoEstado))
            .ToDictionaryAsync(
                e => e.CodigoEstado.ToString(),
                e => e.NombreEstado ?? $"Estado {e.CodigoEstado}",
                StringComparer.OrdinalIgnoreCase,
                ct);
    }

    private async Task<Dictionary<int, string>> ResolverNombresEquiposAsync(IEnumerable<SeleccionRegion> regiones, CancellationToken ct)
    {
        var idsEquipos = regiones
            .Where(z => z.IdEquipo.HasValue)
            .Select(z => z.IdEquipo!.Value)
            .Distinct()
            .ToList();

        if (idsEquipos.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        var equipos = await _equipoRepository.GetAllAsync(null, ct);
        var relevantes = equipos.Where(e => idsEquipos.Contains(e.IdEquipo)).ToList();

        return relevantes.ToDictionary(e => e.IdEquipo, e => $"Equipo {e.IdEquipo}");
    }
}
