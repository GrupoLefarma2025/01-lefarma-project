namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

/// <summary>
/// Estampa la firma sobre las coincidencias encontradas y devuelve el PDF resultante.
/// Hay dos implementaciones: rasterizada (camino de producción, aplana cada página)
/// y vectorial (sólo para <c>flatten_pdf=false</c>).
/// </summary>
public interface IPdfStampRenderer
{
    /// <summary>
    /// Dibuja los rectángulos blancos, la imagen de la firma y las líneas de texto.
    /// Recibe el PDF original, no un documento ya modificado.
    /// </summary>
    byte[] Estampar(
        byte[] pdf,
        byte[] imagen,
        IReadOnlyList<CoincidenciaTexto> coincidencias,
        IReadOnlyList<string> lineas,
        PdfSignatureSettings ajustes,
        CancellationToken ct);
}
