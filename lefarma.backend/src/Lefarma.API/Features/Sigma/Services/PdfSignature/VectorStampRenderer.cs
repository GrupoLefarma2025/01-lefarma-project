using Microsoft.Extensions.Logging;
using PdfSharp.Drawing;
using PdfSharp.Fonts;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;

namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

public sealed class VectorStampRenderer : IPdfStampRenderer
{
    private static readonly object CandadoFuente = new();

    private readonly ILogger<VectorStampRenderer> _logger;

    public VectorStampRenderer(ILogger<VectorStampRenderer> logger)
    {
        _logger = logger;
        ConfigurarFuentes();
    }

    public byte[] Estampar(
        byte[] pdf,
        byte[] imagen,
        IReadOnlyList<CoincidenciaTexto> coincidencias,
        IReadOnlyList<string> lineas,
        PdfSignatureSettings ajustes,
        CancellationToken ct)
    {
        using var entrada = new MemoryStream(pdf, writable: false);
        using var documento = PdfReader.Open(entrada, PdfDocumentOpenMode.Modify);
        using var imagenFirma = new MemoryStream(imagen, writable: false);
        using var xImagen = XImage.FromStream(imagenFirma);
        var fuente = new XFont("Arial", ajustes.TamanoFuente);

        foreach (var grupo in coincidencias.GroupBy(c => c.Pagina).OrderBy(g => g.Key))
        {
            ct.ThrowIfCancellationRequested();

            var pagina = documento.Pages[grupo.Key - 1];
            var altoContenido = pagina.Height.Point;
            using var grafico = XGraphics.FromPdfPage(pagina, XGraphicsPdfPageOptions.Append);

            var cajas = grupo
                .Select(c => StampGeometry.ContenidoADibujo(c.Caja, altoContenido))
                .ToList();

            foreach (var caja in cajas)
            {
                grafico.DrawRectangle(
                    XBrushes.White,
                    caja.X0 - ajustes.RellenoCubierta,
                    caja.Y0 - ajustes.RellenoCubierta,
                    caja.Ancho + (2 * ajustes.RellenoCubierta),
                    caja.Alto + (2 * ajustes.RellenoCubierta));
            }

            foreach (var caja in cajas)
            {
                var estampa = StampGeometry.Calcular(caja, ajustes, lineas.Count);
                var destino = StampGeometry.AjustarImagen(xImagen.PointWidth, xImagen.PointHeight, estampa.CajaFirma);

                grafico.DrawImage(
                    xImagen,
                    destino.X0,
                    destino.Y0,
                    destino.Ancho,
                    destino.Alto);

                for (var linea = 0; linea < lineas.Count && linea < estampa.LineasBase.Count; linea++)
                {
                    grafico.DrawString(
                        lineas[linea],
                        fuente,
                        XBrushes.Black,
                        new XPoint(estampa.CajaFirma.X0, estampa.LineasBase[linea]),
                        XStringFormats.BaseLineLeft);
                }
            }
        }

        _logger.LogDebug(
            "PDF estampado sin aplanar: {Coincidencias} firmas en {Paginas} páginas.",
            coincidencias.Count,
            coincidencias.Select(c => c.Pagina).Distinct().Count());

        using var salida = new MemoryStream();
        documento.Save(salida, false);
        return salida.ToArray();
    }

    private static void ConfigurarFuentes()
    {
        lock (CandadoFuente)
        {
            GlobalFontSettings.UseWindowsFontsUnderWindows = true;
        }
    }
}
