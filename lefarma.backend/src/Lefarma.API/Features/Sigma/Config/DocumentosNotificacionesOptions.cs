namespace Lefarma.API.Features.Sigma.Config;

/// <summary>
/// Configuración de notificaciones de documentos (puerto de DocumentosNotificacionesConfig de SIGMA).
/// Se enlaza desde la sección <c>Sigma:DocumentosNotificaciones</c>.
/// </summary>
public sealed class DocumentosNotificacionesOptions
{
    public const string SectionName = "Sigma:DocumentosNotificaciones";

    /// <summary>
    /// URL pública base de la aplicación (sin <c>/api</c>). Se usa para armar los enlaces
    /// de validación y descarga de los correos, porque ahora todo vive en el mismo sitio.
    /// </summary>
    public string UrlBase { get; set; } = "";

    public string MensajeAutorizacionPendiente { get; set; } = "Tiene documentos pendientes de autorización.";

    public string RemitenteAutorizacion { get; set; } = "Autorizaciones";

    /// <summary>Destinatario del envío masivo de autorizaciones pendientes.</summary>
    public string CorreoDestinatarioDefault { get; set; } = "autorizaciones@grupolefarma.com.mx";

    public bool EnviarEnLote { get; set; } = true;

    /// <summary>
    /// Interruptor general de correos del módulo Documentos.
    /// false: los correos NO se envían a los destinatarios reales; si
    /// <see cref="CorreosDestinatariosPrueba"/> tiene direcciones, se envían solo a esas
    /// (con el asunto prefijado con «[PRUEBA]»). Sin direcciones de prueba, no se envía nada.
    /// true: se envían los correos normalmente.
    /// </summary>
    public bool EnviarCorreos { get; set; } = true;

    /// <summary>
    /// Direcciones que reciben TODOS los correos del módulo cuando <see cref="EnviarCorreos"/>
    /// está en false. Puede haber varias.
    /// </summary>
    public List<string> CorreosDestinatariosPrueba { get; set; } = new();

    /// <summary>Ruta de firmas de usuario de SIGMA. No se usa; se conserva por compatibilidad.</summary>
    public string? RutaFirmas { get; set; }

    /// <summary>Ruta de documentos de SIGMA (legado). El almacenamiento nuevo usa Sigma:StoragePath.</summary>
    public string? RutaDocumentos { get; set; }

    public int IntervaloEnvioHoras { get; set; } = 8;
}

/// <summary>Configuración general del módulo Documentos (sección <c>Sigma</c>).</summary>
public sealed class SigmaOptions
{
    public const string SectionName = "Sigma";

    /// <summary>Ruta de almacenamiento de PDFs, relativa al ContentRoot si no es absoluta.</summary>
    public string StoragePath { get; set; } = "App_Data/sigma-documentos";

    /// <summary>Tamaño máximo de subida en bytes (por defecto 50 MB).</summary>
    public long MaxUploadBytes { get; set; } = 52_428_800;
}
