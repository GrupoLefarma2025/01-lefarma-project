using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Lefarma.API.Features.Viaticos.DTOs;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Configuracion de capturas de viaticos (T8 del plan costos-ruta-demo).
/// Vive en appsettings bajo la seccion <c>CapturasSettings</c>.
/// </summary>
public class CapturasSettings
{
    /// <summary>
    /// Lista blanca de dominios permitidos. Opcional: vacia por defecto, el
    /// servicio NO exige pertenencia, pero el esquema y los dominios
    /// prohibidos (<see cref="CapturasService.HardBannedDomains"/>) se
    /// validan igual. Con al menos un dominio poblado, el backend rechaza con
    /// 400 cualquier URL fuera de la lista antes de invocar el script.
    /// </summary>
    public List<string> WhitelistDomains { get; set; } = new();

    /// <summary>
    /// Ruta absoluta al script captura-viaticos.mjs. Si esta vacia se calcula
    /// como <c>../../../lefarma.frontend/scripts/captura-viaticos.mjs</c>
    /// relativo al ContentRoot de la API.
    /// </summary>
    public string ScriptPath { get; set; } = "";

    /// <summary>
    /// Timeout duro del proceso (nodo + cromo) en segundos. Al expirar se mata
    /// el arbol completo para que no queden Chromium/Node huerfanos. Por
    /// defecto 120s; las pruebas lo acortan.
    /// </summary>
    public int HardTimeoutSeconds { get; set; } = 120;
}

/// <summary>
/// Resultado del servicio de capturas. <see cref="Outcome"/> decide si el
/// controller responde 200 o 400. NUNCA devuelve 500 por problemas del script:
/// el resultado siempre trae un <see cref="Results"/> con <c>ok=false</c> y
/// <c>error</c> descriptivo cuando algo sale mal dentro del script.
/// </summary>
public class CapturaServiceResult
{
    public CapturaOutcome Outcome { get; init; } = CapturaOutcome.Ok;
    public string? Message { get; init; }
    public List<CapturaResultDto> Results { get; init; } = new();
}

public enum CapturaOutcome
{
    Ok,             // 200 con Results (cada item puede ser ok=false)
    TooMany,        // 400 mas de 10 URLs
    DomainBlocked,  // 400 URL fuera de la lista blanca o en HardBannedDomains
    BadRequest,     // 400 cuerpo invalido
}

/// <summary>
/// Servicio que envuelve el script de Playwright y normaliza su salida.
/// Stateless salvo por las rutas resueltas en el constructor (Singleton).
/// </summary>
public class CapturasService
{
    public const int MaxUrls = 10;

