namespace Lefarma.API.Features.Viaticos;

public class DeteccionPrecioSettings
{
    public string ScriptPath { get; set; } = "";

    public int TimeoutSeconds { get; set; } = 90;

    public string FirecrawlBaseUrl { get; set; } = "";

    public string FirecrawlApiKey { get; set; } = "";

    public int FirecrawlTimeoutSeconds { get; set; } = 90;
}
