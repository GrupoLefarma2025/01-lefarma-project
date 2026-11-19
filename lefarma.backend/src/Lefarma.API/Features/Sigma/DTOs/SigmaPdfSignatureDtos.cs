namespace Lefarma.API.Features.Sigma.DTOs;

// Puerto del servicio de documentos de Asokam (/asokam/pdf-signature) que vive en
// P:\Trabajo\core-manager; aquí sólo se traen las lecturas que usa la bandeja de SIGMA.

/// <summary>Fila del listado de documentos (sp_ObtenerDocumentos).</summary>
public sealed record PdfSignatureDocumentoDto
{
    public Guid Id { get; init; }
    public string? NombreArchivo { get; init; }
    public string? MimeType { get; init; }
    public long? TamanoBytes { get; init; }
    public int Estatus { get; init; }
    public DateTime? FechaSubida { get; init; }
    public string? SubidoPorUsuario { get; init; }
    public DateTime? FechaAutorizacion { get; init; }
    public string? AutorizadoPorUsuario { get; init; }
    public DateTime? FechaRechazo { get; init; }
    public string? RechazadoPorUsuario { get; init; }
    public string? ComentariosSubida { get; init; }
    public string? ComentariosDecision { get; init; }
    public bool Activo { get; init; }
    public string? IpOrigen { get; init; }
    public bool? TieneDocumentoLigado { get; init; }
}

internal sealed record PdfSignatureDocumentoRow
{
    public Guid Id { get; init; }
    public string? NombreArchivo { get; init; }
    public string? MimeType { get; init; }
    public long? TamanoBytes { get; init; }
    public int Estatus { get; init; }
    public DateTime? FechaSubida { get; init; }
    public string? SubidoPorUsuario { get; init; }
    public DateTime? FechaAutorizacion { get; init; }
    public string? AutorizadoPorUsuario { get; init; }
    public DateTime? FechaRechazo { get; init; }
    public string? RechazadoPorUsuario { get; init; }
    public string? ComentariosSubida { get; init; }
    public string? ComentariosDecision { get; init; }
    public bool Activo { get; init; }
    public string? IpOrigen { get; init; }
    public bool? TieneDocumentoLigado { get; init; }
}

internal sealed record PdfSignatureDocumentoDetalleRow
{
    public Guid Id { get; init; }
    public string? NombreArchivo { get; init; }
    public string? MimeType { get; init; }
    public long? TamanoBytes { get; init; }
    public byte[]? PDFBinario { get; init; }
    public byte[]? PDFBinarioAutorizado { get; init; }
    public int Estatus { get; init; }
    public DateTime? FechaSubida { get; init; }
    public string? SubidoPorUsuario { get; init; }
    public DateTime? FechaAutorizacion { get; init; }
    public string? AutorizadoPorUsuario { get; init; }
    public DateTime? FechaRechazo { get; init; }
    public string? RechazadoPorUsuario { get; init; }
    public string? ComentariosSubida { get; init; }
    public string? ComentariosDecision { get; init; }
    public bool Activo { get; init; }
    public string? IpOrigen { get; init; }
    public bool? TieneDocumentoLigado { get; init; }
}

// Escrituras del servicio de PDFs (subir, autorizar, rechazar, eliminar y verificar).

/// <summary>Petición de autorización o rechazo de un documento.</summary>
public sealed record AutorizarRechazarPdfRequest
{
    public Guid IdDocumento { get; init; }
    public string? Usuario { get; init; }
    public string? Motivo { get; init; }
}

/// <summary>Fila de resultado de <c>app.sp_GestionarDocumento</c>.</summary>
internal sealed record GestionDocumentoResultado
{
    public int Codigo { get; init; }
    public string? Mensaje { get; init; }
    public Guid? IdDocumento { get; init; }
}
