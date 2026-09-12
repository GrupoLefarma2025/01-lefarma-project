namespace Lefarma.API.Features.EducacionMedica.Services;

public class HospitalCandidato
{
    public int IdHospital { get; set; }
    public decimal? AnestesiasTotales { get; set; }
    public int? NumeroQuirofanos { get; set; }
    public int? MesesDesdeUltimaSeleccion { get; set; } // null = nunca seleccionado
    public double? Latitud { get; set; }
    public double? Longitud { get; set; }
    public bool? EsZonaMetropolitana { get; set; }

    /// <summary>
    /// Cobertura efectiva: nunca estuvo en seleccion, estuvo sin taller realizado
    /// (pendiente de entrega), o ya tuvo un taller Realizado. Dato categorico;
    /// siempre disponible (default: Nunca).
    /// </summary>
    public CoberturaTallerEstado EstadoCoberturaTaller { get; set; } = CoberturaTallerEstado.Nunca;
}

/// <summary>
/// Estado de cobertura del hospital respecto a selecciones anteriores y talleres.
/// </summary>
public enum CoberturaTallerEstado
{
    /// <summary>Nunca estuvo en una seleccion mensual anterior (misma gerencia).</summary>
    Nunca = 0,

    /// <summary>Estuvo en seleccion anterior pero sin taller con estado Realizado.</summary>
    Pendiente = 1,

    /// <summary>Tiene al menos un taller con estado Realizado.</summary>
    Realizado = 2,
}

public class RankingConfig
{
    public decimal PesoAnestesias { get; set; }
    public decimal PesoQuirofanos { get; set; }
    public decimal PesoRecencia { get; set; }
    public decimal PesoAgrupabilidad { get; set; }
    public decimal PesoCoberturaTaller { get; set; }
    public double RadioAgrupabilidadKm { get; set; } = 50;

    // Scores de recencia (configurables via parametros_json del factor;
    // defaults decididos con el negocio, ver ADR-00005)
    public decimal ScoreRecenciaNunca { get; set; } = 100m;
    public decimal ScoreRecenciaReciente { get; set; } = 10m;
    public List<RecenciaTramo> TramosRecencia { get; set; } =
    [
        new() { MesesMin = 12, Score = 90 },
        new() { MesesMin = 6, Score = 70 },
        new() { MesesMin = 3, Score = 40 },
    ];

    // Scores de cobertura de taller (configurables via parametros_json)
    public decimal ScoreCoberturaNunca { get; set; } = 100m;
    public decimal ScoreCoberturaPendiente { get; set; } = 90m;
    public decimal ScoreCoberturaRealizado { get; set; } = 10m;
}

/// <summary>
/// Tramo de recencia: hospitales con meses desde la ultima seleccion >= MesesMin
/// reciben Score. Los tramos se evaluan de mayor a menor MesesMin y gana el
/// primero que aplique.
/// </summary>
public class RecenciaTramo
{
    public int MesesMin { get; set; }
    public decimal Score { get; set; }
}

public class FactorResult
{
    public required string Clave { get; set; }
    public decimal? ValorCrudo { get; set; }
    public decimal ScoreFactor { get; set; }
    public decimal PesoConfigurado { get; set; } // porcentaje 0-100
    public decimal PesoEfectivo { get; set; }    // porcentaje 0-100
    public decimal PuntosAportados { get; set; }
    public bool DatoDisponible { get; set; }
    public bool Aplicado { get; set; }
    public string? MotivoNoAplicado { get; set; }
}

public class HospitalScore
{
    public int IdHospital { get; set; }
    public decimal ScoreTotal { get; set; }
    public decimal PorcentajeCompletitud { get; set; }
    public List<FactorResult> Factores { get; set; } = [];
}

public class RankingResult
{
    public List<HospitalScore> Hospitales { get; set; } = [];
    public Dictionary<string, decimal> PesosEfectivos { get; set; } = [];
    public int CantidadCandidatos { get; set; }
}

