namespace Lefarma.API.Domain.Entities.Help;
public class HelpImage
{
    public int Id { get; set; }
    public string NombreOriginal { get; set; } = string.Empty;
    public string NombreArchivo { get; set; } = string.Empty; 
    public string RutaRelativa { get; set; } = string.Empty; 
    public long TamanhoBytes { get; set; }
    public string MimeType { get; set; } = string.Empty; 
    public int? Ancho { get; set; } 
    public int? Alto { get; set; } 
    public DateTime FechaSubida { get; set; } = DateTime.UtcNow;
    public string? SubidoPor { get; set; }
}
