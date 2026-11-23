using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Lefarma.API.Features.Viaticos.DTOs;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Viaticos;

public interface IDeteccionPrecioOtrosService
{
    Task<DeteccionPrecioResult> DetectarAsync(
        string tipo,
        string url,
        string objetivo,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi,
        string nombre,
        bool capturar,
        CancellationToken ct);
}

public sealed class DeteccionPrecioOtrosService : IDeteccionPrecioOtrosService
{
    private readonly DeteccionPrecioSettings _settings;
    private readonly CapturasSettings _capturas;
    private readonly ICapturasScriptRunner _runner;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<DeteccionPrecioOtrosService> _logger;
    private readonly CapturasService _capturasService;
    private readonly string _scriptPath;
    private readonly string _frontendRoot;
    private readonly string _capturasDir;

    public DeteccionPrecioOtrosService(
        IOptions<DeteccionPrecioSettings> settings,
        IOptions<CapturasSettings> capturas,
        IWebHostEnvironment env,
        ICapturasScriptRunner runner,
        IHttpClientFactory http,
        ILogger<DeteccionPrecioOtrosService> logger,
        CapturasService capturasService)
    {
        _settings = settings.Value;
        _capturas = capturas.Value;
        _runner = runner;
        _http = http;
        _logger = logger;
        _capturasService = capturasService;

        _frontendRoot = ResolverFrontendRoot(env, _capturas) ?? string.Empty;
        _scriptPath = string.IsNullOrWhiteSpace(_frontendRoot)
            ? string.Empty
            : Path.Combine(_frontendRoot, "scripts", "detectar-pagina.mjs");
        _capturasDir = CapturasService.ResolverDirectorioCapturas(env, _capturas);
        Directory.CreateDirectory(_capturasDir);
    }

    public async Task<DeteccionPrecioResult> DetectarAsync(
        string tipo,
        string url,
        string objetivo,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi,
        string nombre,
        bool capturar,
        CancellationToken ct)
    {
        var noches = NochesDeUrl(url);
        var playwright = await IntentarPlaywrightAsync(tipo, url, objetivo, fecha, deadline, minutosTaxi, noches, nombre, capturar, ct);
        if (playwright.Ok && playwright.Opciones.Count > 0)
        {
            var resultadoPlaywright = Elegir(playwright, tipo);
            return capturar
                ? await ConCapturaDeOpcionAsync(resultadoPlaywright, tipo, url, objetivo, nombre, ct)
                : resultadoPlaywright;
        }

        _logger.LogInformation(
            "Deteccion {Tipo} Playwright sin resultado para {Url}: {Error}. Se intenta Firecrawl.",
            tipo, url, playwright.Error);

        var firecrawl = await IntentarFirecrawlAsync(tipo, url, objetivo, fecha, deadline, minutosTaxi, noches, nombre, capturar, ct);
        if (firecrawl.Ok && firecrawl.Opciones.Count > 0)
        {
            var combinadas = playwright.Opciones
                .Concat(firecrawl.Opciones)
                .GroupBy(o => (o.Linea, o.Precio))
                .Select(g => g.First())
                .ToList();
            var resultadoCombinado = Elegir(new ResultadoFuente
            {
                Ok = true,
                Fuente = "firecrawl",
                RutaCaptura = firecrawl.RutaCaptura,
                Opciones = combinadas,
            }, tipo);
            return capturar
                ? await ConCapturaDeOpcionAsync(resultadoCombinado, tipo, url, objetivo, nombre, ct)
                : resultadoCombinado;
        }

        return new DeteccionPrecioResult
        {
            Ok = false,
            Bloqueado = playwright.Bloqueado || firecrawl.Bloqueado,
            Error = $"Playwright: {playwright.Error}. Firecrawl: {firecrawl.Error}.",
            Opciones = firecrawl.Opciones,
        };
    }

