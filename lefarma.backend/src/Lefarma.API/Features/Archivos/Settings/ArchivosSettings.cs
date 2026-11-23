namespace Lefarma.API.Features.Archivos.Settings;

public class ArchivosSettings
{
    public string BasePath { get; set; } = "wwwroot/media/archivos";

    public string PrivatePath { get; set; } = "private-media";

    public string EncryptionKey { get; set; } = "";

    public int TamanoMaximoMB { get; set; } = 10;
    public List<string> ExtensionesPermitidas { get; set; } = new()
    {
        ".pdf", ".xlsx", ".docx", ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".webp"
    };
}
