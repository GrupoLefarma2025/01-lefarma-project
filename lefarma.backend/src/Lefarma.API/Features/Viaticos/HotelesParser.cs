using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Lefarma.API.Features.Viaticos;

public static class HotelesParser
{
    private static readonly Regex Precio = new(
        @"(?:MXN|\$)\s*([\d,]+(?:\.\d{2})?)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static List<PrecioDetectado> Parsear(
        IEnumerable<string> tarjetas,
        string objetivo,
        int noches)
    {
        var nombreObjetivo = NombreHotel(objetivo);
        if (nombreObjetivo.Length < 3) return new List<PrecioDetectado>();

        var objetivoNorm = Normalizar(nombreObjetivo);
        var opciones = new List<PrecioDetectado>();

        foreach (var tarjeta in tarjetas)
        {
            var normal = Normalizar(tarjeta);
            if (!normal.Contains(objetivoNorm, StringComparison.Ordinal)) continue;

            var precioMatch = Precio.Match(tarjeta);
            if (!precioMatch.Success) continue;
            if (!decimal.TryParse(
                    precioMatch.Groups[1].Value.Replace(",", string.Empty, StringComparison.Ordinal),
                    NumberStyles.Number,
                    CultureInfo.InvariantCulture,
                    out var valor)
                || valor <= 0)
            {
                continue;
            }

            var esTotal = Regex.IsMatch(tarjeta, @"\btotal\b|\bestancia\b|\bpor\s+la\s+estancia\b", RegexOptions.IgnoreCase);
            var nochesEfectivas = noches < 1 ? 1 : noches;
            var total = esTotal ? valor : valor * nochesEfectivas;
            var detalle = esTotal
                ? "Total de la estancia publicado por Google Hotels"
                : $"Precio por noche x {nochesEfectivas} noche(s)";

            opciones.Add(new PrecioDetectado(
                Tipo: "hotel",
                Linea: objetivo,
                Precio: Math.Round(total, 2),
                Moneda: "MXN",
                Fuente: "google.com/travel",
                UrlCompra: null,
                Detalle: detalle,
                Noches: nochesEfectivas));
        }

        return opciones
            .GroupBy(o => (o.Linea, o.Precio))
            .Select(g => g.First())
            .OrderBy(o => o.Precio)
            .Take(5)
            .ToList();
    }

    public static List<PrecioDetectado> ParsearMarkdown(
        string markdown,
        string objetivo,
        int noches)
    {
        var nombreObjetivo = NombreHotel(objetivo);
        if (nombreObjetivo.Length < 3) return new List<PrecioDetectado>();

        var objetivoNorm = Normalizar(nombreObjetivo);
        var lineas = markdown
            .Split('\n', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Where(l => !l.StartsWith('|') && !l.StartsWith('#'))
            .ToList();
        var opciones = new List<PrecioDetectado>();
        var nochesEfectivas = noches < 1 ? 1 : noches;

        for (var i = 0; i < lineas.Count; i++)
        {
            if (!lineas[i].StartsWith("MXN", StringComparison.OrdinalIgnoreCase)
                && !lineas[i].StartsWith('$'))
            {
                continue;
            }

            string? nombre = null;
            for (var j = i - 1; j >= 0 && j >= i - 4; j--)
            {
                var texto = lineas[j].Trim();
                if (texto.Length is < 3 or > 150) continue;
                if (texto.StartsWith('!')
                    || texto.StartsWith('#')
                    || texto.StartsWith('|')
                    || texto.Contains('$')
                    || texto.StartsWith("MXN", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                nombre = texto;
                break;
            }
            if (nombre is null || !Normalizar(nombre).Contains(objetivoNorm, StringComparison.Ordinal)) continue;

            var precioMatch = Precio.Match(lineas[i]);
            if (!precioMatch.Success) continue;
            if (!decimal.TryParse(
                    precioMatch.Groups[1].Value.Replace(",", string.Empty, StringComparison.Ordinal),
                    NumberStyles.Number,
                    CultureInfo.InvariantCulture,
                    out var valor)
                || valor <= 0)
            {
                continue;
            }

            var contexto = string.Join(' ', lineas.Skip(i).Take(3));
            var esTotal = Regex.IsMatch(contexto, @"\btotal\b|\bestancia\b", RegexOptions.IgnoreCase);
            var total = esTotal ? valor : valor * nochesEfectivas;
            opciones.Add(new PrecioDetectado(
                Tipo: "hotel",
                Linea: objetivo,
                Precio: Math.Round(total, 2),
                Moneda: "MXN",
                Fuente: "google.com/travel",
                UrlCompra: null,
                Detalle: esTotal
                    ? "Total de la estancia publicado por Google Hotels"
                    : $"Precio por noche x {nochesEfectivas} noche(s)",
                Noches: nochesEfectivas));
        }

        if (opciones.Count == 0)
        {
            for (var i = 0; i < lineas.Count; i++)
            {
                if (!Normalizar(lineas[i]).Contains(objetivoNorm, StringComparison.Ordinal)) continue;
                var precioMatch = Precio.Match(lineas[i]);
                if (!precioMatch.Success) continue;
                if (!decimal.TryParse(
                        precioMatch.Groups[1].Value.Replace(",", string.Empty, StringComparison.Ordinal),
                        NumberStyles.Number,
                        CultureInfo.InvariantCulture,
                        out var valor)
                    || valor <= 0)
                {
                    continue;
                }

                var contexto = string.Join(' ', lineas.Skip(i).Take(3));
                var esTotal = Regex.IsMatch(contexto, @"\btotal\b|\bestancia\b", RegexOptions.IgnoreCase);
                var total = esTotal ? valor : valor * nochesEfectivas;
                opciones.Add(new PrecioDetectado(
                    Tipo: "hotel",
                    Linea: objetivo,
                    Precio: Math.Round(total, 2),
                    Moneda: "MXN",
                    Fuente: "google.com/travel",
                    UrlCompra: null,
                    Detalle: esTotal
                        ? "Total de la estancia publicado por Google Hotels"
                        : $"Precio por noche x {nochesEfectivas} noche(s)",
                    Noches: nochesEfectivas));
            }
        }

        return opciones
            .GroupBy(o => (o.Linea, o.Precio))
            .Select(g => g.First())
            .OrderBy(o => o.Precio)
            .Take(5)
            .ToList();
    }

    private static string NombreHotel(string linea)
    {
        var corte = linea.IndexOf(" (", StringComparison.Ordinal);
        return (corte > 0 ? linea[..corte] : linea).Trim();
    }

    private static string Normalizar(string texto)
    {
        var descompuesto = texto.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(descompuesto.Length);
        foreach (var caracter in descompuesto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(caracter) != UnicodeCategory.NonSpacingMark)
                builder.Append(char.ToLowerInvariant(caracter));
        }
        return Regex.Replace(builder.ToString(), @"[^a-z0-9 ]", " ");
    }
}
