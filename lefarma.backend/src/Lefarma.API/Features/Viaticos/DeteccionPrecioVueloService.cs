using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Lefarma.API.Features.Viaticos.DTOs;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Viaticos;

/// <summary>Resultado de intentar detectar el precio real de un vuelo.</summary>
public sealed class DeteccionVueloResult
{
    public bool Ok { get; init; }
    public string? Error { get; init; }
    public bool Bloqueado { get; init; }
    /// <summary>playwright | firecrawl</summary>
    public string? Fuente { get; init; }
    public string? RutaCaptura { get; init; }
    /// <summary>opcion (tarjeta recortada) | resultados (página completa).</summary>
    public string? CapturaAlcance { get; init; }
    public VueloDetectado? Elegido { get; init; }
    public List<VueloDetectado> Opciones { get; init; } = new();
}

public interface IDeteccionPrecioVueloService
{
    Task<DeteccionVueloResult> DetectarAsync(
        string url,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi,
        string nombre,
        bool capturar,
        CancellationToken ct);
}

/// <summary>
/// Detección híbrida: primero Playwright local (parser del mini programa);
/// si Kayak responde captcha/bloqueo o no hay tarjetas, cae a Firecrawl
/// (/v2/scrape markdown + screenshot) y usa el mismo parser.
///
/// La captura es obligatoria: si la fuente no deja PNG, el intento se declara
/// fallido para que el usuario use el respaldo manual en lugar de guardar un
/// precio sin evidencia.
/// </summary>
public sealed class DeteccionPrecioVueloService : IDeteccionPrecioVueloService
{
    private readonly DeteccionPrecioSettings _settings;
    private readonly CapturasSettings _capturas;
    private readonly ICapturasScriptRunner _runner;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<DeteccionPrecioVueloService> _logger;
    private readonly CapturasService _capturasService;
    private readonly string _scriptPath;
    private readonly string _frontendRoot;
    private readonly string _capturasDir;

    public DeteccionPrecioVueloService(
        IOptions<DeteccionPrecioSettings> settings,
        IOptions<CapturasSettings> capturas,
        IWebHostEnvironment env,
        ICapturasScriptRunner runner,
        IHttpClientFactory http,
        ILogger<DeteccionPrecioVueloService> logger,
        CapturasService capturasService)
    {
        _settings = settings.Value;
        _capturas = capturas.Value;
        _runner = runner;
        _http = http;
        _logger = logger;
        _capturasService = capturasService;

        _frontendRoot = ResolverFrontendRoot(env, _capturas) ?? string.Empty;
        _scriptPath = string.IsNullOrWhiteSpace(_settings.ScriptPath)
            ? (string.IsNullOrWhiteSpace(_frontendRoot)
                ? string.Empty
                : Path.Combine(_frontendRoot, "scripts", "detectar-vuelos.mjs"))
            : _settings.ScriptPath;
        _capturasDir = CapturasService.ResolverDirectorioCapturas(env, _capturas);
        Directory.CreateDirectory(_capturasDir);
    }

    public async Task<DeteccionVueloResult> DetectarAsync(
        string url,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi,
        string nombre,
        bool capturar,
        CancellationToken ct)
    {
        var playwright = await IntentarPlaywrightAsync(url, nombre, capturar, ct);
        if (playwright.Ok && playwright.Opciones.Count > 0)
        {
            var eleccionPlaywright = Elegir(playwright, fecha, deadline, minutosTaxi);
            if (eleccionPlaywright.Elegido is not null)
                return capturar
                    ? await ConCapturaDeOpcionAsync(eleccionPlaywright, url, nombre, ct)
                    : eleccionPlaywright;

            // Playwright vio tarjetas pero ninguna llega a tiempo. Kayak puede
            // tener más resultados que la primera carga del DOM; Firecrawl se
            // usa como segunda opinión antes de declarar que no hay opción.
            _logger.LogInformation(
                "Playwright sin vuelo a tiempo para {Url}; se consulta Firecrawl.",
                url);
        }
        else
        {
            _logger.LogInformation(
                "Deteccion Playwright sin resultado para {Url}: {Error}. Se intenta Firecrawl.",
                url, playwright.Error);
        }

        var firecrawl = await IntentarFirecrawlAsync(url, nombre, capturar, ct);
        if (firecrawl.Ok && firecrawl.Opciones.Count > 0)
        {
            // Se combinan ambas fuentes: Playwright puede tener tarjetas que
            // Firecrawl no renderizó y viceversa. La captura que se guarda es
            // la de Firecrawl, que sí incluye el resultado elegido.
            var combinadas = playwright.Opciones
                .Concat(firecrawl.Opciones)
                .GroupBy(o => (o.Salida, o.Llegada, o.Aerolinea, o.Precio))
                .Select(g => g.First())
                .ToList();
            var combinada = new ResultadoFuente
            {
                Ok = true,
                Fuente = "firecrawl",
                RutaCaptura = firecrawl.RutaCaptura,
                Opciones = combinadas,
            };
            var resultadoCombinado = Elegir(combinada, fecha, deadline, minutosTaxi);
            return capturar
                ? await ConCapturaDeOpcionAsync(resultadoCombinado, url, nombre, ct)
                : resultadoCombinado;
        }

        if (playwright.Ok && playwright.Opciones.Count > 0)
        {
            // Firecrawl no respondió: se conserva el veredicto de Playwright.
            var resultadoPlaywright = Elegir(playwright, fecha, deadline, minutosTaxi);
            return capturar
                ? await ConCapturaDeOpcionAsync(resultadoPlaywright, url, nombre, ct)
                : resultadoPlaywright;
        }

        return new DeteccionVueloResult
        {
            Ok = false,
            Bloqueado = playwright.Bloqueado || firecrawl.Bloqueado,
            Error = $"Playwright: {playwright.Error}. Firecrawl: {firecrawl.Error}.",
            Opciones = firecrawl.Opciones,
        };
    }