public static class RankingScoreEngine
{
    public const string AlgoritmoVersion = "scoring-v1.1";

    public static RankingResult ComputeRanking(
        List<HospitalCandidato> candidatos,
        RankingConfig config,
        ILogger? logger = null)
    {
        ArgumentNullException.ThrowIfNull(candidatos);
        ArgumentNullException.ThrowIfNull(config);

        if (candidatos.Count == 0)
        {
            return new RankingResult { Hospitales = [], PesosEfectivos = [], CantidadCandidatos = 0 };
        }

        // 1) Calcular factores
        var anestesiasScores = CalcularPercentil(
            candidatos,
            c => c.AnestesiasTotales,
            "anestesias_totales");

        var quirofanosScores = CalcularPercentil(
            candidatos,
            c => c.NumeroQuirofanos,
            "numero_quirofanos");

        var recenciaScores = candidatos.ToDictionary(
            c => c.IdHospital,
            c => (Score: CalcularRecencia(c.MesesDesdeUltimaSeleccion, config), DatoDisponible: true));

        var agrupabilidadScores = CalcularAgrupabilidad(candidatos, config.RadioAgrupabilidadKm);

        var coberturaScores = candidatos.ToDictionary(
            c => c.IdHospital,
            c => (Score: CalcularCoberturaTaller(c.EstadoCoberturaTaller, config), DatoDisponible: true));

        // 2) Pesos efectivos
        var pesosConfig = new Dictionary<string, decimal>
        {
            ["anestesias_totales"] = config.PesoAnestesias,
            ["numero_quirofanos"] = config.PesoQuirofanos,
            ["recencia_seleccion"] = config.PesoRecencia,
            ["agrupabilidad_geografica"] = config.PesoAgrupabilidad,
            ["cobertura_taller"] = config.PesoCoberturaTaller,
        };

        // Detectar factores sin variabilidad
        var sinVariabilidad = DetectarSinVariabilidad(
            anestesiasScores, quirofanosScores, recenciaScores, agrupabilidadScores, coberturaScores);

        var pesosEfectivos = CalcularPesosEfectivos(pesosConfig, sinVariabilidad);

        // 3) Componer HospitalScore
        var hospitales = new List<HospitalScore>();
        foreach (var c in candidatos)
        {
            var factores = new List<FactorResult>
            {
                CrearFactor("anestesias_totales", "Potencial", c.AnestesiasTotales, anestesiasScores[c.IdHospital], pesosConfig, pesosEfectivos),
                CrearFactor("numero_quirofanos", "Potencial", c.NumeroQuirofanos, quirofanosScores[c.IdHospital], pesosConfig, pesosEfectivos),
                CrearFactor("recencia_seleccion", "Cobertura", null, recenciaScores[c.IdHospital], pesosConfig, pesosEfectivos, rawOverride: c.MesesDesdeUltimaSeleccion),
                CrearFactor("cobertura_taller", "Cobertura", null, coberturaScores[c.IdHospital], pesosConfig, pesosEfectivos),
                CrearFactor("agrupabilidad_geografica", "Geografia", null, agrupabilidadScores[c.IdHospital], pesosConfig, pesosEfectivos),
            };

            var activos = factores.Where(f => f.PesoConfigurado > 0).ToList();
            var completitud = activos.Count == 0
                ? 100m
                : activos.Count(f => f.DatoDisponible) * 100m / activos.Count;

            var score = factores
                .Where(f => f.Aplicado)
                .Sum(f => f.ScoreFactor * f.PesoEfectivo / 100m);

            hospitales.Add(new HospitalScore
            {
                IdHospital = c.IdHospital,
                ScoreTotal = Math.Round(score, 2, MidpointRounding.AwayFromZero),
                PorcentajeCompletitud = Math.Round(completitud, 2, MidpointRounding.AwayFromZero),
                Factores = factores,
            });
        }

        // 4) Ordenar determinísticamente y asignar posición
        var ordenados = hospitales
            .OrderByDescending(h => h.ScoreTotal)
            .ThenBy(h => h.IdHospital)
            .Select((h, idx) =>
            {
                h.ScoreTotal = Math.Round(h.ScoreTotal, 2, MidpointRounding.AwayFromZero);
                return new { Hospital = h, Posicion = idx + 1 };
            })
            .ToList();

        var resultado = ordenados.Select(x => x.Hospital).ToList();

        return new RankingResult
        {
            Hospitales = resultado,
            PesosEfectivos = pesosEfectivos.ToDictionary(kv => kv.Key, kv => Math.Round(kv.Value, 2)),
            CantidadCandidatos = candidatos.Count,
        };
    }

