namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Evidencia del taller (fotos/video/documentos post-taller, 1:N); archivo_url apunta al
/// servicio de archivos existente. ADR-00008.
/// </summary>
public class TallerEvidencia
{
    public const string TipoFoto = "foto";
    public const string TipoVideo = "video";
    public const string TipoDocumento = "documento";

    public static readonly string[] TiposValidos = [TipoFoto, TipoVideo, TipoDocumento];

    public int IdEvidencia { get; set; }
    public int IdTaller { get; set; }
    public string TipoEvidencia { get; set; } = TipoFoto;
    public string ArchivoUrl { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public DateOnly? FechaEvidencia { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public virtual Taller? Taller { get; set; }
}