    /// <summary>
    /// Dominios PROHIBIDOS por plan. Se aplican SIEMPRE, tenga o no lista
    /// blanca poblada: si el operador los incluye explicito en
    /// <see cref="CapturasSettings.WhitelistDomains"/>, el servicio los rechaza
    /// igual. Regla de negocio: no se hace scraping a OTAs grandes
    /// (booking.com, expedia.com) por terminos de servicio y por el plan
    /// de la demo.
    /// </summary>
    public static readonly HashSet<string> HardBannedDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "booking.com",
        "expedia.com",
    };

    /// <summary>
    /// Sufijos de host que nunca son un destino legitimo de una captura y que
    /// suelen apuntar a la intranet donde vive el servidor.
    /// </summary>
    private static readonly string[] InternalHostSuffixes =
    {
        ".localhost",
        ".local",
        ".internal",
    };

    private readonly CapturasSettings _settings;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<CapturasService> _logger;
    private readonly ICapturasScriptRunner _runner;

    private readonly string _scriptPath;
    private readonly string _publicRoot;
    private readonly string _targetCapturasDir;
    private readonly string _publicRelativeTarget = "capturas-viaticos";

    public CapturasService(
        IOptions<CapturasSettings> settings,
        IWebHostEnvironment env,
        ILogger<CapturasService> logger,
        ICapturasScriptRunner runner)
    {
        _settings = settings.Value;
        _env = env;
        _logger = logger;
        _runner = runner;

        string frontendRoot;
        if (!string.IsNullOrWhiteSpace(_settings.ScriptPath))
        {
            // Si el operador fija ScriptPath, derivamos el frontend root
            // como su abuelo: <root>/scripts/captura-viaticos.mjs.
            var scriptsDir = Path.GetDirectoryName(_settings.ScriptPath)!;
            frontendRoot = Path.GetFullPath(Path.Combine(scriptsDir, ".."));
            _scriptPath = _settings.ScriptPath;
        }
        else
        {
            frontendRoot = ResolveFrontendRoot();
            _scriptPath = Path.Combine(frontendRoot, "scripts", "captura-viaticos.mjs");
        }
        // captura-viaticos.mjs devuelve `archivo` RELATIVO a public/
        // (p.ej. "capturas/viaticos/foo.png"), por eso guardamos la raiz
        // public/ y no el directorio de capturas: volver a anadir
        // "capturas/viaticos" duplicaria el segmento y el PNG no se
        // encontraria en disco.
        _publicRoot = Path.Combine(frontendRoot, "public");
        _targetCapturasDir = Path.Combine(env.WebRootPath, "media", _publicRelativeTarget);
        Directory.CreateDirectory(_targetCapturasDir);
    }

    /// <summary>Solo valida (cantidad, esquema, dominios prohibidos, destinos internos, whitelist). Sin I/O.</summary>
    public CapturaServiceResult Validate(IReadOnlyList<CapturaItem> items)
    {
        if (items.Count > MaxUrls)
        {
            return new CapturaServiceResult
            {
                Outcome = CapturaOutcome.TooMany,
                Message = $"demasiadas URLs (recibidas {items.Count}, maximo {MaxUrls})",
            };
        }

        // El esquema http/https, los dominios prohibidos y los destinos internos se
        // validan SIEMPRE, incluso con lista blanca vacia (configuracion por
        // defecto): de lo contrario file:, data: o http://169.254.169.254/
        // llegarian al script y el servidor devolveria su contenido como PNG.
        // La lista blanca sigue siendo opcional: solo se exige pertenencia si
        // el operador la poblo.
        var exigirWhitelist = _settings.WhitelistDomains.Count > 0;

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.Url))
            {
                return new CapturaServiceResult
                {
                    Outcome = CapturaOutcome.DomainBlocked,
                    Message = "URL vacia o invalida",
                };
            }
            if (!Uri.TryCreate(item.Url, UriKind.Absolute, out var uri))
            {
                return new CapturaServiceResult
                {
                    Outcome = CapturaOutcome.DomainBlocked,
                    Message = $"URL invalida: {item.Url}",
                };
            }
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            {
                return new CapturaServiceResult
                {
                    Outcome = CapturaOutcome.DomainBlocked,
                    Message = $"esquema no permitido (solo http/https): {uri.Scheme}",
                };
            }
            var host = NormalizeHost(uri.Host);
            if (HardBannedDomains.Contains(host))
            {
                return new CapturaServiceResult
                {
                    Outcome = CapturaOutcome.DomainBlocked,
                    Message = $"dominio prohibido por plan (scraping no permitido): {host}",
                };
            }
            if (IsInternalDestination(host))
            {
                return new CapturaServiceResult
                {
                    Outcome = CapturaOutcome.DomainBlocked,
                    Message = $"destino interno o privado no permitido: {host}",
                };
            }
            if (exigirWhitelist && !IsInWhitelist(host))
            {
                return new CapturaServiceResult
                {
                    Outcome = CapturaOutcome.DomainBlocked,
                    Message = $"dominio no esta en la lista blanca: {host}",
                };
            }
        }

        return new CapturaServiceResult { Outcome = CapturaOutcome.Ok };
    }

    public async Task<CapturaServiceResult> CapturarAsync(IReadOnlyList<CapturaItem> items, CancellationToken ct)
    {
        var validation = Validate(items);
        if (validation.Outcome != CapturaOutcome.Ok) return validation;

        // Caso degenerado: lista vacia -> respuesta vacia sin tocar el script.
        if (items.Count == 0)
        {
            return new CapturaServiceResult { Outcome = CapturaOutcome.Ok, Results = new() };
        }

        if (!File.Exists(_scriptPath))
        {
            _logger.LogWarning("captura-viaticos.mjs no encontrado en {Path}", _scriptPath);
            return new CapturaServiceResult
            {
                Outcome = CapturaOutcome.Ok,
                Results = items.Select(i => new CapturaResultDto
                {
                    Url = i.Url,
                    Ok = false,
                    Archivo = null,
                    Error = $"script no encontrado: {_scriptPath}",
                }).ToList(),
            };
        }

        var inputJson = JsonSerializer.Serialize(
            items.Select(i => new { url = i.Url, nombre = i.Nombre ?? "" }).ToList());

        var run = await _runner.RunAsync(_scriptPath, inputJson, _settings.HardTimeoutSeconds, ct);

        // 1) Salida vacia o sin parsear -> ok:false por item, sin throw.
        if (string.IsNullOrWhiteSpace(run.Stdout))
        {
            return new CapturaServiceResult
            {
                Outcome = CapturaOutcome.Ok,
                Results = items.Select(i => new CapturaResultDto
                {
                    Url = i.Url,
                    Ok = false,
                    Archivo = null,
                    Error = run.KilledByTimeout
                        ? $"timeout del proceso ({_settings.HardTimeoutSeconds}s); posibles capturas colgadas liberadas"
                        : $"script sin salida: {Truncate(run.Stderr, 200)}",
                }).ToList(),
            };
        }

        List<CapturaResultDto>? parsed = null;
        try
        {
            var jsonSlice = ExtractFirstJsonArray(run.Stdout);
            using var doc = JsonDocument.Parse(jsonSlice);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                throw new InvalidOperationException("la salida no es un array JSON");
            parsed = new List<CapturaResultDto>(doc.RootElement.GetArrayLength());
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                parsed.Add(new CapturaResultDto
                {
                    Url = el.TryGetProperty("url", out var u) && u.ValueKind == JsonValueKind.String
                        ? u.GetString() : null,
                    Ok = el.TryGetProperty("ok", out var o) && o.ValueKind == JsonValueKind.True,
                    Archivo = el.TryGetProperty("archivo", out var a) && a.ValueKind == JsonValueKind.String
                        ? a.GetString() : null,
                    Error = el.TryGetProperty("error", out var er) && er.ValueKind == JsonValueKind.String
                        ? er.GetString() : null,
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo parsear la salida del script de capturas");
            return new CapturaServiceResult
            {
                Outcome = CapturaOutcome.Ok,
                Results = items.Select(i => new CapturaResultDto
                {
                    Url = i.Url,
                    Ok = false,
                    Archivo = null,
                    Error = $"salida del script no parseable: {Truncate(run.Stdout, 200)}",
                }).ToList(),
            };
        }

        // 2) Cada PNG exitoso se copia a wwwroot/media/capturas-viaticos y la
        //    ruta del DTO se reescribe para que el frontend lo sirva desde
        //    /api/media/capturas-viaticos/<nombre>.png.
        foreach (var r in parsed)
        {
            if (!r.Ok || string.IsNullOrWhiteSpace(r.Archivo)) continue;

            // _publicRoot ya se calculo en el ctor (a partir del ScriptPath
            // o del ContentRootPath), no recomputamos a mano para que las pruebas
            // con tempdir funcionen igual que produccion.
            var src = Path.GetFullPath(Path.Combine(_publicRoot,
                r.Archivo.Replace('/', Path.DirectorySeparatorChar)));
            if (!src.StartsWith(_publicRoot + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            {
                _logger.LogWarning("archivo fuera de public/ rechazado: {Archivo}", r.Archivo);
                r.Ok = false;
                r.Error = (r.Error ?? "") + $"; archivo fuera de public/: {r.Archivo}";
                r.Archivo = null;
                continue;
            }
            if (!File.Exists(src))
            {
                _logger.LogWarning("PNG reportado por el script pero no existe en disco: {Src}", src);
                r.Ok = false;
                r.Error = (r.Error ?? "") + "; png no encontrado tras captura";
                r.Archivo = null;
                continue;
            }
            var name = Path.GetFileName(src);
            var dst = Path.Combine(_targetCapturasDir, name);
            try
            {
                File.Copy(src, dst, overwrite: true);
                r.Archivo = $"{_publicRelativeTarget}/{name}";
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "no se pudo copiar {Src} -> {Dst}", src, dst);
                r.Ok = false;
                r.Error = (r.Error ?? "") + $"; no se pudo publicar: {ex.Message}";
                r.Archivo = null;
            }
        }

        return new CapturaServiceResult { Outcome = CapturaOutcome.Ok, Results = parsed };
    }

    private string ResolveFrontendRoot()
    {
        // API root tipico: .../lefarma.backend/src/Lefarma.API
        // Frontend:         .../lefarma.frontend
        var apiRoot = _env.ContentRootPath;
        var direct = Path.GetFullPath(Path.Combine(apiRoot, "..", "..", "..", "lefarma.frontend"));
        if (Directory.Exists(direct)) return direct;
        throw new DirectoryNotFoundException(
            $"No se encontró lefarma.frontend junto a {apiRoot}");
    }

    private static string NormalizeHost(string host)
    {
        var h = host.ToLowerInvariant();
        if (h.StartsWith("www.", StringComparison.Ordinal)) h = h[4..];
        return h;
    }

    /// <summary>
    /// Bloquea destinos de intranet: loopback, link-local (incluye el host de
    /// metadata 169.254.169.254), rangos privados RFC1918, CGNAT, IPv6 loopback,
    /// ULA y link-local, y los sufijos <c>localhost</c>/<c>.local</c>/
    /// <c>.internal</c>. Un host que no parsea como IP no se resuelve por DNS
    /// (el backend no introduce resolucion): solo se rechazan los sufijos
    /// conocidos. Misma regla que el script captura-viaticos.mjs.
    /// </summary>
    private static bool IsInternalDestination(string host)
    {
        // Uri.Host devuelve los IPv6 entre corchetes: [::1] -> ::1.
        host = host.Trim('[', ']');
        if (host.Length == 0) return true;
        if (host == "localhost") return true;
        foreach (var suffix in InternalHostSuffixes)
        {
            if (host.EndsWith(suffix, StringComparison.Ordinal)) return true;
        }

        if (!IPAddress.TryParse(host, out var ip))
            return false; // nombre de dominio sin resolver: no se hace DNS

        if (IPAddress.IsLoopback(ip)) return true;
        if (ip.IsIPv4MappedToIPv6) return IsInternalDestination(ip.MapToIPv4().ToString());

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            if (b[0] == 0) return true;                          // 0.0.0.0/8
            if (b[0] == 10) return true;                         // 10.0.0.0/8
            if (b[0] == 127) return true;                        // 127.0.0.0/8
            if (b[0] == 169 && b[1] == 254) return true;         // 169.254.0.0/16 link-local
            if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true;   // 172.16.0.0/12
            if (b[0] == 192 && b[1] == 168) return true;         // 192.168.0.0/16
            if (b[0] == 100 && b[1] >= 64 && b[1] <= 127) return true;  // 100.64.0.0/10 CGNAT
            return false;
        }

        return ip.IsIPv6LinkLocal          // fe80::/10
            || ip.IsIPv6UniqueLocal    // fc00::/7
            || ip.IsIPv6SiteLocal;     // fec0::/10
    }

    private bool IsInWhitelist(string host)
    {
        foreach (var d in _settings.WhitelistDomains)
        {
            if (string.IsNullOrWhiteSpace(d)) continue;
            var dom = d.Trim().ToLowerInvariant();
            if (host == dom || host.EndsWith("." + dom, StringComparison.Ordinal)) return true;
        }
        return false;
    }

    private static string ExtractFirstJsonArray(string output)
    {
        var start = output.IndexOf('[');
        var end = output.LastIndexOf(']');
        if (start < 0 || end < 0 || end < start)
            throw new InvalidOperationException("no se encontró un array JSON en stdout");
        return output.Substring(start, end - start + 1);
    }

    private static string Truncate(string? s, int max)
        => string.IsNullOrEmpty(s) ? "" : (s.Length <= max ? s : s.Substring(0, max));
}

// -----------------------------------------------------------------------------
//  Script runner: abstrae Process para que las pruebas inyecten un fake.
// -----------------------------------------------------------------------------

public record CapturaScriptRun(string Stdout, string Stderr, bool KilledByTimeout);

public interface ICapturasScriptRunner
{
    Task<CapturaScriptRun> RunAsync(string scriptPath, string inputJson, int hardTimeoutSeconds, CancellationToken ct);
}

/// <summary>
/// Implementación real: invoca <c>node</c> sobre el script y mata el árbol
/// de procesos (node + chromium) al expirar el timeout duro. Esto es
/// crítico: si no, una captura colgada deja chrome.exe huerfano y zombis
/// en el servidor.
/// </summary>
public sealed class NodeCapturasScriptRunner : ICapturasScriptRunner
{
    private readonly ILogger<NodeCapturasScriptRunner> _logger;

    public NodeCapturasScriptRunner(ILogger<NodeCapturasScriptRunner> logger)
    {
        _logger = logger;
    }

    public async Task<CapturaScriptRun> RunAsync(
        string scriptPath, string inputJson, int hardTimeoutSeconds, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "node",
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            WorkingDirectory = Path.GetDirectoryName(scriptPath),
        };
        psi.ArgumentList.Add(scriptPath);
        psi.ArgumentList.Add(inputJson);

        using var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        proc.OutputDataReceived += (_, e) => { if (e.Data != null) stdout.AppendLine(e.Data); };
        proc.ErrorDataReceived += (_, e) => { if (e.Data != null) stderr.AppendLine(e.Data); };

        if (!proc.Start())
        {
            return new CapturaScriptRun("", "no se pudo iniciar proceso node", false);
        }
        proc.BeginOutputReadLine();
        proc.BeginErrorReadLine();

        var killedByTimeout = false;
        using var killTimer = new Timer(_ =>
        {
            killedByTimeout = true;
            try
            {
                if (!proc.HasExited) proc.Kill(entireProcessTree: true);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "kill timer: no se pudo matar el proceso");
            }
        }, null, TimeSpan.FromSeconds(hardTimeoutSeconds), Timeout.InfiniteTimeSpan);

        try
        {
            await proc.WaitForExitAsync(ct);
        }
        catch (OperationCanceledException)
        {
            try { if (!proc.HasExited) proc.Kill(entireProcessTree: true); } catch { }
            return new CapturaScriptRun(stdout.ToString(), stderr.ToString() + " | cancelado", true);
        }

        return new CapturaScriptRun(stdout.ToString(), stderr.ToString(), killedByTimeout);
    }
}
