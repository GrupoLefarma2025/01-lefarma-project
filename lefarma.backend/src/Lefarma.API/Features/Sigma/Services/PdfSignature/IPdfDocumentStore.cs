namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

/// <summary>Fila de <c>app.Documentos</c> que necesita el firmado.</summary>
public sealed record DocumentoFirma(byte[]? Pdf, DateTime? FechaAutorizacion);

/// <summary>
/// Todo lo que el motor de firma hace fuera del PDF: leer el binario, dejar las copias
/// en disco y actualizar la base. Se abstrae para poder probar el motor sin SQL Server.
/// </summary>
public interface IPdfDocumentStore
{
    /// <summary>Lee el PDF original y la fecha de autorización del documento.</summary>
    Task<DocumentoFirma?> ObtenerAsync(Guid idDocumento, CancellationToken ct);

    /// <summary>Deja una copia de trabajo en el almacén, con sufijo <c>.pdf</c> o <c>_autorizado.pdf</c>.</summary>
    Task GuardarCopiaAsync(Guid idDocumento, string sufijo, byte[] contenido, CancellationToken ct);

    /// <summary>Guarda el PDF firmado y marca el documento como autorizado.</summary>
    Task GuardarAutorizadoAsync(Guid idDocumento, byte[] pdfAutorizado, CancellationToken ct);

    /// <summary>Marca el documento como inactivo (cuando no se encontró la palabra clave).</summary>
    Task DesactivarAsync(Guid idDocumento, CancellationToken ct);

    /// <summary>Borra la fila del documento (escaneo que no encontró la palabra clave).</summary>
    Task EliminarAsync(Guid idDocumento, CancellationToken ct);
}
