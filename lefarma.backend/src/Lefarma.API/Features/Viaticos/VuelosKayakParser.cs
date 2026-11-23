using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Lefarma.API.Features.Viaticos;

public sealed record VueloDetectado(
    string Aerolinea,
    TimeOnly Salida,
    TimeOnly Llegada,
    int DiasLlegada,
    decimal Precio,
    string Moneda,
    int? DuracionMin,
    string Escalas,
    bool Patrocinado,
    string? UrlCompra,
    string Texto);

public sealed class ResultadoParseoVuelos
{
    public bool Ok { get; init; }
    public string? Error { get; init; }
    public bool Bloqueado { get; init; }
    public List<VueloDetectado> Opciones { get; init; } = new();
}

public static partial class VuelosKayakParser
{
    private static readonly string[] Aerolineas =
    {
        "Aeromexico", "Aeroméxico", "Volaris", "Viva Aerobus", "VivaAerobus", "Viva",
        "American Airlines", "American", "United", "United Airlines", "Delta",
        "Southwest", "Spirit", "Frontier", "Alaska", "Alaska Airlines", "Copa",
        "Copa Airlines", "Avianca", "TAR", "Aeromar", "Mexicana", "Iberia",
        "Air France", "KLM", "LATAM", "JetBlue", "WestJet", "Air Canada",
        "Turkish Airlines", "Emirates", "Qatar Airways", "Hainan", "Wingo",
        "Sky Airline", "JetSmart", "Sun Country", "Hawaiian", "Aerolíneas Argentinas",
        "Magnicharters", "Señor Air", "Calafia Airlines",
    };

