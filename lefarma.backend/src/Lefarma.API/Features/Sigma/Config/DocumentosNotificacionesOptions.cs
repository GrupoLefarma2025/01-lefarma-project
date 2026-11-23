namespace Lefarma.API.Features.Sigma.Config;

public sealed class DocumentosNotificacionesOptions
{
    public const string SectionName = "Sigma:DocumentosNotificaciones";

    public string UrlBase { get; set; } = "";

    public string MensajeAutorizacionPendiente { get; set; } = "Tiene documentos pendientes de autorización.";

    public string RemitenteAutorizacion { get; set; } = "Autorizaciones";

    public string CorreoDestinatarioDefault { get; set; } = "autorizaciones@grupolefarma.com.mx";

    public bool EnviarEnLote { get; set; } = true;

    public bool EnviarCorreos { get; set; } = true;

    public List<string> CorreosDestinatariosPrueba { get; set; } = new();

    public string? RutaFirmas { get; set; }

    public string? RutaDocumentos { get; set; }

    public int IntervaloEnvioHoras { get; set; } = 8;
}

public sealed class SigmaOptions
{
    public const string SectionName = "Sigma";

    public string StoragePath { get; set; } = "App_Data/sigma-documentos";

    public long MaxUploadBytes { get; set; } = 52_428_800;
}