    private static FactorResult CrearFactor(
        string clave,
        string grupo,
        decimal? rawValue,
        (decimal Score, bool DatoDisponible) scoreInfo,
        Dictionary<string, decimal> pesosConfig,
        Dictionary<string, decimal> pesosEfectivos,
        int? rawOverride = null)
    {
        var pesoConfig = pesosConfig.GetValueOrDefault(clave, 0m);
        var pesoEfectivo = pesosEfectivos.GetValueOrDefault(clave, 0m);
        var puntos = Math.Round(scoreInfo.Score * pesoEfectivo / 100m, 2, MidpointRounding.AwayFromZero);

        return new FactorResult
        {
            Clave = clave,
            ValorCrudo = rawOverride.HasValue ? rawOverride.Value : rawValue,
            ScoreFactor = Math.Round(scoreInfo.Score, 2, MidpointRounding.AwayFromZero),
            PesoConfigurado = pesoConfig,
            PesoEfectivo = Math.Round(pesoEfectivo, 2),
            PuntosAportados = puntos,
            DatoDisponible = scoreInfo.DatoDisponible,
            Aplicado = pesoEfectivo > 0,
            MotivoNoAplicado = pesoEfectivo == 0 ? "sin_variabilidad" : null,
        };
    }

    private static Dictionary<int, (decimal Score, bool DatoDisponible)> CalcularPercentil(
        List<HospitalCandidato> candidatos,
        Func<HospitalCandidato, decimal?> selector,
        string factor)
    {
        var conValor = candidatos
            .Where(c => selector(c).HasValue)
            .Select(c => new { c.IdHospital, Valor = selector(c)!.Value })
            .ToList();

        if (conValor.Count == 0)
        {
            return candidatos.ToDictionary(c => c.IdHospital, _ => (50m, false));
        }

        var ordenados = conValor
            .OrderBy(x => x.Valor)
            .ToList();

        // Asignar ranking promedio para empates (1-indexado)
        var grupos = ordenados
            .GroupBy(x => x.Valor)
            .Select(g => new { Valor = g.Key, Hospitales = g.ToList() })
            .ToList();

        var rankPromedio = new Dictionary<decimal, decimal>();
        int pos = 1;
        foreach (var g in grupos)
        {
            int start = pos;
            int end = pos + g.Hospitales.Count - 1;
            rankPromedio[g.Valor] = (start + end) / 2m;
            pos = end + 1;
        }

        var percentiles = conValor.ToDictionary(
            x => x.IdHospital,
            x => (Math.Round(rankPromedio[x.Valor] / conValor.Count * 100m, 2), true));

        foreach (var c in candidatos.Where(c => !selector(c).HasValue))
        {
            percentiles[c.IdHospital] = (50m, false);
        }

        return percentiles;
    }

    private static decimal CalcularRecencia(int? mesesDesdeUltimaSeleccion, RankingConfig config)
    {
        if (mesesDesdeUltimaSeleccion is null) return config.ScoreRecenciaNunca;

        foreach (var tramo in config.TramosRecencia.OrderByDescending(t => t.MesesMin))
        {
            if (mesesDesdeUltimaSeleccion.Value >= tramo.MesesMin)
            {
                return tramo.Score;
            }
        }

        return config.ScoreRecenciaReciente;
    }

