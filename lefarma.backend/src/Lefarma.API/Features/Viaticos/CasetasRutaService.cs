using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace Lefarma.API.Features.Viaticos;

/// <summary>Plaza de cobro de una ruta, con su km desde el origen y la tarifa de automóvil.</summary>
public record CasetaRutaInfo(string Nombre, string Carretera, double KmDesdeOrigen, double TarifaAuto, string Direccion);

/// <summary>Resultado de la consulta de ruta: casetas, totales y la fuente de los datos.</summary>
public record ResultadoCasetasRuta(
    IReadOnlyList<CasetaRutaInfo> Casetas,
    double KmTotal,
    string TiempoTotal,
    double PeajeTotal,
    string Fuente);

/// <summary>
/// Rutas Punto a Punto de la SCT (Secretaría de Comunicaciones y Transportes):
/// el catálogo oficial con plaza de cobro, km desde el origen, carretera y tarifa
/// por tipo de vehículo. El sitio es un formulario clásico: se cargan los
/// estados, luego las ciudades y al final se consulta la ruta; se reproduce
/// aquí esa secuencia con POST de formulario.
///
/// Alternativas revisadas: tarifascapufe.com.mx publica una página por ruta
/// (WordPress, sin API general) y Reddit es contenido comunitario; la SCT
/// cubre cualquier par de ciudades con datos oficiales, por eso se usa.
/// </summary>
public static class CasetasRutaService
{
    private const string Base = "https://app.sct.gob.mx/sibuac_internet/ControllerUI";
    private const string VehiculoAuto = "2";

    /// <summary>Nombres de estado que no coinciden con los de la SCT.</summary>
    private static readonly Dictionary<string, string> AliasEstado = new(StringComparer.Ordinal)
    {
        ["ciudad de mexico"] = "distrito federal",
        ["cdmx"] = "distrito federal",
        ["mexico city"] = "distrito federal",
    };

    /// <summary>
    /// La SCT usa sesión (jsessionid) para la secuencia de formularios y el
    /// HttpClient comparte las cookies: las consultas se serializan.
    /// </summary>
    private static readonly SemaphoreSlim Semaforo = new(1, 1);

    public static async Task<ResultadoCasetasRuta> ConsultarAsync(
        HttpClient http,
        string origenMunicipio,
        string origenEstado,
        string destinoMunicipio,
        string destinoEstado,
        CancellationToken ct)
    {
        await Semaforo.WaitAsync(ct);
        try
        {
            return await ConsultarInternoAsync(http, origenMunicipio, origenEstado, destinoMunicipio, destinoEstado, ct);
        }
        finally
        {
            Semaforo.Release();
        }
    }

    private static async Task<ResultadoCasetasRuta> ConsultarInternoAsync(
        HttpClient http,
        string origenMunicipio,
        string origenEstado,
        string destinoMunicipio,
        string destinoEstado,
        CancellationToken ct)
    {
        var o = Normalizar(origenMunicipio);
        var d = Normalizar(destinoMunicipio);
        if (o.Length == 0 || d.Length == 0) return Vacio();

        var html = await GetAsync(http, $"{Base}?action=cmdEscogeRuta", ct);
        var estados = Opciones(html, "edoOrigen");
        var idEstadoOrigen = ResolverEstado(estados, origenEstado);
        var idEstadoDestino = ResolverEstado(estados, destinoEstado);
        if (idEstadoOrigen is null || idEstadoDestino is null)
        {
            Serilog.Log.Warning("SCT: no se resolvió el estado ({Origen} / {Destino})", origenEstado, destinoEstado);
            return Vacio();
        }

        var conCiudades = await PostAsync(http, Accion(html, "cmdEscogeRuta"), new Dictionary<string, string>
        {
            ["tipo"] = "1",
            ["edoOrigen"] = idEstadoOrigen,
            ["edoDestino"] = idEstadoDestino,
            ["ciudadOrigen"] = "",
            ["ciudadDestino"] = "",
            ["vehiculos"] = "",
            ["puntosIntermedios"] = "null",
            ["red"] = "simplificada",
            ["calculaRendimiento"] = "null",
        }, ct);

        var idCiudadOrigen = ResolverCiudad(Opciones(conCiudades, "ciudadOrigen"), o);
        var idCiudadDestino = ResolverCiudad(Opciones(conCiudades, "ciudadDestino"), d);
        if (idCiudadOrigen is null || idCiudadDestino is null)
        {
            Serilog.Log.Warning("SCT: no se resolvió la ciudad ({Origen} / {Destino})", o, d);
            return Vacio();
        }

        var resultado = await PostAsync(http, Accion(conCiudades, "cmdSolRutas"), new Dictionary<string, string>
        {
            ["tipo"] = "1",
            ["edoOrigen"] = idEstadoOrigen,
            ["edoDestino"] = idEstadoDestino,
            ["ciudadOrigen"] = idCiudadOrigen,
            ["ciudadDestino"] = idCiudadDestino,
            ["vehiculos"] = VehiculoAuto,
            ["puntosIntermedios"] = "null",
            ["red"] = "simplificada",
            ["calculaRendimiento"] = "null",
            ["cmdEnviar"] = "Consultar",
        }, ct);

        return ParsearRuta(resultado);
    }

