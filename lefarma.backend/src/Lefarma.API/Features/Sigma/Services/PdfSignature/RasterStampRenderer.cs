using Microsoft.Extensions.Logging;
using PDFtoImage;
using PdfSharp.Drawing;
using SkiaSharp;
using PdfPigDocument = UglyToad.PdfPig.PdfDocument;

namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

/// <summary>
/// Camino de producción: rasteriza cada página con PDFium a 250 dpi, dibuja encima con
/// SkiaSharp y arma un PDF nuevo con una imagen por página. Reproduce el aplanado que
/// hacía <c>page.get_pixmap(...)</c> en el script.
/// </summary>
public sealed class RasterStampRenderer : IPdfStampRenderer
{
    private readonly ILogger<RasterStampRenderer> _logger;

    public RasterStampRenderer(ILogger<RasterStampRenderer> logger) => _logger = logger;

    public byte[] Estampar(
        byte[] pdf,
        byte[] imagen,
        IReadOnlyList<CoincidenciaTexto> coincidencias,
        IReadOnlyList<string> lineas,
        PdfSignatureSettings ajustes,
        CancellationToken ct)
    {
        using var origen = PdfPigDocument.Open(pdf);
        using var imagenFirma = SKImage.FromEncodedData(imagen);
        if (imagenFirma is null)
        {
            throw new InvalidOperationException("No se pudo leer la imagen de la firma.");
        }

        using var salida = new PdfSharp.Pdf.PdfDocument();
        CopiarMetadatos(origen, salida);

        var recursos = new List<IDisposable>();

        // MuPDF, el que usa el script de Python, dibuja las anotaciones al aplanar. PDFium no lo
        // hace si no se le pide, y con eso se perdían las notas que los usuarios dejan en el PDF
        // (anotaciones FreeText, por ejemplo junto a la firma).
        var opciones = new RenderOptions
        {
            Dpi = ajustes.DpiAplanado,
            WithAnnotations = true,
            WithFormFill = true,
        };
        var numero = 1;

        try
        {
            // El backend se publica en IIS sobre Windows; PDFium no aplica en otros SO.
#pragma warning disable CA1416
            foreach (var mapaBits in Conversion.ToImages(pdf, null, opciones))
#pragma warning restore CA1416
            {
                ct.ThrowIfCancellationRequested();

                using (mapaBits)
                {
                    var pagina = origen.GetPage(numero);
                    var (anchoVisual, altoVisual) = StampGeometry.DimensionesVisuales(
                        pagina.Width,
                        pagina.Height,
                        pagina.Rotation.Value);

                    var anchoLienzo = mapaBits.Info.Width;
                    var altoLienzo = mapaBits.Info.Height;
                    var escalaX = anchoLienzo / anchoVisual;
                    var escalaY = altoLienzo / altoVisual;

                    using var lienzo = new SKBitmap(
                        anchoLienzo,
                        altoLienzo,
                        SKColorType.Bgra8888,
                        SKAlphaType.Premul);

                    using (var canvas = new SKCanvas(lienzo))
                    {
                        canvas.DrawBitmap(mapaBits, 0, 0, null);
                        DibujarEstampas(
                            canvas,
                            imagenFirma,
                            coincidencias.Where(c => c.Pagina == numero),
                            lineas,
                            ajustes,
                            escalaX,
                            escalaY);
                    }

                    recursos.Add(AgregarPagina(salida, lienzo, anchoVisual, altoVisual));
                }

                numero++;
            }

            _logger.LogDebug(
                "PDF rasterizado a {Dpi} dpi: {Paginas} páginas con firma.",
                ajustes.DpiAplanado,
                numero - 1);

            using var resultado = new MemoryStream();
            salida.Save(resultado, false);
            return resultado.ToArray();
        }
        finally
        {
            foreach (var recurso in recursos)
            {
                recurso.Dispose();
            }
        }
    }

