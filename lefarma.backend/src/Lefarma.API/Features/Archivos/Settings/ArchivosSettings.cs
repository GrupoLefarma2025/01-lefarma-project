namespace Lefarma.API.Features.Archivos.Settings;

public class ArchivosSettings
{
    public string BasePath { get; set; } = "wwwroot/media/archivos";

    /// <summary>
    /// Carpeta privada (fuera de wwwroot y de BasePath) para archivos que solo se
    /// sirven por endpoint autenticado, p.ej. fotos de INE para comprobación de firma.
    /// </summary>
    public string PrivatePath { get; set; } = "private-media";

    /// <summary>
    /// Clave AES-256 en base64 (32 bytes) para cifrar firmas e INE en reposo.
    /// Perderla implica perder la evidencia: respaldarla fuera del servidor.
    /// </summary>
    public string EncryptionKey { get; set; } = "";

    public int TamanoMaximoMB { get; set; } = 10;
    public List<string> ExtensionesPermitidas { get; set; } = new()
    {
        ".pdf", ".xlsx", ".docx", ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".webp"
    };
}
