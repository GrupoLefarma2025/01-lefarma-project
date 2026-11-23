using System.Text;
using PdfSharp.Drawing;
using PdfSharp.Fonts;
using PdfSharp.Pdf;
using SkiaSharp;

namespace Lefarma.UnitTests.Features.Sigma.PdfSignature;

internal static class PdfDePrueba
{
    static PdfDePrueba()
    {
        GlobalFontSettings.UseWindowsFontsUnderWindows = true;
    }

    public static byte[] Crear(string? texto = null, double x = 50, double y = 100)
    {
        var documento = new PdfDocument();
        var pagina = documento.AddPage();
        pagina.Width = XUnit.FromPoint(300);
        pagina.Height = XUnit.FromPoint(200);

        if (!string.IsNullOrEmpty(texto))
        {
            using var grafico = XGraphics.FromPdfPage(pagina);
            grafico.DrawString(texto, new XFont("Arial", 10), XBrushes.Black, new XPoint(x, y));
        }

        using var memoria = new MemoryStream();
        documento.Save(memoria, false);
        return memoria.ToArray();
    }

    public static byte[] CrearConDosApariciones(string texto)
    {
        var documento = new PdfDocument();
        var pagina = documento.AddPage();
        pagina.Width = XUnit.FromPoint(300);
        pagina.Height = XUnit.FromPoint(200);

        using (var grafico = XGraphics.FromPdfPage(pagina))
        {
            grafico.DrawString(texto, new XFont("Arial", 10), XBrushes.Black, new XPoint(40, 60));
            grafico.DrawString(texto, new XFont("Arial", 10), XBrushes.Black, new XPoint(200, 150));
        }

        using var memoria = new MemoryStream();
        documento.Save(memoria, false);
        return memoria.ToArray();
    }

    public static byte[] CrearConTextoEnSegundaPagina(string texto)
    {
        var documento = new PdfDocument();
        var primera = documento.AddPage();
        primera.Width = XUnit.FromPoint(300);
        primera.Height = XUnit.FromPoint(200);

        var segunda = documento.AddPage();
        segunda.Width = XUnit.FromPoint(300);
        segunda.Height = XUnit.FromPoint(200);

        using (var grafico = XGraphics.FromPdfPage(segunda))
        {
            grafico.DrawString(texto, new XFont("Arial", 10), XBrushes.Black, new XPoint(40, 90));
        }

        using var memoria = new MemoryStream();
        documento.Save(memoria, false);
        return memoria.ToArray();
    }

    public static byte[] CrearBase14(string texto, double x = 50, double yArriba = 100, double tamano = 10)
    {
        var contenido = string.Create(
            System.Globalization.CultureInfo.InvariantCulture,
            $"BT /F1 {tamano:0.####} Tf 1 0 0 1 {x:0.####} {200 - yArriba:0.####} Tm ({texto}) Tj ET");

        var objetos = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 300 200] >>",
            "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            $"<< /Length {Encoding.Latin1.GetByteCount(contenido)} >>\nstream\n{contenido}\nendstream"
        };

        using var memoria = new MemoryStream();

        void Escribir(string plano)
        {
            memoria.Write(Encoding.Latin1.GetBytes(plano));
        }

        Escribir("%PDF-1.4\n");
        var posiciones = new List<long>(objetos.Count);
        for (var indice = 0; indice < objetos.Count; indice++)
        {
            posiciones.Add(memoria.Position);
            Escribir($"{indice + 1} 0 obj\n{objetos[indice]}\nendobj\n");
        }

        var inicioXref = memoria.Position;
        Escribir($"xref\n0 {objetos.Count + 1}\n0000000000 65535 f \n");
        foreach (var posicion in posiciones)
        {
            Escribir($"{posicion:D10} 00000 n \n");
        }

        Escribir($"trailer\n<< /Size {objetos.Count + 1} /Root 1 0 R >>\nstartxref\n{inicioXref}\n%%EOF\n");

        return memoria.ToArray();
    }

    public static void EscribirFirma(string ruta)
    {
        using var mapa = new SKBitmap(40, 20);
        using (var lienzo = new SKCanvas(mapa))
        {
            lienzo.Clear(SKColors.Transparent);
        }

        using var imagen = SKImage.FromBitmap(mapa);
        using var datos = imagen.Encode(SKEncodedImageFormat.Png, 100);
        File.WriteAllBytes(ruta, datos.ToArray());
    }

    public static int ContarCadena(byte[] pdf, string cadena) =>
        System.Text.Encoding.ASCII.GetString(pdf)
            .Split(cadena, StringSplitOptions.None)
            .Length - 1;
}
