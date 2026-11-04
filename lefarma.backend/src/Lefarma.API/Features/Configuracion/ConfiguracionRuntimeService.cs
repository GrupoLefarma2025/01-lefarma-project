using System.Text.Json;
using ErrorOr;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Caché de variables de configuración para consumo del backend.
/// Solo expone variables activas y disponibles para backend.
/// </summary>
public class ConfiguracionRuntimeService : IConfiguracionRuntimeService
{
    private const string PrefijoCache = "configuracion:variable:";
    private const string PrefijoUltimoConocido = "configuracion:ultimo:";

    private static readonly TimeSpan VigenciaCache = TimeSpan.FromMinutes(5);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly ApplicationDbContext _context;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ConfiguracionRuntimeService> _logger;

    public ConfiguracionRuntimeService(
        ApplicationDbContext context,
        IMemoryCache cache,
        ILogger<ConfiguracionRuntimeService> logger)
    {
        _context = context;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ErrorOr<T>> GetAsync<T>(string clave, CancellationToken ct = default)
    {
        var resultado = await ObtenerAsync(clave, ct);
        if (resultado.IsError)
        {
            return resultado.Errors;
        }

        try
        {
            var valor = JsonSerializer.Deserialize<T>(resultado.Value.ValorJson, JsonOptions);
            if (valor is null)
            {
                return CommonErrors.Validation(
                    "valor",
                    $"La variable de configuración '{clave}' no contiene un valor compatible con {typeof(T).Name}.");
            }

            return valor;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex,
                "No se pudo deserializar la variable de configuración {Clave} al tipo {Tipo}.",
                clave,
                typeof(T).Name);

            return CommonErrors.Validation(
                "valor",
                $"La variable de configuración '{clave}' no contiene un valor compatible con {typeof(T).Name}.");
        }
    }

    public async Task<ErrorOr<string>> GetTextAsync(string clave, CancellationToken ct = default)
    {
        var resultado = await ObtenerAsync(clave, ct);
        if (resultado.IsError)
        {
            return resultado.Errors;
        }

        try
        {
            using var documento = JsonDocument.Parse(resultado.Value.ValorJson);
            return documento.RootElement.ValueKind switch
            {
                JsonValueKind.String => documento.RootElement.GetString() ?? string.Empty,
                JsonValueKind.Null => string.Empty,
                _ => documento.RootElement.GetRawText()
            };
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex,
                "La variable de configuración {Clave} no contiene JSON válido.",
                clave);

            return CommonErrors.Validation(
                "valor",
                $"La variable de configuración '{clave}' no contiene JSON válido.");
        }
    }

    public void Invalidar(string clave)
    {
        if (string.IsNullOrWhiteSpace(clave))
        {
            return;
        }

        _cache.Remove(ClaveCache(clave));
        _cache.Remove(ClaveUltimoConocido(clave));
    }

    private async Task<ErrorOr<ConfiguracionValorCache>> ObtenerAsync(
        string clave,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(clave))
        {
            return CommonErrors.Validation("clave", "La clave de la variable es obligatoria.");
        }

        var normalizada = clave.Trim();
        var claveCache = ClaveCache(normalizada);

        if (_cache.TryGetValue(claveCache, out ConfiguracionValorCache? enCache) && enCache is not null)
        {
            return enCache;
        }

        try
        {
            var entidad = await _context.ConfigVariables
                .AsNoTracking()
                .Where(v => v.Clave == normalizada && v.Activo && v.DisponibleBackend)
                .Select(v => new { v.Clave, v.TipoDato, v.ValorJson, v.Version })
                .FirstOrDefaultAsync(ct);

            if (entidad is null)
            {
                return CommonErrors.NotFound("ConfigVariable", normalizada);
            }

            var valor = new ConfiguracionValorCache(
                entidad.Clave,
                entidad.TipoDato,
                entidad.ValorJson,
                entidad.Version);

            _cache.Set(claveCache, valor, VigenciaCache);
            _cache.Set(ClaveUltimoConocido(normalizada), valor);

            return valor;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            if (_cache.TryGetValue(ClaveUltimoConocido(normalizada), out ConfiguracionValorCache? ultimo) &&
                ultimo is not null)
            {
                _logger.LogWarning(ex,
                    "No se pudo leer la variable de configuración {Clave}; se devuelve el último valor conocido.",
                    normalizada);

                return ultimo;
            }

            _logger.LogError(ex,
                "No se pudo leer la variable de configuración {Clave} y no hay un valor previo en caché.",
                normalizada);

            return CommonErrors.DatabaseError("consultar la variable de configuración");
        }
    }

    private static string ClaveCache(string clave) => $"{PrefijoCache}{clave.ToLowerInvariant()}";

    private static string ClaveUltimoConocido(string clave) => $"{PrefijoUltimoConocido}{clave.ToLowerInvariant()}";

    private sealed record ConfiguracionValorCache(
        string Clave,
        string TipoDato,
        string ValorJson,
        long Version);
}
