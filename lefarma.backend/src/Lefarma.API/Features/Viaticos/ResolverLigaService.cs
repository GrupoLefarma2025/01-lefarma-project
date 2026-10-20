using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.Viaticos;

// Resuelve ligas cortas de mapas (Google Maps/OSM) a su URL final: la app
// móvil de Google Maps comparte enlaces cortos (maps.app.goo.gl) y el
// navegador no puede seguirlos por CORS. La entrada debe ser una liga corta
// https de la lista blanca y CADA salto se valida contra los dominios de
// mapas permitidos (anti-SSRF), con máximo de saltos y sin leer cuerpos, para
// no convertirse en un proxy abierto; el User-Agent va configurado en el
// cliente nombrado "enlaces" de Program.cs (con AllowAutoRedirect=false: las
// redirecciones se siguen a mano) y el resultado se cachea 6 h.
public static class ResolverLigaService
{
    private const int MaxSaltos = 5;
    private static readonly TimeSpan CacheDuracion = TimeSpan.FromHours(6);
    private static readonly TimeSpan TimeoutUpstream = TimeSpan.FromSeconds(8);
    // Ligas cortas que el frontend puede mandar (debe coincidir con su lista).
    private static readonly string[] HostsCortos = ["maps.app.goo.gl", "goo.gl", "g.co", "osm.org"];
    // Dominios donde aterrizan las ligas cortas; se aceptan subdominios
    // (www.google.com, maps.google.com.mx, consent.google.com, ...).
    private static readonly string[] DominiosDestino = ["google.com", "google.com.mx", "openstreetmap.org", "apple.com"];

    /// <summary>
    /// Sigue la liga hasta su URL final. Devuelve null cuando no se pudo
    /// resolver (liga muerta, demasiados saltos o error de red) y lanza
    /// ArgumentException si la URL no es una liga corta permitida o si algún
    /// salto apunta fuera de los dominios de mapas permitidos.
    /// </summary>
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
            return null; // Demasiados saltos.
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; // El cliente se fue: no fabricar un 502.
        }
        catch (ArgumentException)
        {
            throw; // Host no permitido a mitad de la cadena: 400.
        }
        catch
        {
            return null; // La liga no se pudo resolver: el controller responde 502.
        }
    }

    /// <summary>Entrada: liga corta https conocida.</summary>
    private static bool HostCorto(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttps && HostsCortos.Contains(uri.Host.ToLowerInvariant());

    /// <summary>Salto: liga corta o subdominio de los dominios de mapas permitidos.</summary>
    private static bool HostPermitido(Uri uri)
    {
        if (uri.Scheme != Uri.UriSchemeHttps) return false;
        var host = uri.Host.ToLowerInvariant();
        return HostsCortos.Contains(host)
            || DominiosDestino.Any(dominio => host == dominio || host.EndsWith("." + dominio));
    }
}
