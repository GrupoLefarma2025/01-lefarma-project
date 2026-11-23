namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

public interface IPdfStampRenderer
{
    byte[] Estampar(
        byte[] pdf,
        byte[] imagen,
        IReadOnlyList<CoincidenciaTexto> coincidencias,
        IReadOnlyList<string> lineas,
        PdfSignatureSettings ajustes,
        CancellationToken ct);
}