    /// <summary>
    /// Scores del factor cobertura_taller: prioriza cobertura pendiente y hospitales
    /// nunca seleccionados; penaliza los que ya recibieron taller. Scores por defecto
    /// decididos con el negocio, configurables via parametros_json del factor.
    /// </summary>
    private static decimal CalcularCoberturaTaller(CoberturaTallerEstado estado, RankingConfig config) => estado switch
    {
        CoberturaTallerEstado.Nunca => config.ScoreCoberturaNunca,
        CoberturaTallerEstado.Pendiente => config.ScoreCoberturaPendiente,
        CoberturaTallerEstado.Realizado => config.ScoreCoberturaRealizado,
        _ => config.ScoreCoberturaNunca,
    };

    private static Dictionary<int, (decimal Score, bool DatoDisponible)> CalcularAgrupabilidad(
        List<HospitalCandidato> candidatos,
        double radioKm)
    {
        var conCoordenadas = candidatos
            .Where(c => c.Latitud.HasValue && c.Longitud.HasValue)
            .ToList();

        var resultados = new Dictionary<int, (decimal Score, bool DatoDisponible)>();

        foreach (var c in candidatos)
        {
            if (!c.Latitud.HasValue || !c.Longitud.HasValue)
            {
                resultados[c.IdHospital] = (50m, false);
                continue;
            }

            bool? clasificacion = c.EsZonaMetropolitana;
            // Sin clasificación → se comporta como foráneo (criterio conservador de ADR-00004)
            bool esForaneo = clasificacion != true;

            var vecinos = conCoordenadas
                .Where(v => v.IdHospital != c.IdHospital)
                .Where(v =>
                {
                    // Vecino compatible: misma clasificación (foráneo vs local)
                    bool vecinoForaneo = v.EsZonaMetropolitana != true;
                    return vecinoForaneo == esForaneo;
                })
                .Where(v => Haversine.DistanciaKm(
                    c.Latitud.Value,
                    c.Longitud.Value,
                    v.Latitud!.Value,
                    v.Longitud!.Value) <= radioKm)
                .ToList();

            decimal score;
            if (esForaneo)
            {
                score = vecinos.Count switch
                {
                    0 => 0m,
                    1 => 25m,
                    2 => 50m,
                    _ => 100m,
                };
            }
            else
            {
                // Local: percentil del conteo de vecinos compatibles
                var todosVecinosLocales = conCoordenadas
                    .Where(v => v.EsZonaMetropolitana == true && v.IdHospital != c.IdHospital)
                    .Select(v => conCoordenadas.Count(otro =>
                        otro.IdHospital != v.IdHospital &&
                        otro.EsZonaMetropolitana == true &&
                        Haversine.DistanciaKm(v.Latitud!.Value, v.Longitud!.Value, otro.Latitud!.Value, otro.Longitud!.Value) <= radioKm))
                    .OrderBy(n => n)
                    .ToList();

                var esteVecinos = vecinos.Count;
                score = CalcularPercentilSobreLista(todosVecinosLocales, esteVecinos);
            }

            resultados[c.IdHospital] = (score, true);
        }

        return resultados;
    }

    private static decimal CalcularPercentilSobreLista(List<int> valoresOrdenados, int valor)
    {
        if (valoresOrdenados.Count == 0) return 50m;
        if (valoresOrdenados.Count == 1) return 100m;

        var grupos = valoresOrdenados
            .GroupBy(v => v)
            .OrderBy(g => g.Key)
            .ToList();

        int pos = 1;
        var rankPromedio = new Dictionary<int, decimal>();
        foreach (var g in grupos)
        {
            int start = pos;
            int end = pos + g.Count() - 1;
            rankPromedio[g.Key] = (start + end) / 2m;
            pos = end + 1;
        }

        return Math.Round(rankPromedio.GetValueOrDefault(valor, pos - 1) / valoresOrdenados.Count * 100m, 2);
    }

