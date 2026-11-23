using System.Security.Claims;

namespace Lefarma.API.Features.Telemetria.Ingesta;

public static class TelemetriaRateLimit
{
    public const string Politica = "telemetria";
    public const string PoliticaAnonima = "telemetria-anonima";

    public const int PorMinuto = 120;
    public const int AnonimoPorMinuto = 20;

    public static string Particion(HttpContext contexto) =>
        contexto.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? contexto.User.FindFirst("sub")?.Value
        ?? contexto.Connection.RemoteIpAddress?.ToString()
        ?? "desconocido";

    public static string ParticionAnonima(HttpContext contexto) =>
        "anon:" + (contexto.Connection.RemoteIpAddress?.ToString() ?? "desconocido");
}