    /// <summary>
    /// Regla de selección, separada para probarla sin Playwright ni Firecrawl:
    /// descarta anuncios si hay alternativas, calcula la llegada al punto
    /// (fecha + posible +1 día + minutos de taxi) y devuelve el más barato que
    /// llega antes del deadline. Sin deadline, el más barato.
    /// </summary>
    public static VueloDetectado? ElegirMasBaratoATiempo(
        IEnumerable<VueloDetectado> opciones,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi)
    {
        var lista = opciones.ToList();
        if (lista.Count == 0) return null;

        var sinAnuncios = lista.Where(o => !o.Patrocinado).ToList();
        var pool = sinAnuncios.Count > 0 ? sinAnuncios : lista;

        var conTiempo = pool
            .Select(vuelo => new
            {
                Vuelo = vuelo,
                LlegadaFinal = fecha
                    .ToDateTime(vuelo.Llegada)
                    .AddDays(vuelo.DiasLlegada)
                    .AddMinutes(minutosTaxi),
            })
            .ToList();

        var aTiempo = deadline is null
            ? conTiempo
            : conTiempo.Where(x => x.LlegadaFinal <= deadline.Value).ToList();

        if (aTiempo.Count == 0) return null;

        return aTiempo
            .OrderBy(x => x.Vuelo.Precio)
            .ThenBy(x => x.Vuelo.DuracionMin ?? int.MaxValue)
            .First()
            .Vuelo;
    }

    private DeteccionVueloResult Elegir(
        ResultadoFuente fuente,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi)
    {
        var elegido = ElegirMasBaratoATiempo(fuente.Opciones, fecha, deadline, minutosTaxi);
        if (elegido is null)
        {
            return new DeteccionVueloResult
            {
                Ok = false,
                Error = deadline is null
                    ? "No se detectaron vuelos con precio."
                    : $"Ningún vuelo detectado llega antes de {deadline.Value:dd/MM HH:mm}.",
                Fuente = fuente.Fuente,
                RutaCaptura = fuente.RutaCaptura,
                Opciones = fuente.Opciones,
            };
        }

        return new DeteccionVueloResult
        {
            Ok = true,
            Fuente = fuente.Fuente,
            RutaCaptura = fuente.RutaCaptura,
            Elegido = elegido,
            Opciones = fuente.Opciones,
        };
    }

    /// <summary>
    /// Reemplaza la captura de la página completa por la tarjeta del vuelo
    /// elegido. Si el recorte falla, conserva la captura de resultados.
    /// </summary>
    private async Task<DeteccionVueloResult> ConCapturaDeOpcionAsync(
        DeteccionVueloResult resultado,
        string url,
        string nombre,
        CancellationToken ct)
    {
        if (!resultado.Ok
            || resultado.Elegido is null)
        {
            return resultado;
        }

        try
        {
            using var captureCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            captureCts.CancelAfter(TimeSpan.FromSeconds(35));
            var captura = await _capturasService.CapturarOpcionAsync(
                new CapturaItem
                {
                    Url = url,
                    Nombre = nombre,
                    Tipo = "vuelo",
                    Linea = resultado.Elegido.Aerolinea,
                    Precio = resultado.Elegido.Precio,
                    Salida = resultado.Elegido.Salida.ToString("HH:mm", CultureInfo.InvariantCulture),
                    Llegada = resultado.Elegido.Llegada.ToString("HH:mm", CultureInfo.InvariantCulture),
                    Objetivo = resultado.Elegido.Aerolinea,
                },
                captureCts.Token);

            if (captura is not { Ok: true, Archivo: not null }
                || !string.Equals(captura.Alcance, "opcion", StringComparison.OrdinalIgnoreCase))
            {
                // Si no se pudo recortar, se conserva la captura original
                // (Playwright o Firecrawl); no se reemplaza por otra general.
                return resultado;
            }

            return new DeteccionVueloResult
            {
                Ok = true,
                Error = resultado.Error,
                Bloqueado = resultado.Bloqueado,
                Fuente = resultado.Fuente,
                RutaCaptura = captura.Archivo,
                CapturaAlcance = captura.Alcance ?? "opcion",
                Elegido = resultado.Elegido,
                Opciones = resultado.Opciones,
            };
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("La captura recortada del vuelo {Url} excedió 35s; se conserva la de resultados.", url);
            return resultado;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo recortar la captura del vuelo {Url}", url);
            return resultado;
        }
    }

