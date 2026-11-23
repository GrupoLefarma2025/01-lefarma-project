namespace Lefarma.API.Domain.Entities.Archivos;

public class ArchivoEliminado
{
    public int Id { get; set; }
    public int IdArchivo { get; set; }
    public string EntidadTipo { get; set; } = string.Empty;
    public int EntidadId { get; set; }
    public string Carpeta { get; set; } = string.Empty;
    public string NombreOriginal { get; set; } = string.Empty;
    public string NombreFisico { get; set; } = string.Empty;
    public string Extension { get; set; } = string.Empty;
    public string TipoMime { get; set; } = string.Empty;
    public long TamanoBytes { get; set; }
    public string? HashSha256 { get; set; }
    public string? RutaHistorica { get; set; }
    public string? Metadata { get; set; }
    public int? IdUsuarioSubio { get; set; }
    public DateTime? FechaSubida { get; set; }
    public int? IdUsuarioElimina { get; set; }
    public DateTime? FechaEliminacion { get; set; }
    public string Motivo { get; set; } = "Eliminacion";
}