    private async Task<DeteccionPrecioResult> ConCapturaDeOpcionAsync(
        DeteccionPrecioResult resultado,
        string tipo,
        string url,
        string objetivo,
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
                    Url = tipo == "hotel" ? UrlsHoteles.ParaListado(url) : url,
                    Nombre = nombre,
                    Tipo = tipo,
                    Linea = resultado.Elegido.Linea,
                    Precio = resultado.Elegido.Precio,
                    Salida = resultado.Elegido.Salida?.ToString("HH:mm"),
                    Llegada = resultado.Elegido.Llegada?.ToString("HH:mm"),
                    Objetivo = objetivo,
                },
                captureCts.Token);

            if (captura is not { Ok: true, Archivo: not null }
                || !string.Equals(captura.Alcance, "opcion", StringComparison.OrdinalIgnoreCase))
            {
                return resultado;
            }

            return new DeteccionPrecioResult
            {
                Ok = true,
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
            _logger.LogWarning("La captura recortada de {Tipo} {Url} excedió 35s; se conserva la de resultados.", tipo, url);
            return resultado;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo recortar la captura de {Tipo} {Url}", tipo, url);
            return resultado;
        }
    }

    private static DeteccionPrecioResult Elegir(ResultadoFuente fuente, string tipo)
    {
        var elegido = fuente.Opciones
            .OrderBy(o => o.Precio)
            .ThenBy(o => o.DuracionMin ?? int.MaxValue)
            .FirstOrDefault();

        if (elegido is null)
        {
            return new DeteccionPrecioResult
            {
                Ok = false,
                Error = tipo == "hotel"
                    ? "No se encontró el hotel cotizado en la página."
                    : "No se encontró un autobús que llegue a tiempo.",
                Fuente = fuente.Fuente,
                RutaCaptura = fuente.RutaCaptura,
                Opciones = fuente.Opciones,
            };
        }

        return new DeteccionPrecioResult
        {
            Ok = true,
            Fuente = fuente.Fuente,
            RutaCaptura = fuente.RutaCaptura,
            Elegido = elegido,
            Opciones = fuente.Opciones,
        };
    }

    private async Task<ResultadoFuente> IntentarPlaywrightAsync(
        string tipo,
        string url,
        string objetivo,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi,
        int noches,
        string nombre,
        bool capturar,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_scriptPath) || !File.Exists(_scriptPath))
            return ResultadoFuente.Fallo("no está disponible detectar-pagina.mjs");

        var query = ExtraerFechasDeUrl(url);
        var urlPlaywright = tipo == "hotel" ? UrlsHoteles.ParaListado(url) : url;
        var input = JsonSerializer.Serialize(new
        {
            url = urlPlaywright,
            nombre,
            tipo,
            checkin = query.Checkin,
            checkout = query.Checkout,
            capturar,
        });
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
                var bloqueado = raiz.TryGetProperty("bloqueado", out var b) && b.ValueKind == JsonValueKind.True;
                return ResultadoFuente.Fallo(error ?? "Playwright no generó resultados.", bloqueado);
            }

            if (!raiz.TryGetProperty("tarjetas", out var tarjetas) || tarjetas.ValueKind != JsonValueKind.Array)
                return ResultadoFuente.Fallo("Playwright no devolvió tarjetas.");

            var lista = tarjetas.EnumerateArray()
                .Where(t => t.ValueKind == JsonValueKind.String)
                .Select(t => t.GetString() ?? string.Empty)
                .ToList();
            if (lista.Count == 0) return ResultadoFuente.Fallo("Playwright devolvió tarjetas vacías.");

            var opciones = Parsear(tipo, lista, objetivo, fecha, deadline, minutosTaxi, noches);
            if (opciones.Count == 0)
                return ResultadoFuente.Fallo("no se reconoció el precio en las tarjetas.");

            var archivo = raiz.TryGetProperty("archivo", out var a) && a.ValueKind == JsonValueKind.String
                ? a.GetString()
                : null;
            var ruta = capturar ? CopiarCaptura(archivo) : null;
            if (capturar && ruta is null)
                return ResultadoFuente.Fallo("Playwright no dejó una captura utilizable.");

            return new ResultadoFuente
            {
                Ok = true,
                Fuente = "playwright",
                RutaCaptura = ruta,
                Opciones = opciones,
            };
        }
        catch (JsonException)
        {
            return ResultadoFuente.Fallo($"salida de Playwright no parseable: {Recortar(run.Stdout, 200)}");
        }
    }

    private async Task<ResultadoFuente> IntentarFirecrawlAsync(
        string tipo,
        string url,
        string objetivo,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi,
        int noches,
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
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.FirecrawlApiKey.Trim());
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

            var ruta = capturar ? GuardarCaptura(data, nombre) : null;
            if (capturar && ruta is null)
                return ResultadoFuente.Fallo("Firecrawl no devolvió una captura utilizable.");

            var opciones = tipo == "hotel"
                ? HotelesParser.ParsearMarkdown(markdown, objetivo, noches)
                : AutobusesParser.ParsearMarkdown(markdown, objetivo, fecha, deadline, minutosTaxi);
            if (opciones.Count == 0) return ResultadoFuente.Fallo("no se reconoció el precio en el markdown.");

            return new ResultadoFuente
            {
                Ok = true,
                Fuente = "firecrawl",
                RutaCaptura = ruta,
                Opciones = opciones,
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

    private static List<PrecioDetectado> Parsear(
        string tipo,
        IEnumerable<string> tarjetas,
        string objetivo,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi,
        int noches) =>
        tipo == "hotel"
            ? HotelesParser.Parsear(tarjetas, objetivo, noches)
            : AutobusesParser.Parsear(tarjetas, objetivo, fecha, deadline, minutosTaxi);

    private string? CopiarCaptura(string? archivo)
    {
        if (string.IsNullOrWhiteSpace(archivo) || string.IsNullOrWhiteSpace(_frontendRoot)) return null;
        try
        {
            var origen = Path.Combine(_frontendRoot, "public", archivo.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(origen)) return null;
            var destino = Path.Combine(_capturasDir, Path.GetFileName(archivo));
            File.Copy(origen, destino, overwrite: true);
            return $"{CapturasService.CarpetaPublica}/{Path.GetFileName(archivo)}";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo copiar la captura {Archivo}", archivo);
            return null;
        }
    }

    private string? GuardarCaptura(JsonElement data, string nombre)
    {
        if (!data.TryGetProperty("screenshot", out var screenshot) || screenshot.ValueKind != JsonValueKind.String)
            return null;
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
            File.WriteAllBytes(Path.Combine(_capturasDir, archivo), bytes);
            return $"{CapturasService.CarpetaPublica}/{archivo}";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo guardar la captura de Firecrawl");
            return null;
        }
    }

    private static (string? Checkin, string? Checkout) ExtraerFechasDeUrl(string url)
    {
        try
        {
            var uri = new Uri(url);
            var checkin = Regex.Match(uri.Query, @"[?&]checkin=([^&]+)", RegexOptions.IgnoreCase);
            var checkout = Regex.Match(uri.Query, @"[?&]checkout=([^&]+)", RegexOptions.IgnoreCase);
            return (
                checkin.Success ? Uri.UnescapeDataString(checkin.Groups[1].Value) : null,
                checkout.Success ? Uri.UnescapeDataString(checkout.Groups[1].Value) : null);
        }
        catch
        {
            return (null, null);
        }
    }

    private static int NochesDeUrl(string url)
    {
        var (checkin, checkout) = ExtraerFechasDeUrl(url);
        if (DateOnly.TryParseExact(checkin, "yyyy-MM-dd", out var ci)
            && DateOnly.TryParseExact(checkout, "yyyy-MM-dd", out var co))
        {
            var noches = co.DayNumber - ci.DayNumber;
            if (noches >= 1) return noches;
        }
        return 1;
    }

    private static string? ResolverFrontendRoot(IWebHostEnvironment env, CapturasSettings capturas)
    {
        if (!string.IsNullOrWhiteSpace(capturas.ScriptPath))
        {
            var scriptsDir = Path.GetDirectoryName(capturas.ScriptPath);
            if (!string.IsNullOrWhiteSpace(scriptsDir))
                return Path.GetFullPath(Path.Combine(scriptsDir, ".."));
        }
        var directo = Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "..", "lefarma.frontend"));
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
        public List<PrecioDetectado> Opciones { get; init; } = new();

        public static ResultadoFuente Fallo(string mensaje, bool bloqueado = false) => new()
        {
            Ok = false,
            Error = mensaje,
            Bloqueado = bloqueado,
        };
    }
}
