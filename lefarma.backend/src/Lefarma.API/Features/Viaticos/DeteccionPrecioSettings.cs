namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Configuración común de la detección automática de precios: Playwright y el
/// respaldo de Firecrawl. La comparten vuelos, autobuses y hoteles.
/// Vive en appsettings bajo <c>DeteccionPrecioSettings</c>.
/// </summary>
public class DeteccionPrecioSettings
{
    /// <summary>
    /// Ruta absoluta al script de Playwright de vuelos. Vacía = se calcula
    /// junto al frontend. Los scripts de autobús/hotel se resuelven aparte.
    /// </summary>
    public string ScriptPath { get; set; } = "";

    /// <summary>Timeout duro del intento Playwright (segundos).</summary>
    public int TimeoutSeconds { get; set; } = 90;

    /// <summary>URL base de Firecrawl Local (ej. http://192.168.6.4:3002).</summary>
    public string FirecrawlBaseUrl { get; set; } = "";

    /// <summary>Token Bearer de Firecrawl. Vacío = respaldo deshabilitado.</summary>
    public string FirecrawlApiKey { get; set; } = "";

    /// <summary>Timeout del scrape de Firecrawl (segundos).</summary>
    public int FirecrawlTimeoutSeconds { get; set; } = 90;
}
