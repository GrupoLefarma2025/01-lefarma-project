using System.Text;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

/// <summary>Texto encontrado en una página, con su rotación y su tamaño sin rotar.</summary>
public sealed record CoincidenciaTexto(
    int Pagina,
    int Rotacion,
    double AnchoContenido,
    double AltoContenido,
    CajaContenido Caja);

/// <summary>
/// Localiza el texto marcador (por defecto <c>#firmad</c>) dentro del PDF.
/// Reproduce el criterio de <c>page.search_for</c> de PyMuPDF: sin distinguir
/// mayúsculas, cortando la búsqueda en la primera página donde aparece.
/// </summary>
public static class PdfTextLocator
{
    /// <summary>
    /// Diferencia máxima de línea base, en puntos, para considerar que dos letras
    /// están en la misma línea. Evita unir coincidencias que cruzan renglones.
    /// </summary>
    private const double ToleranciaLinea = 1.0;

    /// <summary>
    /// Altura de la línea base al borde superior del rectángulo que MuPDF usa para
    /// las fuentes estándar (base 14) sin incrustar. PyMuPDF las mide con sus propias
    /// métricas y no con el rectángulo del glifo, así que sin esta tabla la firma
    /// quedaría unos puntos más abajo que con el script. Valores medidos contra
    /// PyMuPDF 1.27.1.
    /// </summary>
    private static readonly Dictionary<string, double> AscensosBase14 = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Helvetica"] = 1.075,
        ["Helvetica-Bold"] = 1.070,
        ["Helvetica-Oblique"] = 1.070,
        ["Helvetica-BoldOblique"] = 1.073,
        ["Times-Roman"] = 1.053,
        ["Times-Bold"] = 1.044,
        ["Times-Italic"] = 0.951,
        ["Times-BoldItalic"] = 0.972,
        ["Courier"] = 0.932,
        ["Courier-Bold"] = 1.007,
        ["Courier-Oblique"] = 0.920,
        ["Courier-BoldOblique"] = 0.997,
        ["Symbol"] = 1.010,
        ["ZapfDingbats"] = 0.851
    };

    /// <summary>Devuelve todas las coincidencias del PDF, página por página.</summary>
    public static IReadOnlyList<CoincidenciaTexto> Buscar(byte[] pdf, string texto)
    {
        if (pdf is null || pdf.Length == 0 || string.IsNullOrEmpty(texto))
        {
            return Array.Empty<CoincidenciaTexto>();
        }

        using var documento = PdfDocument.Open(pdf);
        var encontradas = new List<CoincidenciaTexto>();

        for (var numero = 1; numero <= documento.NumberOfPages; numero++)
        {
            AgregarDePagina(documento.GetPage(numero), texto, encontradas);
        }

        return encontradas;
    }

    /// <summary>
    /// Búsqueda de escaneo: igual que el script, se detiene en la primera página
    /// con al menos una coincidencia.
    /// </summary>
    public static IReadOnlyList<CoincidenciaTexto> BuscarEnPrimeraPagina(byte[] pdf, string texto)
    {
        if (pdf is null || pdf.Length == 0 || string.IsNullOrEmpty(texto))
        {
            return Array.Empty<CoincidenciaTexto>();
        }

        using var documento = PdfDocument.Open(pdf);

        for (var numero = 1; numero <= documento.NumberOfPages; numero++)
        {
            var encontradas = new List<CoincidenciaTexto>();
            AgregarDePagina(documento.GetPage(numero), texto, encontradas);
            if (encontradas.Count > 0)
            {
                return encontradas;
            }
        }

        return Array.Empty<CoincidenciaTexto>();
    }

    private static void AgregarDePagina(Page pagina, string texto, List<CoincidenciaTexto> acumuladas)
    {
        var letras = pagina.Letters;
        if (letras.Count == 0)
        {
            return;
        }

        // Texto plano de la página y mapa de cada carácter a la letra que lo aportó:
        // así se reconstruye la caja aunque el marcador esté repartido entre letras.
        var constructor = new StringBuilder(letras.Count * 2);
        var mapa = new List<int>(letras.Count * 2);
        for (var indice = 0; indice < letras.Count; indice++)
        {
            var valor = letras[indice].Value ?? string.Empty;
            if (valor.Length == 0)
            {
                continue;
            }

            constructor.Append(valor);
            for (var caracter = 0; caracter < valor.Length; caracter++)
            {
                mapa.Add(indice);
            }
        }

        var contenido = constructor.ToString();
        if (contenido.Length == 0)
        {
            return;
        }

        var rotacion = pagina.Rotation.Value;
        var desde = 0;

        while (desde <= contenido.Length - texto.Length)
        {
            var posicion = contenido.IndexOf(texto, desde, StringComparison.OrdinalIgnoreCase);
            if (posicion < 0)
            {
                break;
            }

            var primera = mapa[posicion];
            var ultima = mapa[posicion + texto.Length - 1];
            if (TryCombinar(letras, primera, ultima, out var caja))
            {
                acumuladas.Add(new CoincidenciaTexto(
                    pagina.Number,
                    rotacion,
                    pagina.Width,
                    pagina.Height,
                    caja));
            }

            desde = posicion + Math.Max(1, texto.Length);
        }
    }

    private static bool TryCombinar(
        IReadOnlyList<Letter> letras,
        int primera,
        int ultima,
        out CajaContenido caja)
    {
        caja = default;

        var baseMinima = double.MaxValue;
        var baseMaxima = double.MinValue;
        var alturaBase14 = double.MinValue;
        var x0 = double.MaxValue;
        var y0 = double.MaxValue;
        var x1 = double.MinValue;
        var y1 = double.MinValue;

        for (var indice = primera; indice <= ultima; indice++)
        {
            var letra = letras[indice];
            baseMinima = Math.Min(baseMinima, letra.StartBaseLine.Y);
            baseMaxima = Math.Max(baseMaxima, letra.StartBaseLine.Y);

            // Las fuentes estándar se miden como lo hace MuPDF: su caja llega más
            // arriba que el rectángulo del glifo y la firma debe caer en el mismo sitio.
            if (letra.FontName is { Length: > 0 } nombreFuente
                && AscensosBase14.TryGetValue(nombreFuente, out var ascenso))
            {
                alturaBase14 = Math.Max(alturaBase14, letra.StartBaseLine.Y + (ascenso * letra.FontSize));
            }

            var rectangulo = letra.GlyphRectangleLoose;
            if (rectangulo.Width <= 0 || rectangulo.Height <= 0)
            {
                rectangulo = letra.BoundingBox;
            }

            if (rectangulo.Width <= 0 && rectangulo.Height <= 0)
            {
                continue;
            }

            x0 = Math.Min(x0, rectangulo.Left);
            y0 = Math.Min(y0, rectangulo.Bottom);
            x1 = Math.Max(x1, rectangulo.Right);
            y1 = Math.Max(y1, rectangulo.Top);
        }

        if (alturaBase14 > y1)
        {
            y1 = alturaBase14;
        }

        // Coincidencias que cruzan renglones: el script las descarta porque
        // search_for sólo encuentra texto dentro de una misma línea.
        if (baseMaxima - baseMinima > ToleranciaLinea || x1 <= x0 || y1 <= y0)
        {
            return false;
        }

        caja = new CajaContenido(x0, y0, x1, y1);
        return true;
    }
}