    // ---------- HTTP ----------

    private static async Task<string> GetAsync(HttpClient http, string url, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.UserAgent.ParseAdd("GrupoLefarmaViaticos/1.0 (soporte@lefarma.com)");
        using var res = await http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadAsStringAsync(ct);
    }

    private static async Task<string> PostAsync(HttpClient http, string url, Dictionary<string, string> data, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new FormUrlEncodedContent(data),
        };
        req.Headers.UserAgent.ParseAdd("GrupoLefarmaViaticos/1.0 (soporte@lefarma.com)");
        using var res = await http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadAsStringAsync(ct);
    }

    /// <summary>Devuelve la acción del formulario (URL absoluta) con la de la SCT indicada.</summary>
    private static string Accion(string html, string accion)
    {
        var m = Regex.Match(html, "<form name=\"frmConsulta\"[^>]*action=\"([^\"]+)\"");
        if (!m.Success) return $"{Base}?action={accion}";
        var url = m.Groups[1].Value;
        if (!url.Contains(accion, StringComparison.Ordinal))
            url = url.Replace("cmdSolRutas", accion, StringComparison.Ordinal);
        if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = "https://app.sct.gob.mx" + url;
        return url;
    }

    // ---------- HTML ----------

    /// <summary>Opciones de un select: valor -> texto (sin acentos ni espacios extra).</summary>
    private static List<(string Valor, string Texto)> Opciones(string html, string nombre)
    {
        var m = Regex.Match(html, $"<select name=\"{Regex.Escape(nombre)}\"[^>]*>(.*?)</select>", RegexOptions.Singleline);
        if (!m.Success) return [];
        var lista = new List<(string, string)>();
        foreach (Match o in Regex.Matches(m.Groups[1].Value, "<option value=\"([^\"]*)\"[^>]*>([^<>]*)", RegexOptions.Singleline))
        {
            var texto = Limpiar(o.Groups[2].Value);
            if (texto.Length > 0) lista.Add((o.Groups[1].Value.Trim(), texto));
        }
        return lista;
    }

    private static string Limpiar(string valor)
    {
        var texto = WebUtility.HtmlDecode(valor).Replace('\u00a0', ' ').Replace("\r", " ").Replace("\n", " ");
        return string.Join(' ', texto.Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static string Normalizar(string valor)
    {
        var texto = Limpiar(valor).ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(texto.Length);
        foreach (var c in texto)
        {
            if (char.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(c)) sb.Append(c);
            else if (c == ' ') sb.Append(' ');
        }
        var plano = sb.ToString().Trim();
        plano = Regex.Replace(plano, @"\bcd\b", "ciudad");
        plano = Regex.Replace(plano, @"\s+", " ");
        return plano;
    }

    private static string? ResolverEstado(List<(string Valor, string Texto)> estados, string estado)
    {
        var objetivo = Normalizar(estado);
        if (objetivo.Length == 0) return null;
        if (AliasEstado.TryGetValue(objetivo, out var alias))
        {
            var porAlias = estados.FirstOrDefault(e => Normalizar(e.Texto) == alias);
            if (porAlias.Valor is not null) return porAlias.Valor;
        }
        var exacto = estados.FirstOrDefault(e => Normalizar(e.Texto) == objetivo);
        if (exacto.Valor is not null) return exacto.Valor;
        var parcial = estados.FirstOrDefault(e => Normalizar(e.Texto).Contains(objetivo, StringComparison.Ordinal));
        return parcial.Valor;
    }

    private static string? ResolverCiudad(List<(string Valor, string Texto)> ciudades, string ciudad)
    {
        if (ciudad.Length == 0) return null;
        var exacto = ciudades.FirstOrDefault(c => Normalizar(c.Texto) == ciudad);
        if (exacto.Valor is not null) return exacto.Valor;
        var parcial = ciudades.FirstOrDefault(c =>
        {
            var t = Normalizar(c.Texto);
            return t.Contains(ciudad, StringComparison.Ordinal) || ciudad.Contains(t, StringComparison.Ordinal);
        });
        if (parcial.Valor is not null) return parcial.Valor;
        // "Ciudad Victoria" vs "C. Victoria": se compara sin el prefijo.
        var nucleo = Nucleo(ciudad);
        var porNucleo = ciudades.FirstOrDefault(c => Nucleo(Normalizar(c.Texto)) == nucleo);
        return porNucleo.Valor;
    }

    /// <summary>Quita el prefijo de ciudad ("ciudad", "c.", "san") y el paréntesis.</summary>
    private static string Nucleo(string texto)
    {
        var t = Regex.Replace(texto, @"\(.*?\)", " ");
        t = Regex.Replace(t, @"^(ciudad|c|cd|san|santa|el|la|los|las)\s+", "");
        return Regex.Replace(t, @"\s+", " ").Trim();
    }

    /// <summary>Lee la tabla de la ruta: tramos con plaza de cobro, km y tarifa de auto.</summary>
    private static ResultadoCasetasRuta ParsearRuta(string html)
    {
        var casetas = new List<CasetaRutaInfo>();
        double kmTotal = 0;
        double peajeTotal = 0;
        var tiempoTotal = "";

        foreach (Match tabla in Regex.Matches(html, "<table[^>]*>(.*?)</table>", RegexOptions.Singleline))
        {
            var contenido = tabla.Groups[1].Value;
            if (!contenido.Contains("Caseta o puente", StringComparison.OrdinalIgnoreCase)) continue;

            var filas = new List<List<string>>();
            foreach (Match fila in Regex.Matches(contenido, "(?s)<tr[^>]*>(.*?)</tr>"))
            {
                var celdas = new List<string>();
                foreach (Match celda in Regex.Matches(fila.Groups[1].Value, "(?s)<t[dh][^>]*>(.*?)</t[dh]>"))
                    celdas.Add(Limpiar(Regex.Replace(celda.Groups[1].Value, "<[^>]+>", " ")));
                if (celdas.Count > 0) filas.Add(celdas);
            }
            if (filas.Count == 0) continue;

            // El encabezado es la fila que trae "Carretera" y "Caseta o puente";
            // antes puede haber filas de título.
            var idxEncabezado = filas.FindIndex(f =>
                f.Any(c => c.Contains("Caseta o puente", StringComparison.OrdinalIgnoreCase))
                && f.Any(c => c.Contains("Carretera", StringComparison.OrdinalIgnoreCase)));
            if (idxEncabezado < 0) continue;

            var encabezado = filas[idxEncabezado];
            var colNombre = 0;
            var colCarretera = Math.Max(0, encabezado.FindIndex(c => c.Contains("Carretera", StringComparison.OrdinalIgnoreCase)));
            var colKm = Math.Max(0, encabezado.FindIndex(c => c.Contains("Long", StringComparison.OrdinalIgnoreCase)));
            var colTiempo = Math.Max(0, encabezado.FindIndex(c => c.Contains("Tiempo", StringComparison.OrdinalIgnoreCase)));
            var colCaseta = Math.Max(0, encabezado.FindIndex(c => c.Contains("Caseta o puente", StringComparison.OrdinalIgnoreCase)));
            var colAuto = encabezado.FindIndex(c =>
                c.Contains("Autom", StringComparison.OrdinalIgnoreCase)
                && !c.Contains("remolque", StringComparison.OrdinalIgnoreCase)
                && !c.Contains("Pick", StringComparison.OrdinalIgnoreCase));
            if (colAuto < 0) colAuto = Math.Min(7, Math.Max(0, encabezado.Count - 1));

            var kmAcumulado = 0d;
            foreach (var fila in filas.Skip(idxEncabezado + 1))
            {
                if (fila.Count <= colCaseta) continue;
                var largo = fila.Count > colKm ? double.TryParse(fila[colKm], NumberStyles.Any, CultureInfo.InvariantCulture, out var km) ? km : 0 : 0;
                kmAcumulado += largo;
                if (fila[0].StartsWith("Totales", StringComparison.OrdinalIgnoreCase))
                {
                    kmTotal = largo;
                    tiempoTotal = fila.Count > colTiempo ? fila[colTiempo] : "";
                    peajeTotal = fila.Count > colAuto
                        && double.TryParse(fila[colAuto], NumberStyles.Any, CultureInfo.InvariantCulture, out var total) ? total : 0;
                    break;
                }
                var plaza = fila[colCaseta];
                if (plaza.Length == 0) continue;
                var tarifa = fila.Count > colAuto
                    && double.TryParse(fila[colAuto], NumberStyles.Any, CultureInfo.InvariantCulture, out var t) ? t : 0;
                var tramo = fila.Count > colNombre ? fila[colNombre] : "";
                var carretera = fila.Count > colCarretera ? fila[colCarretera] : "";
                var direccion = tramo.Length > 0 ? $"{tramo} · {carretera}".Trim(' ', '·') : carretera;
                casetas.Add(new CasetaRutaInfo(plaza, carretera, Math.Round(kmAcumulado, 1), tarifa, direccion));
            }
            break;
        }

        if (casetas.Count == 0) return Vacio();
        return new ResultadoCasetasRuta(casetas, kmTotal, tiempoTotal, peajeTotal, "SCT · Rutas Punto a Punto");
    }

    private static ResultadoCasetasRuta Vacio() =>
        new([], 0, "", 0, "");
}
