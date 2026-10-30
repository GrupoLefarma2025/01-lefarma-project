using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
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

    /// <summary>
    /// Carpeta fisica donde se publican los PNG (capturas del script y capturas
    /// adjuntadas desde fuera). Vacia = <c>wwwroot/media/capturas-viaticos</c>.
    /// Si es relativa se resuelve contra el ContentRoot de la API; si es
    /// absoluta se usa tal cual (por ejemplo una unidad de red).
    /// </summary>
    public string OutputPath { get; set; } = "";

    /// <summary>
    /// Motor de captura: <c>script</c> (Playwright directo con
    /// captura-viaticos.mjs, comportamiento historico) o <c>agente</c> (el
    /// servicio externo <c>viaticos-capturas</c> corre OpenCode + Playwright MCP
    /// dentro de su contenedor y devuelve el PNG; sirve para sitios con busqueda
    /// dinamica donde el deep link no alcanza).
    /// </summary>
    public string Modo { get; set; } = "script";

    /// <summary>
    /// URL base del servicio <c>viaticos-capturas</c> cuando <see cref="Modo"/>
    /// es <c>agente</c> (por ejemplo <c>https://capturas.app.grupolefarma.com.mx</c>).
    /// </summary>
    public string ServicioAgenteUrl { get; set; } = "";

    /// <summary>API key (<c>x-api-key</c>) del servicio externo en modo agente.</summary>
    public string ServicioAgenteApiKey { get; set; } = "";

    /// <summary>Timeout del servicio externo en modo agente (segundos).</summary>
    public int AgenteTimeoutSeconds { get; set; } = 300;
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
    private readonly IHttpClientFactory? _httpClientFactory;

    private readonly string _scriptPath;
    private readonly string _publicRoot;
    private readonly string _targetCapturasDir;
    /// <summary>Carpeta publica (relativa a la raiz de capturas) que viaja en los DTO.</summary>
    public const string CarpetaPublica = "capturas-viaticos";

    public CapturasService(
        IOptions<CapturasSettings> settings,
        IWebHostEnvironment env,
        ILogger<CapturasService> logger,
        ICapturasScriptRunner runner,
        IHttpClientFactory? httpClientFactory = null)
    {
        _settings = settings.Value;
        _env = env;
        _logger = logger;
        _runner = runner;
        _httpClientFactory = httpClientFactory;

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
        _targetCapturasDir = ResolverDirectorioCapturas(env, _settings);
        Directory.CreateDirectory(_targetCapturasDir);
    }

    /// <summary>
    /// Carpeta fisica de los PNG. Manda <see cref="CapturasSettings.OutputPath"/>
    /// cuando esta poblado; si no, el default historico
    /// <c>wwwroot/media/capturas-viaticos</c>. La ruta publica que viaja en los
    /// DTO sigue siendo <see cref="CarpetaPublica"/>, sin importar la carpeta
    /// fisica, para que el GET autenticado siga resolviendo igual.
    /// </summary>
    public static string ResolverDirectorioCapturas(IWebHostEnvironment env, CapturasSettings settings)
    {
        var configurada = settings.OutputPath?.Trim();
        if (!string.IsNullOrEmpty(configurada))
        {
            var ruta = Path.IsPathRooted(configurada)
                ? configurada
                : Path.Combine(env.ContentRootPath, configurada);
            return Path.GetFullPath(ruta);
        }

        return Path.GetFullPath(Path.Combine(env.WebRootPath, "media", CarpetaPublica));
    }

    /// <summary>Carpeta fisica donde viven los PNG (para el controller).</summary>
    public string DirectorioCapturas => _targetCapturasDir;

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

        // Modo agente: el servicio externo (viaticos-capturas) corre OpenCode +
        // Playwright MCP dentro de su contenedor y devuelve el PNG ya renderizado.
        // Si una URL falla con el agente, se reintenta con el script local.
        if (string.Equals(_settings.Modo, "agente", StringComparison.OrdinalIgnoreCase))
        {
            return await CapturarConAgenteConFallbackAsync(items, ct);
        }

        return await CapturarConScriptAsync(items, ct);
    }

    /// <summary>
    /// Captura con el script local de Playwright (captura-viaticos.mjs). Se usa
    /// en <c>Modo=script</c> y como fallback cuando el agente no logra una URL.
    /// </summary>
    private async Task<CapturaServiceResult> CapturarConScriptAsync(
        IReadOnlyList<CapturaItem> items, CancellationToken ct)
    {
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
                r.Archivo = $"{CarpetaPublica}/{name}";
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

    /// <summary>
    /// Modo agente con fallback: primero intenta el agente y, si alguna URL
    /// quedo sin captura, la reintenta con el script local de Playwright.
    /// </summary>
    private async Task<CapturaServiceResult> CapturarConAgenteConFallbackAsync(
        IReadOnlyList<CapturaItem> items, CancellationToken ct)
    {
        var agente = await CapturarConAgenteAsync(items, ct);

        var pendientes = items
            .Where(item =>
            {
                var resultado = agente.Results.FirstOrDefault(r =>
                    string.Equals(r.Url, item.Url, StringComparison.OrdinalIgnoreCase));
                return resultado is null || !resultado.Ok;
            })
            .ToList();

        if (pendientes.Count == 0 || !File.Exists(_scriptPath))
        {
            return agente;
        }

        _logger.LogInformation(
            "Fallback script para {Cantidad} captura(s) que el agente no pudo tomar",
            pendientes.Count);

        var script = await CapturarConScriptAsync(pendientes, ct);
        var porUrl = script.Results
            .Where(r => !string.IsNullOrWhiteSpace(r.Url))
            .GroupBy(r => r.Url!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var resultado in agente.Results)
        {
            if (resultado.Ok || string.IsNullOrWhiteSpace(resultado.Url)) continue;
            if (!porUrl.TryGetValue(resultado.Url, out var respaldo) ||
                !respaldo.Ok ||
                string.IsNullOrWhiteSpace(respaldo.Archivo))
            {
                continue;
            }

            resultado.Ok = true;
            resultado.Archivo = respaldo.Archivo;
            resultado.Error = null;
        }

        return agente;
    }

    /// <summary>
    /// Busca la informacion del viaje (transportista, horarios, precio) y toma
    /// la captura en una sola corrida del agente. Si el agente no esta
    /// disponible o falla, se conserva la captura por script y los datos van en
    /// <c>null</c>: el endpoint siempre responde, nunca 500 por el agente.
    /// </summary>
    public Task<BusquedaCapturaResult> BuscarAsync(CapturaItem item, CancellationToken ct)
        => BuscarAsync(item, null, ct);

    /// <summary>
    /// Igual que <see cref="BuscarAsync(CapturaItem, CancellationToken)"/> pero
    /// con el contexto de la ruta (origen, destino y fecha) para que el agente
    /// llene el buscador del sitio y capture los RESULTADOS, no la portada.
    /// </summary>
    public async Task<BusquedaCapturaResult> BuscarAsync(
        CapturaItem item, string? contexto, CancellationToken ct)
    {
        var validacion = Validate(new[] { item });
        if (validacion.Outcome != CapturaOutcome.Ok)
        {
            return new BusquedaCapturaResult
            {
                Captura = new CapturaResultDto
                {
                    Url = item.Url,
                    Ok = false,
                    Error = validacion.Message,
                },
            };
        }

        var modoAgente = string.Equals(_settings.Modo, "agente", StringComparison.OrdinalIgnoreCase);
        string? advertencia = null;
        if (modoAgente &&
            _httpClientFactory is not null &&
            !string.IsNullOrWhiteSpace(_settings.ServicioAgenteUrl))
        {
            try
            {
                return await BuscarConAgenteAsync(item, contexto, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "busqueda agentica fallo para {Url}; se conserva solo la captura", item.Url);
                advertencia =
                    "El agente no pudo completar la busqueda; la captura puede ser de la portada. " +
                    TextoCorto(ex.Message);
            }
        }

        var captura = await CapturarAsync(new[] { item }, ct);
        var resultado = captura.Results.FirstOrDefault() ?? new CapturaResultDto
        {
            Url = item.Url,
            Ok = false,
            Error = captura.Message,
        };

        return new BusquedaCapturaResult
        {
            Captura = resultado,
            Datos = null,
            Advertencia = advertencia,
        };
    }

    private static string TextoCorto(string texto, int maximo = 300)
        => texto.Length <= maximo ? texto : texto[..maximo];

    /// <summary>
    /// Llama a POST /v1/agentico/buscar del servicio externo, descarga el PNG y
    /// devuelve tambien los datos estructurados del viaje y el modelo usado.
    /// </summary>
    private async Task<BusquedaCapturaResult> BuscarConAgenteAsync(
        CapturaItem item, string? contexto, CancellationToken ct)
    {
        var baseUrl = _settings.ServicioAgenteUrl.TrimEnd('/');
        var cliente = _httpClientFactory!.CreateClient("capturas-agente");
        cliente.Timeout = TimeSpan.FromSeconds(Math.Max(60, _settings.AgenteTimeoutSeconds));

        using var peticion = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/agentico/buscar");
        if (!string.IsNullOrWhiteSpace(_settings.ServicioAgenteApiKey))
        {
            peticion.Headers.TryAddWithoutValidation("x-api-key", _settings.ServicioAgenteApiKey.Trim());
        }
        var contextoNormalizado = string.IsNullOrWhiteSpace(contexto)
            ? null
            : contexto.Trim()[..Math.Min(contexto.Trim().Length, 2000)];
        peticion.Content = JsonContent.Create(new
        {
            url = item.Url,
            nombre = string.IsNullOrWhiteSpace(item.Nombre) ? "informacion" : item.Nombre,
            contexto = contextoNormalizado,
        });

        using var respuesta = await cliente.SendAsync(peticion, ct);
        var cuerpo = await respuesta.Content.ReadAsStringAsync(ct);
        if (!respuesta.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"servicio agente {respuesta.StatusCode}: {Truncate(cuerpo, 200)}");
        }

        string? archivoAgente = null;
        JsonElement? datos = null;
        string? modelo = null;
        using (var doc = JsonDocument.Parse(cuerpo))
        {
            var raiz = doc.RootElement;
            if (raiz.TryGetProperty("archivo", out var archivoEl) &&
                archivoEl.ValueKind == JsonValueKind.String)
            {
                archivoAgente = archivoEl.GetString();
            }
            if (raiz.TryGetProperty("datos", out var datosEl) &&
                datosEl.ValueKind == JsonValueKind.Object)
            {
                datos = datosEl.Clone();
            }
            if (raiz.TryGetProperty("modelo", out var modeloEl) &&
                modeloEl.ValueKind == JsonValueKind.String)
            {
                modelo = modeloEl.GetString();
            }
        }

        if (string.IsNullOrWhiteSpace(archivoAgente))
        {
            throw new InvalidOperationException($"servicio agente sin archivo: {Truncate(cuerpo, 200)}");
        }

        using var descarga = await cliente.GetAsync(
            $"{baseUrl}/c/{Uri.EscapeDataString(archivoAgente)}", ct);
        if (!descarga.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"no se pudo descargar la captura {archivoAgente}: {descarga.StatusCode}");
        }

        var bytes = await descarga.Content.ReadAsByteArrayAsync(ct);
        if (bytes.Length < 10_000)
        {
            throw new InvalidOperationException($"captura sospechosamente pequena ({bytes.Length} bytes)");
        }

        var nombre = Path.GetFileName(archivoAgente);
        if (string.IsNullOrWhiteSpace(nombre)) nombre = $"agentico-{Guid.NewGuid():N}.png";
        if (!nombre.EndsWith(".png", StringComparison.OrdinalIgnoreCase)) nombre += ".png";
        var destino = Path.Combine(_targetCapturasDir, nombre);
        await File.WriteAllBytesAsync(destino, bytes, ct);

        return new BusquedaCapturaResult
        {
            Captura = new CapturaResultDto
            {
                Url = item.Url,
                Ok = true,
                Archivo = $"{CarpetaPublica}/{nombre}",
            },
            Datos = datos,
            Modelo = modelo,
            BuscadoEn = DateTime.UtcNow,
        };
    }

    /// <summary>
    /// Modo agente: pide la captura al servicio externo <c>viaticos-capturas</c>
    /// (POST /v1/agentico/capturar), descarga el PNG desde GET /c/{archivo} y lo
    /// publica en la carpeta de capturas con el mismo shape de salida que el
    /// modo script. Los errores por URL se devuelven como ok=false, nunca 500.
    /// </summary>
    private async Task<CapturaServiceResult> CapturarConAgenteAsync(
        IReadOnlyList<CapturaItem> items, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.ServicioAgenteUrl))
        {
            return FallarTodos(items, "modo agente sin CapturasSettings:ServicioAgenteUrl configurado");
        }
        if (_httpClientFactory is null)
        {
            return FallarTodos(items, "modo agente sin IHttpClientFactory disponible en el contenedor de servicios");
        }

        var baseUrl = _settings.ServicioAgenteUrl.TrimEnd('/');
        var cliente = _httpClientFactory.CreateClient("capturas-agente");
        cliente.Timeout = TimeSpan.FromSeconds(Math.Max(30, _settings.AgenteTimeoutSeconds));
        var resultados = new List<CapturaResultDto>(items.Count);

        foreach (var item in items)
        {
            try
            {
                using var peticion = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/agentico/capturar");
                if (!string.IsNullOrWhiteSpace(_settings.ServicioAgenteApiKey))
                {
                    peticion.Headers.TryAddWithoutValidation("x-api-key", _settings.ServicioAgenteApiKey.Trim());
                }
                peticion.Content = JsonContent.Create(new
                {
                    url = item.Url,
                    nombre = string.IsNullOrWhiteSpace(item.Nombre) ? "agentico" : item.Nombre,
                });

                using var respuesta = await cliente.SendAsync(peticion, ct);
                var cuerpo = await respuesta.Content.ReadAsStringAsync(ct);
                if (!respuesta.IsSuccessStatusCode)
                {
                    resultados.Add(new CapturaResultDto
                    {
                        Url = item.Url,
                        Ok = false,
                        Error = $"servicio agente {respuesta.StatusCode}: {Truncate(cuerpo, 200)}",
                    });
                    continue;
                }

                string? archivoAgente = null;
                using (var doc = JsonDocument.Parse(cuerpo))
                {
                    if (doc.RootElement.TryGetProperty("archivo", out var a) && a.ValueKind == JsonValueKind.String)
                    {
                        archivoAgente = a.GetString();
                    }
                }
                if (string.IsNullOrWhiteSpace(archivoAgente))
                {
                    resultados.Add(new CapturaResultDto
                    {
                        Url = item.Url,
                        Ok = false,
                        Error = $"servicio agente sin archivo en la respuesta: {Truncate(cuerpo, 200)}",
                    });
                    continue;
                }

                using var descarga = await cliente.GetAsync(
                    $"{baseUrl}/c/{Uri.EscapeDataString(archivoAgente)}", ct);
                if (!descarga.IsSuccessStatusCode)
                {
                    resultados.Add(new CapturaResultDto
                    {
                        Url = item.Url,
                        Ok = false,
                        Error = $"no se pudo descargar la captura {archivoAgente}: {descarga.StatusCode}",
                    });
                    continue;
                }

                var bytes = await descarga.Content.ReadAsByteArrayAsync(ct);
                if (bytes.Length < 10_000)
                {
                    resultados.Add(new CapturaResultDto
                    {
                        Url = item.Url,
                        Ok = false,
                        Error = $"captura sospechosamente pequena ({bytes.Length} bytes)",
                    });
                    continue;
                }

                var nombre = Path.GetFileName(archivoAgente);
                if (string.IsNullOrWhiteSpace(nombre)) nombre = $"agentico-{Guid.NewGuid():N}.png";
                if (!nombre.EndsWith(".png", StringComparison.OrdinalIgnoreCase)) nombre += ".png";
                var destino = Path.Combine(_targetCapturasDir, nombre);
                await File.WriteAllBytesAsync(destino, bytes, ct);

                resultados.Add(new CapturaResultDto
                {
                    Url = item.Url,
                    Ok = true,
                    Archivo = $"{CarpetaPublica}/{nombre}",
                });
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "captura agente fallo para {Url}", item.Url);
                resultados.Add(new CapturaResultDto
                {
                    Url = item.Url,
                    Ok = false,
                    Error = Truncate(ex.Message, 200),
                });
            }
        }

        return new CapturaServiceResult { Outcome = CapturaOutcome.Ok, Results = resultados };
    }

    private static CapturaServiceResult FallarTodos(IReadOnlyList<CapturaItem> items, string error)
        => new()
        {
            Outcome = CapturaOutcome.Ok,
            Results = items.Select(i => new CapturaResultDto { Url = i.Url, Ok = false, Error = error }).ToList(),
        };

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
