namespace Lefarma.API.Domain.Entities.Asokam;

public class Documento
{
    public Guid Id { get; set; }
    public string NombreArchivo { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public int TamanoBytes { get; set; }
    public byte[] PDFBinario { get; set; } = Array.Empty<byte>();
    public byte[]? PDFBinarioAutorizado { get; set; }
    public int Estatus { get; set; }
    public DateTime FechaSubida { get; set; }
    public string SubidoPorUsuario { get; set; } = string.Empty;
    public DateTime? FechaAutorizacion { get; set; }
    public string? AutorizadoPorUsuario { get; set; }
    public DateTime? FechaRechazo { get; set; }
    public string? RechazadoPorUsuario { get; set; }
    public string? ComentariosSubida { get; set; }
    public string? ComentariosDecision { get; set; }
    public bool Activo { get; set; } = true;
    public string IpOrigen { get; set; } = string.Empty;
    public string? HashSHA256Autorizado { get; set; }
    public bool EnviadoParaAutorizacion { get; set; }
    public bool NotificacionEnviada { get; set; }
    public string? MetadataJSON { get; set; }
    public bool TieneDocumentoLigado { get; set; }
    public byte[]? PDFBinarioAdicional { get; set; }
}