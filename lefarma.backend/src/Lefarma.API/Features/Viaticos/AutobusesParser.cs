using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Parser de autobuses para ClickBus/Primera Plus. Reutiliza los patrones del
/// cotizador CLI; si una tarjeta no trae el formato exacto, aplica un bloque
/// genérico de horas + precio. No inventa precios: una tarjeta sin precio se
/// descarta.
/// </summary>
public static class AutobusesParser
{
    private static readonly Regex ClickBus = new(
        @"^(.+?)\s+(\d{2}:\d{2})\s+hrs\.\s+(.*?)\s+Tipo:\s*(Local|Paso)\s+(\d+h(?:\s*\d+m)?)\s+(\d{2}:\d{2})\s+hrs\.\s+(.*?)\s+\$([\d,.]+)(?:\s+\$([\d,.]+))?\s+Seleccionar\s+(\d+)\s+Asientos disponibles",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex Horas = new(
        @"(\d{1,2}:\d{2})\s*(?:hrs\.?|–|-|a)\s*(\d{1,2}:\d{2})",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex Precio = new(
        @"\$([\d,.]+)",
        RegexOptions.Compiled);

    private static readonly string[] Lineas =
    {
        "Primera Plus", "Futura", "ETN", "ADO", "Omnibus", "Ómnibus", "Estrella Roja",
        "Autovías", "Caminante", "TMT", "Turistar", "Diamante", "Ejecutivo", "Flecha Amarilla",
        "Herradura", "Chihuahuenses", "Senda", "Costa Line", "Elite", "Pegasso",
    };

    public static List<PrecioDetectado> Parsear(
        IEnumerable<string> tarjetas,
        string objetivo,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi)
    {
        var opciones = new List<PrecioDetectado>();
        foreach (var tarjeta in tarjetas)
        {
            var clickbus = ClickBus.Match(tarjeta);
            if (clickbus.Success)
            {
                var precioTexto = clickbus.Groups[9].Success
                    ? clickbus.Groups[9].Value
                    : clickbus.Groups[8].Value;
                var precio = ADecimal(precioTexto);
                if (precio is null or <= 0) continue;

                opciones.Add(new PrecioDetectado(
                    Tipo: "autobus",
                    Linea: $"{clickbus.Groups[1].Value.Trim()} {clickbus.Groups[2].Value}–{clickbus.Groups[6].Value}",
                    Precio: precio.Value,
                    Moneda: "MXN",
                    Fuente: "clickbus.com.mx",
                    UrlCompra: null,
                    Detalle: $"Tipo {clickbus.Groups[4].Value} · {clickbus.Groups[5].Value}",
                    Fecha: fecha,
                    Salida: ATime(clickbus.Groups[2].Value),
                    Llegada: ATime(clickbus.Groups[6].Value),
                    Asientos: int.TryParse(clickbus.Groups[10].Value, out var asientos) ? asientos : null));
                continue;
            }

            var horas = Horas.Match(tarjeta);
            if (!horas.Success) continue;
            var precioMatch = Precio.Match(tarjeta);
            if (!precioMatch.Success) continue;
            var valor = ADecimal(precioMatch.Groups[1].Value);
            if (valor is null or <= 0) continue;

            var linea = DetectarLinea(tarjeta);
            if (string.IsNullOrWhiteSpace(linea)) continue;

            opciones.Add(new PrecioDetectado(
                Tipo: "autobus",
                Linea: $"{linea} {horas.Groups[1].Value}–{horas.Groups[2].Value}",
                Precio: valor.Value,
                Moneda: "MXN",
                Fuente: "autobus (página)",
                UrlCompra: null,
                Detalle: Recortar(tarjeta, 220),
                Fecha: fecha,
                Salida: ATime(horas.Groups[1].Value),
                Llegada: ATime(horas.Groups[2].Value)));
        }

        var deduplicadas = opciones
            .GroupBy(o => (o.Linea, o.Precio))
            .Select(g => g.First())
            .ToList();
        return Seleccionar(deduplicadas, objetivo, fecha, deadline, minutosTaxi);
    }

    /// <summary>
    /// Variante para el markdown de Firecrawl: ClickBus publica cada campo en
    /// su propia línea (compañía, hora de salida, tipo, duración, hora de
    /// llegada y precio). Se reconstruye la tarjeta y se aplica el mismo filtro
    /// por horario que la variante de Playwright.
    /// </summary>
    public static List<PrecioDetectado> ParsearMarkdown(
        string markdown,
        string objetivo,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi)
    {
        var lineas = markdown
            .Split('\n', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Where(l => !l.StartsWith("![", StringComparison.Ordinal)
                        && !l.StartsWith("[", StringComparison.Ordinal))
            .ToList();
        var opciones = new List<PrecioDetectado>();

        for (var i = 0; i < lineas.Count; i++)
        {
            var precioMatch = Regex.Match(lineas[i], @"^\$([\d,.]+)");
            if (!precioMatch.Success) continue;
            var precio = ADecimal(precioMatch.Groups[1].Value);
            if (precio is null or <= 0) continue;

            var tiempos = new List<(int Indice, TimeOnly Hora)>();
            for (var j = i - 1; j >= 0 && tiempos.Count < 2; j--)
            {
                var hora = Regex.Match(lineas[j], @"^#{1,6}\s*(\d{1,2}:\d{2})\s*hrs");
                if (hora.Success && ATime(hora.Groups[1].Value) is { } valorHora)
                    tiempos.Insert(0, (j, valorHora));
            }
            if (tiempos.Count < 2) continue;

            var linea = DetectarLineaCercana(lineas, tiempos[0].Indice);
            if (string.IsNullOrWhiteSpace(linea)) continue;

            var tipo = "";
            for (var j = tiempos[0].Indice + 1; j < tiempos[1].Indice; j++)
            {
                var tipoMatch = Regex.Match(lineas[j], @"Tipo:\s*(Local|Paso)", RegexOptions.IgnoreCase);
                if (tipoMatch.Success)
                {
                    tipo = tipoMatch.Groups[1].Value;
                    break;
                }
            }

            int? asientos = null;
            for (var j = i + 1; j < Math.Min(lineas.Count, i + 4); j++)
            {
                var asientosMatch = Regex.Match(lineas[j], @"(\d+)\s+Asientos disponibles", RegexOptions.IgnoreCase);
                if (asientosMatch.Success)
                {
                    asientos = int.Parse(asientosMatch.Groups[1].Value, CultureInfo.InvariantCulture);
                    break;
                }
            }

            opciones.Add(new PrecioDetectado(
                Tipo: "autobus",
                Linea: $"{linea} {tiempos[0].Hora:HH\\:mm}–{tiempos[1].Hora:HH\\:mm}",
                Precio: precio.Value,
                Moneda: "MXN",
                Fuente: "clickbus.com.mx",
                UrlCompra: null,
                Detalle: string.IsNullOrWhiteSpace(tipo) ? "ClickBus" : $"Tipo {tipo}",
                Fecha: fecha,
                Salida: tiempos[0].Hora,
                Llegada: tiempos[1].Hora,
                Asientos: asientos));
        }

        var deduplicadas = opciones
            .GroupBy(o => (o.Linea, o.Precio))
            .Select(g => g.First())
            .ToList();
        return Seleccionar(deduplicadas, objetivo, fecha, deadline, minutosTaxi);
    }

    private static List<PrecioDetectado> Seleccionar(
        List<PrecioDetectado> opciones,
        string objetivo,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi)
    {
        if (opciones.Count == 0) return opciones;

        var objetivoNorm = Normalizar(objetivo);
        var coincidencias = opciones
            .Where(o => objetivoNorm.Length > 0
                        && Normalizar(o.Linea).Contains(objetivoNorm, StringComparison.Ordinal))
            .ToList();
        var pool = coincidencias.Count > 0 ? coincidencias : opciones;

        if (deadline is not null)
        {
            var aTiempo = pool
                .Where(o => o.Llegada is not null)
                .Select(o => new
                {
                    Oferta = o,
                    Llegada = fecha.ToDateTime(o.Llegada!.Value)
                        .AddDays(o.Salida is not null && o.Llegada.Value < o.Salida.Value ? 1 : 0)
                        .AddMinutes(minutosTaxi),
                })
                .Where(x => x.Llegada <= deadline.Value)
                .OrderBy(x => x.Oferta.Precio)
                .ToList();
            if (aTiempo.Count == 0) return new List<PrecioDetectado>();
            return aTiempo.Select(x => x.Oferta).Take(10).ToList();
        }

        return pool.OrderBy(o => o.Precio).Take(10).ToList();
    }

    private static string? DetectarLineaCercana(List<string> lineas, int indiceHora)
    {
        string? candidata = null;
        for (var j = indiceHora - 1; j >= 0 && j >= indiceHora - 4; j--)
        {
            var texto = lineas[j].Trim();
            if (texto.Length < 3
                || texto.StartsWith('#')
                || texto.StartsWith('!')
                || texto.StartsWith("**", StringComparison.Ordinal)
                || texto.Contains('$'))
            {
                continue;
            }

            if (DetectarLinea(texto) is not null) return texto;
            candidata ??= texto;
        }
        return candidata;
    }

    private static string? DetectarLinea(string texto)
    {
        var normal = Normalizar(texto);
        return Lineas.FirstOrDefault(l => normal.Contains(Normalizar(l), StringComparison.Ordinal));
    }

    private static decimal? ADecimal(string texto)
    {
        var limpio = texto.Replace(",", string.Empty, StringComparison.Ordinal).Trim();
        return decimal.TryParse(limpio, NumberStyles.Number, CultureInfo.InvariantCulture, out var valor)
            ? valor
            : null;
    }

    private static TimeOnly? ATime(string texto) =>
        TimeOnly.TryParseExact(texto.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var hora)
            ? hora
            : null;

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

    private static string Recortar(string texto, int maximo) =>
        texto.Length <= maximo ? texto : texto[..maximo];
}