    private static HashSet<string> DetectarSinVariabilidad(
        Dictionary<int, (decimal Score, bool)> anestesias,
        Dictionary<int, (decimal Score, bool)> quirofanos,
        Dictionary<int, (decimal Score, bool)> recencia,
        Dictionary<int, (decimal Score, bool)> agrupabilidad,
        Dictionary<int, (decimal Score, bool)> coberturaTaller)
    {
        var sinVariabilidad = new HashSet<string>();

        void Revisar(string clave, Dictionary<int, (decimal Score, bool)> scores)
        {
            if (scores.Count == 0) return;
            var min = scores.Min(s => s.Value.Score);
            var max = scores.Max(s => s.Value.Score);
            if (min == max) sinVariabilidad.Add(clave);
        }

        Revisar("anestesias_totales", anestesias);
        Revisar("numero_quirofanos", quirofanos);
        Revisar("recencia_seleccion", recencia);
        Revisar("agrupabilidad_geografica", agrupabilidad);
        Revisar("cobertura_taller", coberturaTaller);

        return sinVariabilidad;
    }

    private static Dictionary<string, decimal> CalcularPesosEfectivos(
        Dictionary<string, decimal> pesosConfig,
        HashSet<string> sinVariabilidad)
    {
        var factoresConPeso = pesosConfig
            .Where(kv => kv.Value > 0)
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        var aplicables = factoresConPeso
            .Where(kv => !sinVariabilidad.Contains(kv.Key))
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        var constantes = factoresConPeso
            .Where(kv => sinVariabilidad.Contains(kv.Key))
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        if (aplicables.Count == 0)
        {
            // Todos constantes: mantener pesos configurados redondeados
            return pesosConfig.ToDictionary(kv => kv.Key, kv => Math.Round(kv.Value, 2));
        }

        var totalConPeso = factoresConPeso.Values.Sum();
        if (totalConPeso == 0)
        {
            return pesosConfig.ToDictionary(kv => kv.Key, _ => 0m);
        }

        var normalizados = factoresConPeso.ToDictionary(
            kv => kv.Key,
            kv => totalConPeso == 100m ? kv.Value : kv.Value * 100m / totalConPeso);

        var pesoARedistribuir = constantes.Keys.Sum(k => normalizados[k]);
        var baseAplicable = aplicables.Keys.Sum(k => normalizados[k]);

        var efectivos = new Dictionary<string, decimal>();
        foreach (var kv in pesosConfig)
        {
            if (kv.Value == 0 || constantes.ContainsKey(kv.Key))
            {
                efectivos[kv.Key] = 0m;
                continue;
            }

            var normalizado = normalizados[kv.Key];
            var adicional = baseAplicable == 0
                ? 0m
                : normalizado / baseAplicable * pesoARedistribuir;
            efectivos[kv.Key] = normalizado + adicional;
        }

        // Redondear y ajustar residuo al mayor entre factores activos
        var redondeados = efectivos.ToDictionary(kv => kv.Key, kv => Math.Round(kv.Value, 2));
        var sumaActivos = redondeados.Values.Sum(v => v);
        var residuo = 100m - sumaActivos;

        if (residuo != 0)
        {
            var candidatosResiduo = redondeados
                .Where(r => r.Value > 0)
                .OrderByDescending(r => r.Value)
                .ThenBy(r => r.Key)
                .ToList();

            if (candidatosResiduo.Count > 0)
            {
                redondeados[candidatosResiduo.First().Key] += residuo;
            }
        }

        // Asegurar que factores sin peso o constantes queden exactamente en 0
        foreach (var kv in pesosConfig.Where(kv => kv.Value == 0 || constantes.ContainsKey(kv.Key)))
        {
            redondeados[kv.Key] = 0m;
        }

        return redondeados;
    }
}