    private static void DibujarEstampas(
        SKCanvas canvas,
        SKImage imagenFirma,
        IEnumerable<CoincidenciaTexto> coincidencias,
        IReadOnlyList<string> lineas,
        PdfSignatureSettings ajustes,
        double escalaX,
        double escalaY)
    {
        using var pincelCubierta = new SKPaint { Color = SKColors.White, IsAntialias = false };
        using var pincelImagen = new SKPaint { IsAntialias = true };
        using var pincelTexto = new SKPaint { Color = SKColors.Black, IsAntialias = true };
        using var tipo = SKTypeface.FromFamilyName("Arial") ?? SKTypeface.Default;
        using var fuente = new SKFont(tipo, (float)(ajustes.TamanoFuente * escalaY));

        var estampas = new List<EstampaFirma>();
        var cajasVisuales = new List<CajaDibujo>();

        foreach (var coincidencia in coincidencias)
        {
            var cajaVisual = StampGeometry.ContenidoAVisual(
                coincidencia.Caja,
                coincidencia.AnchoContenido,
                coincidencia.AltoContenido,
                coincidencia.Rotacion);

            cajasVisuales.Add(cajaVisual);
            estampas.Add(StampGeometry.Calcular(cajaVisual, ajustes, lineas.Count));
        }

        // Primero todas las cubiertas y después firmas y textos, como el script:
        // así una firma nunca queda tapada por el rectángulo blanco de otra.
        foreach (var caja in cajasVisuales)
        {
            var cubierta = new CajaDibujo(
                caja.X0 - ajustes.RellenoCubierta,
                caja.Y0 - ajustes.RellenoCubierta,
                caja.X1 + ajustes.RellenoCubierta,
                caja.Y1 + ajustes.RellenoCubierta);

            canvas.DrawRect(
                SKRect.Create(
                    (float)(cubierta.X0 * escalaX),
                    (float)(cubierta.Y0 * escalaY),
                    (float)(cubierta.Ancho * escalaX),
                    (float)(cubierta.Alto * escalaY)),
                pincelCubierta);
        }

        for (var indice = 0; indice < estampas.Count; indice++)
        {
            var estampa = estampas[indice];
            var destino = StampGeometry.AjustarImagen(
                imagenFirma.Width,
                imagenFirma.Height,
                estampa.CajaFirma);

            canvas.DrawImage(
                imagenFirma,
                SKRect.Create(
                    (float)(destino.X0 * escalaX),
                    (float)(destino.Y0 * escalaY),
                    (float)(destino.Ancho * escalaX),
                    (float)(destino.Alto * escalaY)),
                pincelImagen);

            for (var linea = 0; linea < lineas.Count && linea < estampa.LineasBase.Count; linea++)
            {
                canvas.DrawText(
                    lineas[linea],
                    (float)(estampa.CajaFirma.X0 * escalaX),
                    (float)(estampa.LineasBase[linea] * escalaY),
                    SKTextAlign.Left,
                    fuente,
                    pincelTexto);
            }
        }
    }

    /// <summary>
    /// Agrega al PDF de salida una página del tamaño visible original con la imagen
    /// rasterizada ocupándola completa, y devuelve el recurso que hay que liberar.
    /// </summary>
    private IDisposable AgregarPagina(
        PdfSharp.Pdf.PdfDocument salida,
        SKBitmap lienzo,
        double anchoVisual,
        double altoVisual)
    {
        using var imagenPng = SKImage.FromBitmap(lienzo);
        using var datos = imagenPng.Encode(SKEncodedImageFormat.Png, 100);
        if (datos is null)
        {
            throw new InvalidOperationException("No se pudo codificar la página rasterizada.");
        }

        var flujo = new MemoryStream(datos.ToArray(), writable: false);
        var pagina = salida.AddPage();
        pagina.Width = XUnit.FromPoint(anchoVisual);
        pagina.Height = XUnit.FromPoint(altoVisual);

        var grafico = XGraphics.FromPdfPage(pagina);
        var imagen = XImage.FromStream(flujo);
        grafico.DrawImage(imagen, 0, 0, anchoVisual, altoVisual);

        return new RecursosPagina(grafico, imagen, flujo);
    }

    private static void CopiarMetadatos(PdfPigDocument origen, PdfSharp.Pdf.PdfDocument salida)
    {
        var informacion = origen.Information;
        var destino = salida.Info;

        destino.Title = informacion.Title ?? string.Empty;
        destino.Author = informacion.Author ?? string.Empty;
        destino.Subject = informacion.Subject ?? string.Empty;
        destino.Keywords = informacion.Keywords ?? string.Empty;
        destino.Creator = informacion.Creator ?? string.Empty;

        // PdfPig expone las fechas como cadena PDF cruda y PDFsharp las reescribe al
        // guardar; se copian sólo los textos, como se documenta en la prueba de paridad.
    }    private sealed class RecursosPagina : IDisposable
    {
        private readonly XGraphics _grafico;
        private readonly XImage _imagen;
        private readonly MemoryStream _flujo;

        public RecursosPagina(XGraphics grafico, XImage imagen, MemoryStream flujo)
        {
            _grafico = grafico;
            _imagen = imagen;
            _flujo = flujo;
        }

        public void Dispose()
        {
            _grafico.Dispose();
            _imagen.Dispose();
            _flujo.Dispose();
        }
    }
}
