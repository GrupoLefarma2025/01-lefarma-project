using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.Viaticos;

public static class ResolverLigaService
{
    private const int MaxSaltos = 5;
    private static readonly TimeSpan CacheDuracion = TimeSpan.FromHours(6);
    private static readonly TimeSpan TimeoutUpstream = TimeSpan.FromSeconds(8);
    private static readonly string[] HostsCortos = ["maps.app.goo.gl", "goo.gl", "g.co", "osm.org"];
    private static readonly string[] DominiosDestino = ["google.com", "google.com.mx", "openstreetmap.org", "apple.com"];

    public static async Task<string?> ResolverAsync(
        HttpClient http, IMemoryCache cache, string? url, CancellationToken ct)
    {
        var crudo = (url ?? string.Empty).Trim();
        if (!Uri.TryCreate(crudo, UriKind.Absolute, out var actual) || !HostCorto(actual))
            throw new ArgumentException("url debe ser una liga https de Google Maps u OpenStreetMap.", nameof(url));

        var claveCache = $"resolverliga:{actual.AbsoluteUri}";
        if (cache.TryGetValue(claveCache, out string? enCache) && enCache is not null)
            return enCache;

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeoutUpstream);
            var t = cts.Token;
            for (var salto = 0; salto <= MaxSaltos; salto++)
            {
                using var res = await http.GetAsync(actual, HttpCompletionOption.ResponseHeadersRead, t);
                var codigo = (int)res.StatusCode;
                if (codigo is >= 300 and < 400)
                {
                    if (res.Headers.Location is null) return null;
                    var siguiente = res.Headers.Location.IsAbsoluteUri
                        ? res.Headers.Location
                        : new Uri(actual, res.Headers.Location);
                    if (!HostPermitido(siguiente))
                        throw new ArgumentException("La liga redirige a un sitio no permitido.", nameof(url));
                    actual = siguiente;
                    continue;
                }
                if (!res.IsSuccessStatusCode) return null;
                var final = actual.AbsoluteUri;
                cache.Set(claveCache, final, CacheDuracion);
                return final;
            }
            return null; 
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; 
        }
        catch (ArgumentException)
        {
            throw; 
        }
        catch
        {
            return null; 
        }
    }

    private static bool HostCorto(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttps && HostsCortos.Contains(uri.Host.ToLowerInvariant());

    private static bool HostPermitido(Uri uri)
    {
        if (uri.Scheme != Uri.UriSchemeHttps) return false;
        var host = uri.Host.ToLowerInvariant();
        return HostsCortos.Contains(host)
            || DominiosDestino.Any(dominio => host == dominio || host.EndsWith("." + dominio));
    }
}
