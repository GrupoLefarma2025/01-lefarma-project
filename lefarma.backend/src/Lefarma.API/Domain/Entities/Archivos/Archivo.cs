namespace Lefarma.API.Domain.Entities.Archivos;
public class Archivo
{
    public int Id { get; set; }
    public string EntidadTipo { get; set; } = string.Empty;
    public int EntidadId { get; set; }
    public string Carpeta { get; set; } = string.Empty;
    public string NombreOriginal { get; set; } = string.Empty;
    public string NombreFisico { get; set; } = string.Empty;
    public string Extension { get; set; } = string.Empty;
    public string TipoMime { get; set; } = string.Empty;
    public long TamanoBytes { get; set; }
    public string? Metadata { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaEdicion { get; set; }
    public int? UsuarioId { get; set; }
    public bool Activo { get; set; } = true;
}
