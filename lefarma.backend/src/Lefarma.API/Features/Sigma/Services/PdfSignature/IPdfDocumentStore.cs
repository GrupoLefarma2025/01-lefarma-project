namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

public sealed record DocumentoFirma(byte[]? Pdf, DateTime? FechaAutorizacion);

public interface IPdfDocumentStore
{
    Task<DocumentoFirma?> ObtenerAsync(Guid idDocumento, CancellationToken ct);

    Task GuardarCopiaAsync(Guid idDocumento, string sufijo, byte[] contenido, CancellationToken ct);

    Task GuardarAutorizadoAsync(Guid idDocumento, byte[] pdfAutorizado, CancellationToken ct);

    Task DesactivarAsync(Guid idDocumento, CancellationToken ct);

    Task EliminarAsync(Guid idDocumento, CancellationToken ct);
}
