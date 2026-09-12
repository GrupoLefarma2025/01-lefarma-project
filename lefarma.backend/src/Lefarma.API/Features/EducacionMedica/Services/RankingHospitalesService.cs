using System.Text.Json;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica.Services;

public class RankingHospitalesService : IRankingHospitalesService
{
    private const string RadioAgrupabilidadClave = "radio_agrupabilidad_km";
    private const string ReglaElegibilidadVersion = "elegibilidad-v1";

    private static readonly List<string> TiposExcluidosElegibilidad = ["Privado", "Distribuidor"];

    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly ISeleccionMensualRepository _seleccionRepository;
    private readonly IHospitalRepository _hospitalRepository;
    private readonly IHospitalExtensionRepository _extensionRepository;
    private readonly ILogger<RankingHospitalesService> _logger;

    public RankingHospitalesService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        ISeleccionMensualRepository seleccionRepository,
        IHospitalRepository hospitalRepository,
        IHospitalExtensionRepository extensionRepository,
        ILogger<RankingHospitalesService> logger)
    {
        _context = context;
        _asokamContext = asokamContext;
        _seleccionRepository = seleccionRepository;
        _hospitalRepository = hospitalRepository;
        _extensionRepository = extensionRepository;
        _logger = logger;
    }

    public async Task<RankingEjecucionDto> GenerarRankingAsync(
        int idSeleccionMensual,
        GenerarRankingRequest request,
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        var seleccion = await ObtenerSeleccionEditableAsync(idSeleccionMensual, cancellationToken);

        if (seleccion.IdTipoGerencia is null)
        {
            throw new InvalidOperationException(
                "La selección no tiene gerencia configurada. Asigne la gerencia (IMSS o Descentralizado) antes de generar el ranking.");
        }

        var configuracion = await CargarConfiguracionActivaAsync(cancellationToken);
        var rankingConfig = ConstruirRankingConfig(configuracion);

        var idsYaSeleccionados = await _context.SeleccionesHospitales
            .AsNoTracking()
            .Where(h => h.IdSeleccionMensual == idSeleccionMensual && h.IdHospital.HasValue)
            .Select(h => h.IdHospital!.Value)
            .ToListAsync(cancellationToken);

        var hospitales = await _hospitalRepository.GetHospitalesAsync(
            new HospitalFilterParams { ExcluirTipos = TiposExcluidosElegibilidad, TieneCoordenadas = true },
            cancellationToken);
        var preFiltro = hospitales
            .Where(h => !idsYaSeleccionados.Contains(h.CodigoContacto))
            .ToList();

        var idsPreFiltro = preFiltro.Select(h => h.CodigoContacto).ToList();
        var extensiones = await _extensionRepository.GetByHospitalIdsAsync(idsPreFiltro, cancellationToken);
        var extensionesDict = extensiones.ToDictionary(e => e.IdHospital);

        var (candidatosCatalogo, excluidosGerencia) = FiltrarPorGerencia(
            preFiltro, extensionesDict, seleccion.IdTipoGerencia.Value);

        if (excluidosGerencia > 0)
        {
            _logger.LogWarning(
                "Ranking para seleccion {IdSeleccionMensual}: {Excluidos} hospitales excluidos por pertenecer a otra gerencia o no tener gerencia en hospital_extension.",
                idSeleccionMensual,
                excluidosGerencia);
        }

        var filtroOpcional = AplicarFiltrosOpcionales(candidatosCatalogo, extensionesDict, request);
        var candidatosElegibles = filtroOpcional.Candidatos;

        if (filtroOpcional.Excluidos > 0)
        {
            _logger.LogInformation(
                "Ranking para seleccion {IdSeleccionMensual}: {Excluidos} hospitales excluidos por filtros opcionales.",
                idSeleccionMensual,
                filtroOpcional.Excluidos);
        }

        if (candidatosElegibles.Count == 0)
        {
            throw new InvalidOperationException(
                "No hay hospitales candidatos de la gerencia de la selección para generar el ranking.");
        }

        var idsCandidatos = candidatosElegibles.Select(h => h.CodigoContacto).ToList();

        var ultimasSelecciones = await ObtenerUltimasSeleccionesAsync(
            idsCandidatos, seleccion.FechaSeleccion, seleccion.IdTipoGerencia.Value, cancellationToken);

        var idsConTallerRealizado = await ObtenerIdsConTallerRealizadoAsync(
            idsCandidatos, seleccion.FechaSeleccion, cancellationToken);

        var candidatos = candidatosElegibles
            .Select(h => ConstruirCandidato(h, extensionesDict, ultimasSelecciones, idsConTallerRealizado, seleccion.FechaSeleccion))
            .ToList();

        var resultado = RankingScoreEngine.ComputeRanking(candidatos, rankingConfig, _logger);

        var filtrosJson = JsonSerializer.Serialize(
            await ConstruirFiltrosEjecucionAsync(seleccion, request, cancellationToken));

        var ejecucion = new RankingEjecucion
        {
            IdSeleccionMensual = idSeleccionMensual,
            IdConfiguracion = configuracion.IdConfiguracion,
            VersionAlgoritmo = RankingScoreEngine.AlgoritmoVersion,
            CantidadSolicitada = request.Cantidad,
            CantidadCandidatos = candidatos.Count,
            PesosEfectivosJson = JsonSerializer.Serialize(resultado.PesosEfectivos),
            FiltrosJson = filtrosJson,
            FechaEjecucion = DateTime.UtcNow,
            IdUsuarioEjecucion = idUsuario,
            Hospitales = resultado.Hospitales
                .Take(request.Cantidad)
                .Select((h, idx) => CrearEjecucionHospital(h, idx + 1, configuracion))
                .ToList(),
        };

        _context.RankingsEjecuciones.Add(ejecucion);
        await _context.SaveChangesAsync(cancellationToken);

        // EF puede limpiar la navegación después de guardar una entidad no-tracked; la restauramos
        // para que el mapeo de salida no falle.
        ejecucion.Configuracion = configuracion;

        await VincularScoresASeleccionActualAsync(idSeleccionMensual, ejecucion, cancellationToken);

        _logger.LogInformation(
            "Ranking {IdRankingEjecucion} generado para seleccion {IdSeleccionMensual} con {Cantidad} candidatos y top {Top}.",
            ejecucion.IdRankingEjecucion,
            idSeleccionMensual,
            candidatos.Count,
            request.Cantidad);

        return await MapearDtoAsync(ejecucion, candidatosElegibles, cancellationToken);
    }

    public async Task<RankingEjecucionDto?> GetByIdAsync(
        int idRankingEjecucion,
        CancellationToken cancellationToken = default)
    {
        var ejecucion = await _context.RankingsEjecuciones
            .AsNoTracking()
            .Include(e => e.Configuracion)
            .Include(e => e.Hospitales)
            .FirstOrDefaultAsync(e => e.IdRankingEjecucion == idRankingEjecucion, cancellationToken);

        if (ejecucion is null)
        {
            return null;
        }

        var ids = ejecucion.Hospitales.Select(h => h.IdHospital).ToList();
        var hospitales = await _hospitalRepository.GetByIdsAsync(ids, cancellationToken);
        return await MapearDto(ejecucion, hospitales, cancellationToken);
    }

    public async Task<RankingEjecucionDto?> GetUltimaEjecucionAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default)
    {
        var ejecucion = await _context.RankingsEjecuciones
            .AsNoTracking()
            .Include(e => e.Configuracion)
            .Include(e => e.Hospitales)
            .Where(e => e.IdSeleccionMensual == idSeleccionMensual)
            .OrderByDescending(e => e.FechaEjecucion)
            .FirstOrDefaultAsync(cancellationToken);

        if (ejecucion is null)
        {
            return null;
        }

        var ids = ejecucion.Hospitales.Select(h => h.IdHospital).ToList();
        var hospitales = await _hospitalRepository.GetByIdsAsync(ids, cancellationToken);
        return await MapearDto(ejecucion, hospitales, cancellationToken);
    }

    public async Task<FiltrosDisponiblesDto> GetFiltrosDisponiblesAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default)
    {
        var seleccion = await ObtenerSeleccionEditableAsync(idSeleccionMensual, cancellationToken);

        if (seleccion.IdTipoGerencia is null)
        {
            throw new InvalidOperationException(
                "La selección no tiene gerencia configurada. Asigne la gerencia antes de consultar los filtros.");
        }

        var idsYaSeleccionados = await _context.SeleccionesHospitales
            .AsNoTracking()
            .Where(h => h.IdSeleccionMensual == idSeleccionMensual && h.IdHospital.HasValue)
            .Select(h => h.IdHospital!.Value)
            .ToListAsync(cancellationToken);

        var hospitales = await _hospitalRepository.GetHospitalesAsync(
            new HospitalFilterParams { ExcluirTipos = TiposExcluidosElegibilidad, TieneCoordenadas = true },
            cancellationToken);
        var preFiltro = hospitales
            .Where(h => !idsYaSeleccionados.Contains(h.CodigoContacto))
            .ToList();

        var idsPreFiltro = preFiltro.Select(h => h.CodigoContacto).ToList();
        var extensiones = await _extensionRepository.GetByHospitalIdsAsync(idsPreFiltro, cancellationToken);
        var extensionesDict = extensiones.ToDictionary(e => e.IdHospital);

        var (candidatosCatalogo, _) = FiltrarPorGerencia(
            preFiltro, extensionesDict, seleccion.IdTipoGerencia.Value);

        var codigosEstadoTexto = candidatosCatalogo
            .Select(h => h.CodigoEstado)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var codigosEstado = codigosEstadoTexto
            .Select(c => int.TryParse(c, out var v) ? (int?)v : null)
            .Where(v => v.HasValue)
            .Select(v => v!.Value)
            .Distinct()
            .ToList();

        var nombres = await _asokamContext.GenEstados
            .AsNoTracking()
            .Where(e => codigosEstado.Contains(e.CodigoEstado))
            .ToDictionaryAsync(
                e => e.CodigoEstado.ToString(),
                e => e.NombreEstado,
                cancellationToken);

        var locales = 0;
        var foraneos = 0;
        var sinClasificacion = 0;
        foreach (var hospital in candidatosCatalogo)
        {
            extensionesDict.TryGetValue(hospital.CodigoContacto, out var extension);
            var esMetropolitano = extension?.EsZonaMetropolitana;
            if (esMetropolitano == true)
            {
                locales++;
            }
            else if (esMetropolitano == false)
            {
                foraneos++;
            }
            else
            {
                sinClasificacion++;
            }
        }

        var idsRegionCandidatos = candidatosCatalogo
            .Select(h =>
            {
                extensionesDict.TryGetValue(h.CodigoContacto, out var extension);
                return extension?.IdRegion;
            })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var regiones = await _context.RegionesCat
            .AsNoTracking()
            .Where(r => idsRegionCandidatos.Contains(r.IdRegion))
            .ToListAsync(cancellationToken);

        return new FiltrosDisponiblesDto
        {
            Estados = codigosEstadoTexto
                .Select(c => new EstadoFiltroDto
                {
                    Codigo = c,
                    Nombre = nombres.TryGetValue(c, out var nombre) ? nombre : null,
                })
                .OrderBy(e => e.Nombre ?? e.Codigo)
                .ToList(),
            Regiones = regiones
                .Select(r => new RegionFiltroDto { IdRegion = r.IdRegion, Nombre = r.Nombre })
                .OrderBy(r => r.Nombre)
                .ToList(),
            Locales = locales,
            Foraneos = foraneos,
            SinClasificacion = sinClasificacion,
            TotalCandidatos = candidatosCatalogo.Count,
        };
    }

    private async Task<SeleccionMensual> ObtenerSeleccionEditableAsync(int idSeleccionMensual, CancellationToken ct)
    {
        var seleccion = await _seleccionRepository.GetByIdAsync(idSeleccionMensual, ct)
            ?? throw new InvalidOperationException($"La selección {idSeleccionMensual} no existe.");

        if (seleccion.Estado is SeleccionMensual.EstadoAutorizada or SeleccionMensual.EstadoCerrada)
        {
            throw new InvalidOperationException($"La selección {idSeleccionMensual} está {seleccion.Estado.ToLowerInvariant()} y no admite generación de ranking.");
        }

        return seleccion;
    }

    private async Task<ConfigRanking> CargarConfiguracionActivaAsync(CancellationToken ct)
    {
        var configuracion = await _context.ConfigsRanking
            .AsNoTracking()
            .Include(c => c.Factores)
            .FirstOrDefaultAsync(c => c.Activo, ct);

        if (configuracion is null)
        {
            throw new InvalidOperationException("No existe una configuración de ranking activa.");
        }

        var factoresActivos = configuracion.Factores.Where(f => f.Activo && f.Peso > 0).ToList();
        var sumaPesos = factoresActivos.Sum(f => f.Peso);
        if (sumaPesos != 100m)
        {
            throw new InvalidOperationException($"La configuración activa tiene pesos activos que suman {sumaPesos:F2}%; deben sumar 100.");
        }

        return configuracion;
    }

    private RankingConfig ConstruirRankingConfig(ConfigRanking configuracion)
    {
        var factores = configuracion.Factores
            .Where(f => f.Activo)
            .ToDictionary(f => f.Clave, f => f);

        var config = new RankingConfig
        {
            PesoAnestesias = factores.GetValueOrDefault("anestesias_totales")?.Peso ?? 0m,
            PesoQuirofanos = factores.GetValueOrDefault("numero_quirofanos")?.Peso ?? 0m,
            PesoRecencia = factores.GetValueOrDefault("recencia_seleccion")?.Peso ?? 0m,
            PesoAgrupabilidad = factores.GetValueOrDefault("agrupabilidad_geografica")?.Peso ?? 0m,
            PesoCoberturaTaller = factores.GetValueOrDefault("cobertura_taller")?.Peso ?? 0m,
        };

        AplicarParametrosFactor(config, "agrupabilidad_geografica", factores.GetValueOrDefault("agrupabilidad_geografica")?.ParametrosJson);
        AplicarParametrosFactor(config, "recencia_seleccion", factores.GetValueOrDefault("recencia_seleccion")?.ParametrosJson);
        AplicarParametrosFactor(config, "cobertura_taller", factores.GetValueOrDefault("cobertura_taller")?.ParametrosJson);

        return config;
    }

    /// <summary>
    /// Aplica los parametros_json del factor sobre la config del engine. JSON ausente,
    /// malformado o con claves faltantes conserva los defaults (mismos valores que el
    /// motor usa sin configuracion).
    /// </summary>
    internal static void AplicarParametrosFactor(RankingConfig config, string clave, string? parametrosJson)
    {
        if (string.IsNullOrWhiteSpace(parametrosJson))
        {
            return;
        }

        JsonElement root;
        try
        {
            using var doc = JsonDocument.Parse(parametrosJson);
            root = doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            // Ignorar JSON malformado y usar defaults
            return;
        }

        switch (clave)
        {
            case "agrupabilidad_geografica":
                if (root.TryGetProperty("radio_km", out var radio) && radio.TryGetDouble(out var radioKm))
                {
                    config.RadioAgrupabilidadKm = radioKm;
                }
                break;

            case "recencia_seleccion":
                if (root.TryGetProperty("nunca", out var recNunca) && recNunca.TryGetDecimal(out var scoreNunca))
                {
                    config.ScoreRecenciaNunca = scoreNunca;
                }
                if (root.TryGetProperty("reciente", out var recReciente) && recReciente.TryGetDecimal(out var scoreReciente))
                {
                    config.ScoreRecenciaReciente = scoreReciente;
                }
                if (root.TryGetProperty("tramos", out var tramos) && tramos.ValueKind == JsonValueKind.Array)
                {
                    var nuevos = new List<RecenciaTramo>();
                    foreach (var tramo in tramos.EnumerateArray())
                    {
                        if (tramo.TryGetProperty("meses_min", out var meses) && meses.TryGetInt32(out var mesesMin)
                            && tramo.TryGetProperty("score", out var score) && score.TryGetDecimal(out var scoreTramo))
                        {
                            nuevos.Add(new RecenciaTramo { MesesMin = mesesMin, Score = scoreTramo });
                        }
                    }

                    if (nuevos.Count > 0)
                    {
                        config.TramosRecencia = nuevos;
                    }
                }
                break;

            case "cobertura_taller":
                if (root.TryGetProperty("nunca", out var cobNunca) && cobNunca.TryGetDecimal(out var cNunca))
                {
                    config.ScoreCoberturaNunca = cNunca;
                }
                if (root.TryGetProperty("pendiente", out var cobPendiente) && cobPendiente.TryGetDecimal(out var cPendiente))
                {
                    config.ScoreCoberturaPendiente = cPendiente;
                }
                if (root.TryGetProperty("realizado", out var cobRealizado) && cobRealizado.TryGetDecimal(out var cRealizado))
                {
                    config.ScoreCoberturaRealizado = cRealizado;
                }
                break;
        }
    }

    private async Task<Dictionary<int, DateOnly>> ObtenerUltimasSeleccionesAsync(
        List<int> idsCandidatos,
        DateOnly fechaReferencia,
        int idTipoGerencia,
        CancellationToken ct)
    {
        // Historial de recencia: solo selecciones de la MISMA gerencia y ANTERIORES a la actual (ADR-00005 §8).
        var query = from sh in _context.SeleccionesHospitales.AsNoTracking()
                    join s in _context.SeleccionesMensuales.AsNoTracking()
                        on sh.IdSeleccionMensual equals s.IdSeleccionMensual
                    where sh.IdHospital.HasValue && s.Activo
                          && s.IdTipoGerencia == idTipoGerencia
                          && s.FechaSeleccion < fechaReferencia
                    let idHospital = sh.IdHospital!.Value
                    where idsCandidatos.Contains(idHospital)
                    group s.FechaSeleccion by idHospital into g
                    select new { IdHospital = g.Key, Fecha = g.Max() };

        var ultimas = await query.ToDictionaryAsync(x => x.IdHospital, x => x.Fecha, ct);
        return ultimas;
    }

    private async Task<HashSet<int>> ObtenerIdsConTallerRealizadoAsync(
        List<int> idsCandidatos,
        DateOnly fechaReferencia,
        CancellationToken ct)
    {
        // Cobertura efectiva: talleres con estado Realizado del historial del hospital
        // (id_hospital, sin depender de la trazabilidad a la seleccion de origen, que
        // puede ser NULL en talleres historicos). Un taller Cancelado cuenta como
        // cobertura pendiente, no como taller impartido. Se excluyen talleres fechados
        // en la seleccion actual o posterior al corte (misma referencia que la
        // recencia, ADR-00005 §8); los de la seleccion actual ya se excluyen de todos
        // modos como "ya agregados" antes de armar los candidatos.
        var ids = await _context.Talleres.AsNoTracking()
            .Where(t => t.IdHospital.HasValue
                && idsCandidatos.Contains(t.IdHospital.Value)
                && t.Estado == Taller.EstadoRealizado
                && (t.FechaTaller == null || t.FechaTaller < fechaReferencia))
            .Select(t => t.IdHospital!.Value)
            .Distinct()
            .ToListAsync(ct);

        return ids.ToHashSet();
    }

    internal static (List<Hospital> Candidatos, int Excluidos) FiltrarPorGerencia(
        List<Hospital> hospitales,
        Dictionary<int, HospitalExtension> extensionesDict,
        int idTipoGerencia)
    {
        var candidatos = new List<Hospital>();
        var excluidos = 0;

        foreach (var hospital in hospitales)
        {
            var extension = extensionesDict.GetValueOrDefault(hospital.CodigoContacto);
            if (extension?.IdTipoGerencia == idTipoGerencia)
            {
                candidatos.Add(hospital);
            }
            else
            {
                excluidos++;
            }
        }

        return (candidatos, excluidos);
    }

    internal static (List<Hospital> Candidatos, int Excluidos) AplicarFiltrosOpcionales(
        List<Hospital> hospitales,
        Dictionary<int, HospitalExtension> extensionesDict,
        GenerarRankingRequest request)
    {
        var normalizar = (string? s) => (s ?? string.Empty).Trim().ToUpperInvariant();
        var termino = normalizar(request.Search);

        var candidatos = new List<Hospital>();
        var excluidos = 0;

        foreach (var hospital in hospitales)
        {
            if (!string.IsNullOrEmpty(termino))
            {
                var texto = string.Join(" ",
                    normalizar(hospital.NombreContacto),
                    normalizar(hospital.NombreCorto),
                    normalizar(hospital.Ciudad),
                    normalizar(hospital.Colonia));
                if (!texto.Contains(termino, StringComparison.InvariantCultureIgnoreCase))
                {
                    excluidos++;
                    continue;
                }
            }

            if (!string.IsNullOrWhiteSpace(request.CodigoEstado))
            {
                if (!string.Equals(
                    normalizar(hospital.CodigoEstado),
                    normalizar(request.CodigoEstado),
                    StringComparison.OrdinalIgnoreCase))
                {
                    excluidos++;
                    continue;
                }
            }

            if (request.ZonaMetropolitana.HasValue || request.IdRegion.HasValue)
            {
                extensionesDict.TryGetValue(hospital.CodigoContacto, out var extension);
                if (request.ZonaMetropolitana.HasValue
                    && extension?.EsZonaMetropolitana != request.ZonaMetropolitana.Value)
                {
                    excluidos++;
                    continue;
                }
                if (request.IdRegion.HasValue && extension?.IdRegion != request.IdRegion.Value)
                {
                    excluidos++;
                    continue;
                }
            }

            candidatos.Add(hospital);
        }

        return (candidatos, excluidos);
    }

    private async Task<RankingFiltrosDto> ConstruirFiltrosEjecucionAsync(
        SeleccionMensual seleccion,
        GenerarRankingRequest request,
        CancellationToken ct)
    {
        var idGerencia = seleccion.IdTipoGerencia!.Value;
        var gerenciaDescripcion = await _context.TiposGerencia
            .AsNoTracking()
            .Where(t => t.IdTipoGerencia == idGerencia)
            .Select(t => t.Descripcion)
            .FirstOrDefaultAsync(ct);

        string? estadoNombre = null;
        var codigoEstadoNormalizado = string.IsNullOrWhiteSpace(request.CodigoEstado)
            ? null
            : request.CodigoEstado.Trim();

        if (!string.IsNullOrWhiteSpace(codigoEstadoNormalizado)
            && int.TryParse(codigoEstadoNormalizado, out var codigoEstadoInt))
        {
            estadoNombre = await _asokamContext.GenEstados
                .AsNoTracking()
                .Where(e => e.CodigoEstado == codigoEstadoInt)
                .Select(e => e.NombreEstado)
                .FirstOrDefaultAsync(ct);
        }

        string? nombreRegion = null;
        if (request.IdRegion.HasValue)
        {
            nombreRegion = await _context.RegionesCat
                .AsNoTracking()
                .Where(r => r.IdRegion == request.IdRegion.Value)
                .Select(r => r.Nombre)
                .FirstOrDefaultAsync(ct);
        }

        return new RankingFiltrosDto
        {
            Gerencia = new RankingGerenciaFiltroDto
            {
                Id = idGerencia,
                Descripcion = gerenciaDescripcion ?? $"Gerencia {idGerencia}",
            },
            Activo = true,
            ExcluyeTipos = [.. TiposExcluidosElegibilidad],
            ExcluyeYaAgregados = true,
            Search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim(),
            CodigoEstado = codigoEstadoNormalizado,
            EstadoNombre = estadoNombre,
            ZonaMetropolitana = request.ZonaMetropolitana,
            IdRegion = request.IdRegion,
            NombreRegion = nombreRegion,
            ReglaVersion = ReglaElegibilidadVersion,
        };
    }

    private static HospitalCandidato ConstruirCandidato(
        Hospital hospital,
        Dictionary<int, HospitalExtension> extensionesDict,
        Dictionary<int, DateOnly> ultimasSelecciones,
        HashSet<int> idsConTallerRealizado,
        DateOnly fechaReferencia)
    {
        extensionesDict.TryGetValue(hospital.CodigoContacto, out var extension);

        int? mesesDesdeUltimaSeleccion = null;
        if (ultimasSelecciones.TryGetValue(hospital.CodigoContacto, out var fechaUltima))
        {
            var meses = (fechaReferencia.Year - fechaUltima.Year) * 12 + (fechaReferencia.Month - fechaUltima.Month);
            mesesDesdeUltimaSeleccion = meses < 0 ? 0 : meses;
        }

        var cobertura = idsConTallerRealizado.Contains(hospital.CodigoContacto)
            ? CoberturaTallerEstado.Realizado
            : ultimasSelecciones.ContainsKey(hospital.CodigoContacto)
                ? CoberturaTallerEstado.Pendiente
                : CoberturaTallerEstado.Nunca;

        return new HospitalCandidato
        {
            IdHospital = hospital.CodigoContacto,
            AnestesiasTotales = extension?.AnestesiasTotales,
            NumeroQuirofanos = extension?.NumeroQuirofanos,
            MesesDesdeUltimaSeleccion = mesesDesdeUltimaSeleccion,
            Latitud = hospital.Latitud.HasValue ? (double)hospital.Latitud.Value : null,
            Longitud = hospital.Longitud.HasValue ? (double)hospital.Longitud.Value : null,
            EsZonaMetropolitana = extension?.EsZonaMetropolitana,
            EstadoCoberturaTaller = cobertura,
        };
    }

    private RankingEjecucionHospital CrearEjecucionHospital(
        HospitalScore score,
        int posicion,
        ConfigRanking configuracion)
    {
        var grupos = configuracion.Factores.ToDictionary(f => f.Clave, f => f.Grupo);
        var factoresDto = score.Factores
            .Select(f => new RankingFactorItemDto
            {
                Clave = f.Clave,
                Grupo = grupos.GetValueOrDefault(f.Clave),
                ValorCrudo = f.ValorCrudo,
                ScoreFactor = f.ScoreFactor,
                PesoConfigurado = f.PesoConfigurado,
                PesoEfectivo = f.PesoEfectivo,
                PuntosAportados = f.PuntosAportados,
                DatoDisponible = f.DatoDisponible,
                Aplicado = f.Aplicado,
                MotivoNoAplicado = f.MotivoNoAplicado,
            })
            .ToList();

        return new RankingEjecucionHospital
        {
            IdHospital = score.IdHospital,
            Posicion = posicion,
            ScoreTotal = score.ScoreTotal,
            PorcentajeCompletitud = score.PorcentajeCompletitud,
            EsTopSugerido = true,
            Decision = "SinDecision",
            FactoresJson = JsonSerializer.Serialize(factoresDto),
        };
    }

    private async Task VincularScoresASeleccionActualAsync(
        int idSeleccionMensual,
        RankingEjecucion ejecucion,
        CancellationToken ct)
    {
        var scoresDict = ejecucion.Hospitales.ToDictionary(h => h.IdHospital, h => h.ScoreTotal);
        var seleccionados = await _context.SeleccionesHospitales
            .Where(h => h.IdSeleccionMensual == idSeleccionMensual && h.IdHospital.HasValue)
            .ToListAsync(ct);

        foreach (var seleccionado in seleccionados)
        {
            var idHospital = seleccionado.IdHospital!.Value;
            if (scoresDict.TryGetValue(idHospital, out var score))
            {
                seleccionado.IdRankingEjecucion = ejecucion.IdRankingEjecucion;
                seleccionado.ScoreSugerencia = score;
            }
        }

        if (_context.ChangeTracker.HasChanges())
        {
            await _context.SaveChangesAsync(ct);
        }
    }

    private async Task<RankingEjecucionDto> MapearDtoAsync(
        RankingEjecucion ejecucion,
        List<Hospital> candidatosCatalogo,
        CancellationToken ct)
    {
        var ids = ejecucion.Hospitales.Select(h => h.IdHospital).ToList();
        var hospitales = candidatosCatalogo.Where(h => ids.Contains(h.CodigoContacto)).ToList();
        return await MapearDto(ejecucion, hospitales, ct);
    }

    private async Task<RankingEjecucionDto> MapearDto(
        RankingEjecucion ejecucion,
        List<Hospital> hospitales,
        CancellationToken ct)
    {
        var hospitalesDict = hospitales.ToDictionary(h => h.CodigoContacto);
        var configDto = new ConfigRankingResumenDto
        {
            IdConfiguracion = ejecucion.Configuracion.IdConfiguracion,
            Nombre = ejecucion.Configuracion.Nombre,
            Version = ejecucion.Configuracion.Version,
            Activo = ejecucion.Configuracion.Activo,
            Usada = true,
            FechaVigenciaInicio = ejecucion.Configuracion.FechaVigenciaInicio,
            FechaVigenciaFin = ejecucion.Configuracion.FechaVigenciaFin,
            FechaCreacion = ejecucion.Configuracion.FechaCreacion,
        };

        var pesosEfectivos = JsonSerializer.Deserialize<Dictionary<string, decimal>>(ejecucion.PesosEfectivosJson) ?? [];

        RankingFiltrosDto? filtros = null;
        if (!string.IsNullOrEmpty(ejecucion.FiltrosJson))
        {
            try
            {
                filtros = JsonSerializer.Deserialize<RankingFiltrosDto>(ejecucion.FiltrosJson);
            }
            catch (JsonException)
            {
                filtros = null;
            }
        }

        var nombresEstado = await CargarNombresEstadosAsync(hospitales, ct);
        var nombresInstitucion = await CargarNombresInstitucionesAsync(hospitales, ct);

        var catalogoFactores = await _context.ConfigsRankingFactores
            .AsNoTracking()
            .Where(f => f.IdConfiguracion == ejecucion.IdConfiguracion)
            .Select(f => new RankingFactorCatalogoDto
            {
                Clave = f.Clave,
                Nombre = f.Nombre,
                Descripcion = f.Descripcion,
                Grupo = f.Grupo,
            })
            .ToListAsync(ct);

        var cantidadYaAgregados = await _context.SeleccionesHospitales
            .AsNoTracking()
            .CountAsync(h => h.IdSeleccionMensual == ejecucion.IdSeleccionMensual && h.IdHospital.HasValue, ct);

        return new RankingEjecucionDto
        {
            IdRankingEjecucion = ejecucion.IdRankingEjecucion,
            IdSeleccionMensual = ejecucion.IdSeleccionMensual,
            Configuracion = configDto,
            VersionAlgoritmo = ejecucion.VersionAlgoritmo,
            CantidadSolicitada = ejecucion.CantidadSolicitada,
            CantidadCandidatos = ejecucion.CantidadCandidatos,
            CantidadYaAgregados = cantidadYaAgregados,
            PesosEfectivos = pesosEfectivos,
            FactoresCatalogo = catalogoFactores,
            Filtros = filtros,
            Ranking = ejecucion.Hospitales
                .OrderBy(h => h.Posicion)
                .Select(h => MapearHospitalDto(h, hospitalesDict, nombresEstado, nombresInstitucion))
                .ToList(),
        };
    }

    private async Task<Dictionary<string, string>> CargarNombresEstadosAsync(
        List<Hospital> hospitales,
        CancellationToken ct)
    {
        var codigos = hospitales
            .Select(h => h.CodigoEstado)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(c => c!)
            .ToList();

        if (codigos.Count == 0)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        var enteros = codigos
            .Select(c => int.TryParse(c, out var v) ? (int?)v : null)
            .Where(v => v.HasValue)
            .Select(v => v!.Value)
            .ToList();

        var nombres = await _asokamContext.GenEstados
            .AsNoTracking()
            .Where(e => enteros.Contains(e.CodigoEstado))
            .ToDictionaryAsync(
                e => e.CodigoEstado.ToString(),
                e => e.NombreEstado ?? $"Estado {e.CodigoEstado}",
                StringComparer.OrdinalIgnoreCase,
                ct);
        return nombres;
    }

    private async Task<Dictionary<int, string>> CargarNombresInstitucionesAsync(
        List<Hospital> hospitales,
        CancellationToken ct)
    {
        var idsPadres = hospitales
            .Where(h => h.CodigoContactoPrincipal.HasValue)
            .Select(h => h.CodigoContactoPrincipal!.Value)
            .Distinct()
            .ToList();

        if (idsPadres.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        var padres = await _hospitalRepository.GetByIdsAsync(idsPadres, ct);
        return padres.ToDictionary(
            p => p.CodigoContacto,
            p => p.NombreContacto ?? $"Institución {p.CodigoContacto}");
    }

    public async Task<List<SeleccionHospitalDto>> AplicarSugerenciasAsync(
        int idSeleccionMensual,
        AgregarHospitalesLoteRequest request,
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        _ = await ObtenerSeleccionEditableAsync(idSeleccionMensual, cancellationToken);

        var ejecucion = await ResolverEjecucionAsync(idSeleccionMensual, request.IdRankingEjecucion, cancellationToken);
        var hospitalesEjecucion = ejecucion.Hospitales.ToDictionary(h => h.IdHospital);

        var idsSolicitados = request.Hospitales.Select(h => h.IdHospital).ToList();
        var noEncontrados = idsSolicitados.Where(id => !hospitalesEjecucion.ContainsKey(id)).ToList();
        if (noEncontrados.Count > 0)
        {
            throw new InvalidOperationException(
                $"Los hospitales {string.Join(", ", noEncontrados)} no están en la ejecución del ranking.");
        }

        var yaSeleccionados = await _context.SeleccionesHospitales
            .Where(h => h.IdSeleccionMensual == idSeleccionMensual && h.IdHospital.HasValue)
            .Select(h => h.IdHospital!.Value)
            .ToListAsync(cancellationToken);

        var duplicados = idsSolicitados.Intersect(yaSeleccionados).ToList();
        if (duplicados.Count > 0)
        {
            throw new InvalidOperationException(
                $"Los hospitales {string.Join(", ", duplicados)} ya pertenecen a esta selección.");
        }

        var hospitalesAsokam = await _hospitalRepository.GetByIdsAsync(idsSolicitados, cancellationToken);
        var nombresHospitales = hospitalesAsokam.ToDictionary(h => h.CodigoContacto);

        var nuevos = new List<SeleccionHospital>();
        foreach (var item in request.Hospitales)
        {
            var hospitalEjecucion = hospitalesEjecucion[item.IdHospital];
            var hospital = nombresHospitales.GetValueOrDefault(item.IdHospital)
                ?? throw new InvalidOperationException($"El hospital {item.IdHospital} no existe en el catálogo.");

            var nuevo = new SeleccionHospital
            {
                IdSeleccionMensual = idSeleccionMensual,
                IdHospital = item.IdHospital,
                Region = hospital.Zona,
                EntidadFederativa = hospital.CodigoEstado,
                CiudadMunicipio = hospital.Ciudad,
                ProductoAPromocionar = item.ProductoAPromocionar,
                LatitudSnapshot = hospital.Latitud,
                LongitudSnapshot = hospital.Longitud,
                IdRankingEjecucion = ejecucion.IdRankingEjecucion,
                ScoreSugerencia = hospitalEjecucion.ScoreTotal,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario,
            };
            nuevos.Add(nuevo);

            hospitalEjecucion.Decision = hospitalEjecucion.EsTopSugerido
                ? "SugeridoSeleccionado"
                : "NoSugeridoSeleccionado";
        }

        _context.SeleccionesHospitales.AddRange(nuevos);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Se agregaron {Cantidad} hospitales a la selección {IdSeleccion} desde la ejecución {IdEjecucion}.",
            nuevos.Count,
            idSeleccionMensual,
            ejecucion.IdRankingEjecucion);

        return nuevos.Select(h => new SeleccionHospitalDto
        {
            IdSeleccionHospital = h.IdSeleccionHospital,
            IdHospital = h.IdHospital,
            NombreHospital = nombresHospitales.GetValueOrDefault(h.IdHospital!.Value)?.NombreContacto ?? $"Hospital {h.IdHospital}",
            Region = h.Region,
            EntidadFederativa = h.EntidadFederativa,
            CiudadMunicipio = h.CiudadMunicipio,
            ProductoAPromocionar = h.ProductoAPromocionar,
            Observaciones = h.Observaciones,
            LatitudSnapshot = h.LatitudSnapshot,
            LongitudSnapshot = h.LongitudSnapshot,
            IdRegion = h.IdRegion,
            ScoreSugerencia = ejecucion.Hospitales.FirstOrDefault(r => r.IdHospital == h.IdHospital)?.ScoreTotal,
            Origen = "Sugerencia",
        }).ToList();
    }

    private async Task<RankingEjecucion> ResolverEjecucionAsync(
        int idSeleccionMensual,
        int? idRankingEjecucion,
        CancellationToken ct)
    {
        RankingEjecucion? ejecucion;
        if (idRankingEjecucion.HasValue)
        {
            ejecucion = await _context.RankingsEjecuciones
                .Include(e => e.Hospitales)
                .FirstOrDefaultAsync(e => e.IdRankingEjecucion == idRankingEjecucion.Value && e.IdSeleccionMensual == idSeleccionMensual, ct);

            if (ejecucion is null)
            {
                throw new InvalidOperationException(
                    $"La ejecución {idRankingEjecucion.Value} no existe o no pertenece a la selección {idSeleccionMensual}.");
            }

            var ultima = await _context.RankingsEjecuciones
                .Where(e => e.IdSeleccionMensual == idSeleccionMensual)
                .OrderByDescending(e => e.FechaEjecucion)
                .Select(e => e.IdRankingEjecucion)
                .FirstOrDefaultAsync(ct);

            if (ultima != ejecucion.IdRankingEjecucion)
            {
                throw new InvalidOperationException(
                    "Solo se pueden aplicar hospitales desde la ejecución más reciente del ranking.");
            }
        }
        else
        {
            ejecucion = await _context.RankingsEjecuciones
                .Include(e => e.Hospitales)
                .Where(e => e.IdSeleccionMensual == idSeleccionMensual)
                .OrderByDescending(e => e.FechaEjecucion)
                .FirstOrDefaultAsync(ct);

            if (ejecucion is null)
            {
                throw new InvalidOperationException(
                    $"No existe una ejecución de ranking para la selección {idSeleccionMensual}.");
            }
        }

        return ejecucion;
    }

    private static RankingHospitalItemDto MapearHospitalDto(
        RankingEjecucionHospital item,
        Dictionary<int, Hospital> hospitalesDict,
        Dictionary<string, string> nombresEstado,
        Dictionary<int, string> nombresInstitucion)
    {
        var hospital = hospitalesDict.GetValueOrDefault(item.IdHospital);
        var factores = JsonSerializer.Deserialize<List<RankingFactorItemDto>>(item.FactoresJson) ?? [];

        var codigoEstado = hospital?.CodigoEstado;
        var entidadFederativa = codigoEstado is not null && nombresEstado.TryGetValue(codigoEstado, out var nombreEstado)
            ? nombreEstado
            : codigoEstado;

        var institucion = hospital?.CodigoContactoPrincipal.HasValue == true
            && nombresInstitucion.TryGetValue(hospital.CodigoContactoPrincipal.Value, out var nombreInst)
            ? nombreInst
            : null;

        return new RankingHospitalItemDto
        {
            IdHospital = item.IdHospital,
            NombreHospital = hospital?.NombreContacto ?? $"Hospital {item.IdHospital}",
            Institucion = institucion,
            CodigoEstado = codigoEstado,
            EntidadFederativa = entidadFederativa,
            CiudadMunicipio = hospital?.Ciudad,
            Posicion = item.Posicion,
            ScoreTotal = item.ScoreTotal,
            PorcentajeCompletitud = item.PorcentajeCompletitud,
            EsTopSugerido = item.EsTopSugerido,
            DatoCoordenadasDisponible = hospital?.Latitud.HasValue == true && hospital?.Longitud.HasValue == true,
            Factores = factores,
        };
    }
}
