using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Lefarma.API.Features.Viaticos.DTOs;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Viaticos;

public class CapturasSettings
{
    public List<string> WhitelistDomains { get; set; } = new();

    public string ScriptPath { get; set; } = "";

    public int HardTimeoutSeconds { get; set; } = 120;

    public string OutputPath { get; set; } = "";

    public string Modo { get; set; } = "script";

    public string ServicioAgenteUrl { get; set; } = "";

    public string ServicioAgenteApiKey { get; set; } = "";

    public int AgenteTimeoutSeconds { get; set; } = 300;
}

public class CapturaServiceResult
{
    public CapturaOutcome Outcome { get; init; } = CapturaOutcome.Ok;
    public string? Message { get; init; }
    public List<CapturaResultDto> Results { get; init; } = new();
}

public enum CapturaOutcome
{
    Ok,             
    TooMany,        
    DomainBlocked,  
    BadRequest,     
}

public class CapturasService
{
    public const int MaxUrls = 10;

    public static string NombreSugerido(
        string? folio,
        int idSolicitud,
        int idOpcion,
        string? destino,
        string? linea,
        string? sufijo = null)
    {
        var partes = new List<string>
        {
            string.IsNullOrWhiteSpace(folio) ? $"viaje{idSolicitud}" : folio.Trim(),
            $"op{idOpcion}",
        };
        if (!string.IsNullOrWhiteSpace(destino)) partes.Add(destino.Trim());
        if (!string.IsNullOrWhiteSpace(linea)) partes.Add(linea.Trim());
        if (!string.IsNullOrWhiteSpace(sufijo)) partes.Add(sufijo.Trim());

        var crudo = string.Join("-", partes);
        var limpio = new StringBuilder(crudo.Length);
        foreach (var caracter in crudo)
        {
            if (char.IsAsciiLetterOrDigit(caracter))
            {
                limpio.Append(caracter);
            }
            else if (limpio.Length > 0 && limpio[^1] != '-')
            {
                limpio.Append('-');
            }
        }
        var nombre = limpio.ToString().Trim('-');
        if (nombre.Length == 0) nombre = $"viaje{idSolicitud}-op{idOpcion}";
        return nombre.Length <= 80 ? nombre : nombre[..80];
    }

    public static string? DestinoDeDatos(string? datosJson)
    {
        if (string.IsNullOrWhiteSpace(datosJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(datosJson);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("a", out var destino)
                && destino.ValueKind == JsonValueKind.String
                ? destino.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static readonly HashSet<string> HardBannedDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "booking.com",
        "expedia.com",
    };

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
            var scriptsDir = Path.GetDirectoryName(_settings.ScriptPath)!;
            frontendRoot = Path.GetFullPath(Path.Combine(scriptsDir, ".."));
            _scriptPath = _settings.ScriptPath;
        }
        else
        {
            frontendRoot = ResolveFrontendRoot();
            _scriptPath = Path.Combine(frontendRoot, "scripts", "captura-viaticos.mjs");
        }
        _publicRoot = Path.Combine(frontendRoot, "public");
        _targetCapturasDir = ResolverDirectorioCapturas(env, _settings);
        Directory.CreateDirectory(_targetCapturasDir);
    }

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

    public string DirectorioCapturas => _targetCapturasDir;

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

    public async Task<CapturaServiceResult> CapturarAsync(IReadOnlyList<CapturaItem> items, CancellationToken ct,
        bool forzarScript = false)
    {
        var validation = Validate(items);
        if (validation.Outcome != CapturaOutcome.Ok) return validation;

        if (items.Count == 0)
        {
            return new CapturaServiceResult { Outcome = CapturaOutcome.Ok, Results = new() };
        }

        if (!forzarScript
            && string.Equals(_settings.Modo, "agente", StringComparison.OrdinalIgnoreCase))
        {
            return await CapturarConAgenteConFallbackAsync(items, ct);
        }

        return await CapturarConScriptAsync(items, ct);
    }

    public async Task<CapturaResultDto?> CapturarOpcionAsync(CapturaItem item, CancellationToken ct)
    {
        var resultado = await CapturarAsync(new[] { item }, ct, forzarScript: true);
        return resultado.Results.FirstOrDefault();
    }

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
            items.Select(i => new
            {
                url = i.Url,
                nombre = i.Nombre ?? "",
                tipo = i.Tipo ?? "",
                linea = i.Linea ?? "",
                precio = i.Precio,
                salida = i.Salida ?? "",
                llegada = i.Llegada ?? "",
                objetivo = i.Objetivo ?? "",
            }).ToList());

        var run = await _runner.RunAsync(_scriptPath, inputJson, _settings.HardTimeoutSeconds, ct);

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
                    Alcance = el.TryGetProperty("alcance", out var al) && al.ValueKind == JsonValueKind.String
                        ? al.GetString() : null,
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

        foreach (var r in parsed)
        {
            if (!r.Ok || string.IsNullOrWhiteSpace(r.Archivo)) continue;

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

    public Task<BusquedaCapturaResult> BuscarAsync(CapturaItem item, CancellationToken ct)
        => BuscarAsync(item, null, ct);

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

    public static bool EsDominioProhibido(string host) =>
        HardBannedDomains.Contains(NormalizeHost(host));

    private static bool IsInternalDestination(string host)
    {
        host = host.Trim('[', ']');
        if (host.Length == 0) return true;
        if (host == "localhost") return true;
        foreach (var suffix in InternalHostSuffixes)
        {
            if (host.EndsWith(suffix, StringComparison.Ordinal)) return true;
        }

        if (!IPAddress.TryParse(host, out var ip))
            return false; 

        if (IPAddress.IsLoopback(ip)) return true;
        if (ip.IsIPv4MappedToIPv6) return IsInternalDestination(ip.MapToIPv4().ToString());

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            if (b[0] == 0) return true;                          
            if (b[0] == 10) return true;                         
            if (b[0] == 127) return true;                        
            if (b[0] == 169 && b[1] == 254) return true;         
            if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true;   
            if (b[0] == 192 && b[1] == 168) return true;         
            if (b[0] == 100 && b[1] >= 64 && b[1] <= 127) return true;  
            return false;
        }

        return ip.IsIPv6LinkLocal          
            || ip.IsIPv6UniqueLocal    
            || ip.IsIPv6SiteLocal;     
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

public record CapturaScriptRun(string Stdout, string Stderr, bool KilledByTimeout);

public interface ICapturasScriptRunner
{
    Task<CapturaScriptRun> RunAsync(string scriptPath, string inputJson, int hardTimeoutSeconds, CancellationToken ct);
}

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