    private async Task<ResultadoFuente> IntentarPlaywrightAsync(
        string url,
        string nombre,
        bool capturar,
        CancellationToken ct)
    {
        if (!File.Exists(_scriptPath))
            return ResultadoFuente.Fallo($"no existe el script {_scriptPath}");

        var input = JsonSerializer.Serialize(new { url, nombre, capturar });
        var run = await _runner.RunAsync(_scriptPath, input, _settings.TimeoutSeconds, ct);
        if (string.IsNullOrWhiteSpace(run.Stdout))
        {
            return ResultadoFuente.Fallo(
                run.KilledByTimeout
                    ? "Playwright excedió el tiempo máximo."
                    : $"Playwright no devolvió salida: {Recortar(run.Stderr, 200)}");
        }

        try
        {
            using var doc = JsonDocument.Parse(run.Stdout.Trim());
            var raiz = doc.RootElement;
            if (!raiz.TryGetProperty("ok", out var ok) || ok.ValueKind != JsonValueKind.True)
            {
                var error = raiz.TryGetProperty("error", out var e) && e.ValueKind == JsonValueKind.String
                    ? e.GetString()
                    : "Playwright no generó resultados.";
                var bloqueado = raiz.TryGetProperty("bloqueado", out var b)
                    && b.ValueKind == JsonValueKind.True;
                return ResultadoFuente.Fallo(error ?? "Playwright no generó resultados.", bloqueado);
            }

            if (!raiz.TryGetProperty("tarjetas", out var tarjetas)
                || tarjetas.ValueKind != JsonValueKind.Array
                || tarjetas.GetArrayLength() == 0)
            {
                return ResultadoFuente.Fallo("Playwright no devolvió tarjetas de resultados.");
            }

            var texto = string.Join(
                "\n",
                tarjetas.EnumerateArray()
                    .Where(t => t.ValueKind == JsonValueKind.String)
                    .Select(t => t.GetString() ?? string.Empty));

            var parseo = VuelosKayakParser.Parsear(texto);
            if (!parseo.Ok) return ResultadoFuente.Fallo(parseo.Error ?? "sin vuelos reconocibles", parseo.Bloqueado);

            var archivo = raiz.TryGetProperty("archivo", out var a) && a.ValueKind == JsonValueKind.String
                ? a.GetString()
                : null;
            var ruta = capturar ? CopiarCapturaDePlaywright(archivo) : null;
            if (capturar && ruta is null)
                return ResultadoFuente.Fallo("Playwright no dejó una captura utilizable.");

            return new ResultadoFuente
            {
                Ok = true,
                Fuente = "playwright",
                RutaCaptura = ruta,
                Opciones = parseo.Opciones,
            };
        }
        catch (JsonException)
        {
            return ResultadoFuente.Fallo($"salida de Playwright no parseable: {Recortar(run.Stdout, 200)}");
        }
    }

