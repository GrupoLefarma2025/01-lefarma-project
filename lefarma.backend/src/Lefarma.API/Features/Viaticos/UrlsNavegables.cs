using System.Net;
using System.Net.Sockets;

namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Reglas de navegación para las URLs que captura el servidor (Playwright o
/// Firecrawl). Bloquea loopback, rangos privados y hosts internos para que una
/// cotización no pueda apuntar a la intranet. La usan el endpoint bajo demanda
/// y la cola automática.
/// </summary>
public static class UrlsNavegables
{
    public static bool EsPermitida(Uri uri)
    {
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;
        if (uri.IsLoopback) return false;

        var host = uri.Host.Trim('[', ']').ToLowerInvariant();
        if (host == "localhost"
            || host.EndsWith(".localhost", StringComparison.Ordinal)
            || host.EndsWith(".local", StringComparison.Ordinal)
            || host.EndsWith(".internal", StringComparison.Ordinal))
        {
            return false;
        }

        if (!IPAddress.TryParse(host, out var ip)) return true;
        if (IPAddress.IsLoopback(ip)) return false;

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            return !(b[0] == 0
                     || b[0] == 10
                     || b[0] == 127
                     || (b[0] == 169 && b[1] == 254)
                     || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
                     || (b[0] == 192 && b[1] == 168)
                     || (b[0] == 100 && b[1] >= 64 && b[1] <= 127));
        }

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            var b = ip.GetAddressBytes();
            var ula = (b[0] & 0xfe) == 0xfc;
            return !ip.IsIPv6LinkLocal && !ip.IsIPv6SiteLocal && !ula;
        }

        return true;
    }
}
