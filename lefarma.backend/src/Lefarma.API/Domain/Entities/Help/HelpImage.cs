namespace Lefarma.API.Domain.Entities.Help;
public class HelpImage
{
    public int Id { get; set; }
    public string NombreOriginal { get; set; } = string.Empty;
    public string NombreArchivo { get; set; } = string.Empty; // GUID.ext
    public string RutaRelativa { get; set; } = string.Empty; // /media/help/2025/03/abc-123.png
    public long TamanhoBytes { get; set; }
    public string MimeType { get; set; } = string.Empty; // image/png, image/jpeg, etc.
    public int? Ancho { get; set; } // Ancho en pixeles (opcional)
    public int? Alto { get; set; } // Alto en pixeles (opcional)
    public DateTime FechaSubida { get; set; } = DateTime.UtcNow;
    public string? SubidoPor { get; set; }
}