    private static readonly Regex Tiempos = new(
        @"(\d{1,2}):(\d{2})\s*(?:[–-]|a)\s*(\d{1,2}):(\d{2})(?:\s*\+(\d))?",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex Precio = new(
        @"\$\s*([\d,]+(?:\.\d{2})?)",
        RegexOptions.Compiled);

    private static readonly Regex Duracion = new(
        @"(\d+)\s*h\s*(\d+)\s*min",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex Bloqueo = new(
        @"verificaci[oó]n de seguridad|no soy un robot|captcha|are you a person or a robot|access denied|403 forbidden|tr[aá]fico inusual|unusual traffic",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex MarcaAutobus = new(
        @"primeraplus|primera plus|boleto de autob[uú]s|autob[uú]s\s*\$|0 cambios",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex MarcaAnuncio = new(
        @"\banuncio\b|\bpatrocinado\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex LinkCompra = new(
        @"URL:(https?://[^\s]+)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex Directo = new(
        @"\bdirecto\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex Escalas = new(
        @"(\d+)\s*escalas?",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static ResultadoParseoVuelos Parsear(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
        {
            return new ResultadoParseoVuelos { Ok = false, Error = "texto vacío" };
        }

        if (Bloqueo.IsMatch(texto))
        {
            return new ResultadoParseoVuelos
            {
                Ok = false,
                Bloqueado = true,
                Error = "Kayak pidió verificación de seguridad o bloqueó la consulta.",
            };
        }

        var limpio = Limpiar(texto);
        var bloques = Regex.Split(
            limpio,
            @"(?=(?:\b\d{1,2}:\d{2}\s*(?:[–-]|a)\s*\d{1,2}:\d{2})|(?:Boleto de autob[uú]s))",
            RegexOptions.IgnoreCase);

        var opciones = new List<VueloDetectado>();
        foreach (var bloque in bloques)
        {
            var vuelo = ParsearBloque(bloque);
            if (vuelo is not null) opciones.Add(vuelo);
        }

        var deduplicadas = opciones
            .GroupBy(o => (o.Salida, o.Llegada, o.Aerolinea, o.Precio))
            .Select(g => g.First())
            .OrderBy(o => o.Precio)
            .ThenBy(o => o.DuracionMin ?? int.MaxValue)
            .ToList();

        if (deduplicadas.Count == 0)
        {
            return new ResultadoParseoVuelos
            {
                Ok = false,
                Error = "no se reconocieron vuelos en la página",
            };
        }

        return new ResultadoParseoVuelos { Ok = true, Opciones = deduplicadas };
    }

    private static VueloDetectado? ParsearBloque(string bloque)
    {
        if (string.IsNullOrWhiteSpace(bloque)) return null;

        var tiempos = Tiempos.Match(bloque);
        if (!tiempos.Success) return null;

        var salida = new TimeOnly(
            int.Parse(tiempos.Groups[1].Value, CultureInfo.InvariantCulture),
            int.Parse(tiempos.Groups[2].Value, CultureInfo.InvariantCulture));
        var llegada = new TimeOnly(
            int.Parse(tiempos.Groups[3].Value, CultureInfo.InvariantCulture),
            int.Parse(tiempos.Groups[4].Value, CultureInfo.InvariantCulture));
        var dias = tiempos.Groups[5].Success
            ? int.Parse(tiempos.Groups[5].Value, CultureInfo.InvariantCulture)
            : 0;

        if (MarcaAutobus.IsMatch(bloque)) return null;

        var precioMatch = Precio.Match(bloque);
        if (!precioMatch.Success
            || !decimal.TryParse(
                precioMatch.Groups[1].Value.Replace(",", string.Empty, StringComparison.Ordinal),
                NumberStyles.Number,
                CultureInfo.InvariantCulture,
                out var precio)
            || precio <= 0)
        {
            return null;
        }

        var duracionMatch = Duracion.Match(bloque);
        int? duracion = duracionMatch.Success
            ? int.Parse(duracionMatch.Groups[1].Value, CultureInfo.InvariantCulture) * 60
              + int.Parse(duracionMatch.Groups[2].Value, CultureInfo.InvariantCulture)
            : null;

        var aerolinea = DetectarAerolinea(bloque);
        var esDirecto = Directo.IsMatch(bloque);
        var escalasMatch = Escalas.Match(bloque);
        if (aerolinea is null && !esDirecto && !escalasMatch.Success) return null;

        var escalas = esDirecto
            ? "Directo"
            : escalasMatch.Success
                ? $"{escalasMatch.Groups[1].Value} escala(s)"
                : string.Empty;

        var url = LinkCompra.Match(bloque);
        return new VueloDetectado(
            Aerolinea: aerolinea ?? "Aerolínea",
            Salida: salida,
            Llegada: llegada,
            DiasLlegada: dias,
            Precio: precio,
            Moneda: "MXN",
            DuracionMin: duracion,
            Escalas: escalas,
            Patrocinado: MarcaAnuncio.IsMatch(bloque),
            UrlCompra: url.Success ? url.Groups[1].Value.TrimEnd('.', ',', ')') : null,
            Texto: Recortar(bloque.Trim(), 600));
    }

    private static string? DetectarAerolinea(string bloque)
    {
        var normalizado = Normalizar(bloque);
        foreach (var aerolinea in Aerolineas)
        {
            if (normalizado.Contains(Normalizar(aerolinea), StringComparison.Ordinal))
                return aerolinea;
        }

        var despuesDuracion = Regex.Match(
            bloque,
            @"\d+\s*h\s*\d+\s*min\s+([A-Za-z][A-Za-z .&]{2,40}?)\s+(?:\$\{Price\}|Anuncio|\$|Incluye)",
            RegexOptions.IgnoreCase);
        return despuesDuracion.Success ? despuesDuracion.Groups[1].Value.Trim() : null;
    }

    private static string Limpiar(string texto)
    {
        var sinImagenes = Regex.Replace(texto, @"!\[[^\]]*\]\([^)]*\)", " ");
        var conLinks = Regex.Replace(
            sinImagenes,
            @"\[([^\]]+)\]\((https?://[^)]+)\)",
            "$1 URL:$2");
        return Regex.Replace(conLinks, @"\s+", " ").Trim();
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

    private static string Recortar(string texto, int maximo) =>
        texto.Length <= maximo ? texto : texto[..maximo];
}