    private async Task<ResultadoFuente> IntentarFirecrawlAsync(
        string url,
        string nombre,
        bool capturar,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.FirecrawlBaseUrl)
            || string.IsNullOrWhiteSpace(_settings.FirecrawlApiKey))
        {
            return ResultadoFuente.Fallo("Firecrawl no está configurado.");
        }

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(Math.Max(20, _settings.FirecrawlTimeoutSeconds)));
            var cliente = _http.CreateClient("firecrawl");
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_settings.FirecrawlBaseUrl.TrimEnd('/')}/v2/scrape");
            request.Headers.Authorization = new AuthenticationHeaderValue(
                "Bearer", _settings.FirecrawlApiKey.Trim());
            request.Content = JsonContent.Create(new
            {
                url,
                formats = capturar ? new[] { "markdown", "screenshot" } : new[] { "markdown" },
                onlyMainContent = false,
            });

            using var respuesta = await cliente.SendAsync(request, cts.Token);
            var cuerpo = await respuesta.Content.ReadAsStringAsync(cts.Token);
            if (!respuesta.IsSuccessStatusCode)
                return ResultadoFuente.Fallo($"Firecrawl {respuesta.StatusCode}: {Recortar(cuerpo, 200)}");

            using var doc = JsonDocument.Parse(cuerpo);
            var raiz = doc.RootElement;
            if (!raiz.TryGetProperty("success", out var success) || success.ValueKind != JsonValueKind.True
                || !raiz.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            {
                return ResultadoFuente.Fallo($"Firecrawl sin datos: {Recortar(cuerpo, 200)}");
            }

            var markdown = data.TryGetProperty("markdown", out var md) && md.ValueKind == JsonValueKind.String
                ? md.GetString()
                : null;
            if (string.IsNullOrWhiteSpace(markdown))
                return ResultadoFuente.Fallo("Firecrawl no devolvió markdown.");

            var ruta = capturar ? GuardarCapturaFirecrawl(data, nombre) : null;
            if (capturar && ruta is null)
                return ResultadoFuente.Fallo("Firecrawl no devolvió una captura utilizable.");

            var parseo = VuelosKayakParser.Parsear(markdown);
            if (!parseo.Ok) return ResultadoFuente.Fallo(parseo.Error ?? "sin vuelos reconocibles", parseo.Bloqueado);

            return new ResultadoFuente
            {
                Ok = true,
                Fuente = "firecrawl",
                RutaCaptura = ruta,
                Opciones = parseo.Opciones,
            };
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return ResultadoFuente.Fallo("Firecrawl excedió el tiempo máximo.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Firecrawl falló para {Url}", url);
            return ResultadoFuente.Fallo(Recortar(ex.Message, 200));
        }
    }

    private string? CopiarCapturaDePlaywright(string? archivo)
    {
        if (string.IsNullOrWhiteSpace(archivo)) return null;
        try
        {
            var origen = Path.Combine(
                _frontendRoot,
                "public",
                archivo.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(origen)) return null;

            var destino = Path.Combine(_capturasDir, Path.GetFileName(archivo));
            File.Copy(origen, destino, overwrite: true);
            return $"{CapturasService.CarpetaPublica}/{Path.GetFileName(archivo)}";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo copiar la captura de Playwright {Archivo}", archivo);
            return null;
        }
    }

    private string? GuardarCapturaFirecrawl(JsonElement data, string nombre)
    {
        if (!data.TryGetProperty("screenshot", out var screenshot)
            || screenshot.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var valor = screenshot.GetString();
        if (string.IsNullOrWhiteSpace(valor)) return null;

        try
        {
            var base64 = valor;
            var coma = valor.IndexOf(',');
            if (valor.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase) && coma >= 0)
                base64 = valor[(coma + 1)..];

            if (base64.Length < 100) return null;
            var bytes = Convert.FromBase64String(base64);
            if (bytes.Length < 10_000) return null;

            var archivo = $"{nombre}.png";
            var destino = Path.Combine(_capturasDir, archivo);
            File.WriteAllBytes(destino, bytes);
            return $"{CapturasService.CarpetaPublica}/{archivo}";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo guardar la captura de Firecrawl");
            return null;
        }
    }

    private static string? ResolverFrontendRoot(IWebHostEnvironment env, CapturasSettings capturas)
    {
        if (!string.IsNullOrWhiteSpace(capturas.ScriptPath))
        {
            var scriptsDir = Path.GetDirectoryName(capturas.ScriptPath);
            if (!string.IsNullOrWhiteSpace(scriptsDir))
                return Path.GetFullPath(Path.Combine(scriptsDir, ".."));
        }

        var directo = Path.GetFullPath(
            Path.Combine(env.ContentRootPath, "..", "..", "..", "lefarma.frontend"));
        return Directory.Exists(directo) ? directo : null;
    }

    private static string Recortar(string? texto, int maximo) =>
        string.IsNullOrEmpty(texto)
            ? string.Empty
            : texto.Length <= maximo ? texto : texto[..maximo];

    private sealed class ResultadoFuente
    {
        public bool Ok { get; init; }
        public string? Error { get; init; }
        public bool Bloqueado { get; init; }
        public string? Fuente { get; init; }
        public string? RutaCaptura { get; init; }
        public List<VueloDetectado> Opciones { get; init; } = new();

        public static ResultadoFuente Fallo(string mensaje, bool bloqueado = false) => new()
        {
            Ok = false,
            Error = mensaje,
            Bloqueado = bloqueado,
        };
    }
}
