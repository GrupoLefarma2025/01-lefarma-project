using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.Viaticos;

// Proxy de Nominatim para el selector de puntos en mapa (viáticos).
// La política de OSM (https://operations.osmfoundation.org/policies/nominatim/)
// prohíbe el autocompletado desde el navegador y exige un User-Agent
// identificable con máximo 1 request/s: la búsqueda pasa por aquí con cache
// de 6 h (patrón de CalculoCostosRuta), separación mínima de 1 s entre
// requests upstream y timeout de 12 s (como el conector Overpass).
// El HttpClient lo crea el controller desde el cliente nombrado "nominatim",
// que ya lleva el User-Agent configurado en Program.cs.
public record GeocodificarResultado(string Nombre, double Latitud, double Longitud);

public static class GeocodificarService
{
    // Mismo acotado que enviaba el selector: siempre México, 5 resultados.
    private const string UpstreamBase = "https://nominatim.openstreetmap.org/search";
    private const int MinCaracteres = 3;
    private const int MinSeparacionUpstreamMs = 1000;
    private static readonly TimeSpan CacheDuracion = TimeSpan.FromHours(6);
    private static readonly TimeSpan TimeoutUpstream = TimeSpan.FromSeconds(12);

    // Serializa la toma de turno hacia upstream: los inicios de request quedan
    // separados >= 1 s aunque lleguen en ráfaga (política de máximo 1 req/s).
    private static readonly SemaphoreSlim UpstreamGate = new(1, 1);
    private static long _ultimoInicioUpstreamTicks;

    /// <summary>
    /// Geocodifica vía Nominatim y devuelve resultados ya normalizados con el
    /// shape de PuntoSeleccion (nombre/latitud/longitud, sin coordenadas no
    /// finitas). Devuelve null si upstream no respondió; ArgumentException si
    /// la entrada es inválida. Cachea solo respuestas exitosas por 6 h.
    /// </summary>
    public static async Task<List<GeocodificarResultado>?> GeocodificarAsync(
        HttpClient http, IMemoryCache cache,
        string? tipo, string? texto, string? estado, string? municipio,
        CancellationToken ct)
    {
        var textoLimpio = (texto ?? string.Empty).Trim();
        if (textoLimpio.Length < MinCaracteres)
            throw new ArgumentException($"texto debe tener al menos {MinCaracteres} caracteres.", nameof(texto));

        string claveCache;
        string urlUpstream;
        if (tipo == "global")
        {
            claveCache = $"geocodificar:global:{textoLimpio.ToLowerInvariant()}";
            urlUpstream =
                $"{UpstreamBase}?format=jsonv2&countrycodes=mx&addressdetails=1&limit=5&q={Uri.EscapeDataString(textoLimpio)}";
        }
        else if (tipo == "cascada")
        {
            var estadoLimpio = (estado ?? string.Empty).Trim();
            var municipioLimpio = (municipio ?? string.Empty).Trim();
            if (estadoLimpio.Length == 0 || municipioLimpio.Length == 0)
                throw new ArgumentException("tipo=cascada requiere estado y municipio.", nameof(estado));
            claveCache =
                $"geocodificar:cascada:{estadoLimpio.ToLowerInvariant()}:{municipioLimpio.ToLowerInvariant()}:{textoLimpio.ToLowerInvariant()}";
            urlUpstream =
                $"{UpstreamBase}?format=jsonv2&countrycodes=mx&state={Uri.EscapeDataString(estadoLimpio)}&city={Uri.EscapeDataString(municipioLimpio)}&street={Uri.EscapeDataString(textoLimpio)}&limit=5";
        }
        else
        {
            throw new ArgumentException("tipo debe ser global o cascada.", nameof(tipo));
        }

        if (cache.TryGetValue(claveCache, out List<GeocodificarResultado>? enCache) && enCache is not null)
            return enCache;

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeoutUpstream);
            var t = cts.Token;
            await RespetarUnRequestPorSegundoAsync(t);
            using var res = await http.GetAsync(urlUpstream, t);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(t), cancellationToken: t);
            var resultados = new List<GeocodificarResultado>();
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.RootElement.EnumerateArray())
                {
                    var nombre = item.TryGetProperty("display_name", out var dn) ? dn.GetString()?.Trim() : null;
                    if (!item.TryGetProperty("lat", out var latEl)) continue;
                    if (!double.TryParse(latEl.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var lat)) continue;
                    if (!item.TryGetProperty("lon", out var lonEl)) continue;
                    if (!double.TryParse(lonEl.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var lon)) continue;
                    resultados.Add(new GeocodificarResultado(string.IsNullOrEmpty(nombre) ? "Punto sin nombre" : nombre, lat, lon));
                }
            }
            cache.Set(claveCache, resultados, CacheDuracion);
            return resultados;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; // El cliente se fue: no fabricar un 502.
        }
        catch
        {
            return null; // Upstream falló: el controller responde 502.
        }
    }

    private static async Task RespetarUnRequestPorSegundoAsync(CancellationToken ct)
    {
        await UpstreamGate.WaitAsync(ct);
        try
        {
            var esperaMs = MinSeparacionUpstreamMs - (Environment.TickCount64 - _ultimoInicioUpstreamTicks);
            if (esperaMs > 0) await Task.Delay(TimeSpan.FromMilliseconds(esperaMs), ct);
            _ultimoInicioUpstreamTicks = Environment.TickCount64;
        }
        finally
        {
            UpstreamGate.Release();
        }
    }
}
