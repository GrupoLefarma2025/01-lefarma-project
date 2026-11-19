using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace Lefarma.API.Features.Viaticos;

/// <summary>Plaza de cobro de una ruta, con su km desde el origen y la tarifa de automóvil.</summary>
public record CasetaRutaInfo(string Nombre, string Carretera, double KmDesdeOrigen, double TarifaAuto, string Direccion);

public static class EstadosCasetasRuta
{
    public const string Disponible = "disponible";
    public const string DestinoNoSoportado = "destino_no_soportado";
    public const string ProveedorNoDisponible = "proveedor_no_disponible";
    public const string RespuestaInvalida = "respuesta_invalida";
}

/// <summary>Official route data when available; null totals never mean official zero.</summary>
public record ResultadoCasetasRuta(
    string Estado,
    IReadOnlyList<CasetaRutaInfo> Casetas,
    double? KmTotal,
    string? TiempoTotal,
    double? PeajeTotal,
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

    public static Task<ResultadoCasetasRuta> ConsultarAsync(
        HttpClient http,
        string origenMunicipio,
        string origenEstado,
        string destinoMunicipio,
        string destinoEstado,
        CancellationToken ct) =>
        ConsultarAsync(http, origenMunicipio, origenEstado, destinoMunicipio, destinoEstado, TimeSpan.FromSeconds(20), ct);

    internal static async Task<ResultadoCasetasRuta> ConsultarAsync(
        HttpClient http,
        string origenMunicipio,
        string origenEstado,
        string destinoMunicipio,
        string destinoEstado,
        TimeSpan tiempoTotal,
        CancellationToken ct)
    {
        using var limiteTiempo = CancellationTokenSource.CreateLinkedTokenSource(ct);
        limiteTiempo.CancelAfter(tiempoTotal);
        var token = limiteTiempo.Token;
        var semaforoAdquirido = false;
        try
        {
            await Semaforo.WaitAsync(token);
            semaforoAdquirido = true;
            return await ConsultarInternoAsync(http, origenMunicipio, origenEstado, destinoMunicipio, destinoEstado, token);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException) when (limiteTiempo.IsCancellationRequested)
        {
            Serilog.Log.Warning("SCT: tiempo total de consulta agotado ({TiempoTotal}) {Origen} → {Destino}",
                tiempoTotal, origenMunicipio, destinoMunicipio);
            return SinOficial(EstadosCasetasRuta.ProveedorNoDisponible);
        }
        catch (Exception ex)
        {
            Serilog.Log.Warning("SCT: proveedor no disponible {Origen} → {Destino}: {Error}",
                origenMunicipio, destinoMunicipio, ex.Message);
            return SinOficial(EstadosCasetasRuta.ProveedorNoDisponible);
        }
        finally
        {
            if (semaforoAdquirido) Semaforo.Release();
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
        if (o.Length == 0 || d.Length == 0) return SinOficial(EstadosCasetasRuta.DestinoNoSoportado);

        var html = await GetAsync(http, $"{Base}?action=cmdEscogeRuta", ct);
        var estados = Opciones(html, "edoOrigen");
        if (estados.Count == 0)
        {
            Serilog.Log.Warning("SCT: catálogo inicial sin estados interpretables");
            return SinOficial(EstadosCasetasRuta.RespuestaInvalida);
        }

        var idEstadoOrigen = ResolverEstado(estados, origenEstado);
        var idEstadoDestino = ResolverEstado(estados, destinoEstado);
        if (idEstadoOrigen is null || idEstadoDestino is null)
        {
            Serilog.Log.Warning("SCT: no se resolvió el estado ({Origen} / {Destino})", origenEstado, destinoEstado);
            return SinOficial(EstadosCasetasRuta.DestinoNoSoportado);
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

        var ciudadesOrigen = Opciones(conCiudades, "ciudadOrigen");
        var ciudadesDestino = Opciones(conCiudades, "ciudadDestino");
        if (ciudadesOrigen.Count == 0 && ciudadesDestino.Count == 0)
        {
            Serilog.Log.Warning("SCT: catálogo de ciudades vacío o no interpretable");
            return SinOficial(EstadosCasetasRuta.RespuestaInvalida);
        }

        var idCiudadOrigen = ResolverCiudad(ciudadesOrigen, o);
        var idCiudadDestino = ResolverCiudad(ciudadesDestino, d);
        if (idCiudadOrigen is null || idCiudadDestino is null)
        {
            Serilog.Log.Warning("SCT: no se resolvió la ciudad ({Origen} / {Destino})", o, d);
            return SinOficial(EstadosCasetasRuta.DestinoNoSoportado);
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
    internal static ResultadoCasetasRuta ParsearRuta(string html)
    {
        foreach (Match tabla in Regex.Matches(html, "<table[^>]*>(.*?)</table>", RegexOptions.Singleline))
        {
            var contenido = tabla.Groups[1].Value;
            if (!contenido.Contains("Caseta o puente", StringComparison.OrdinalIgnoreCase)) continue;

            var filas = new List<List<string>>();
            foreach (Match fila in Regex.Matches(contenido, "(?s)<tr[^>]*>(.*?)</tr>"))
            {
                var celdas = ExpandirCeldas(fila);
                if (celdas.Count > 0) filas.Add(celdas);
            }

            var idxEncabezado = filas.FindIndex(f =>
                f.Any(c => c.Contains("Caseta o puente", StringComparison.OrdinalIgnoreCase))
                && f.Any(c => c.Contains("Carretera", StringComparison.OrdinalIgnoreCase)));
            if (idxEncabezado < 0) continue;

            var encabezado = filas[idxEncabezado];
            var colCarretera = encabezado.FindIndex(c => c.Contains("Carretera", StringComparison.OrdinalIgnoreCase));
            var colKm = encabezado.FindIndex(c => c.Contains("Long", StringComparison.OrdinalIgnoreCase));
            var colTiempo = encabezado.FindIndex(c => c.Contains("Tiempo", StringComparison.OrdinalIgnoreCase));
            var colCaseta = encabezado.FindIndex(c => c.Contains("Caseta o puente", StringComparison.OrdinalIgnoreCase));
            var colAuto = encabezado.FindIndex(c =>
                c.Contains("Autom", StringComparison.OrdinalIgnoreCase)
                && !c.Contains("remolque", StringComparison.OrdinalIgnoreCase)
                && !c.Contains("Pick", StringComparison.OrdinalIgnoreCase));
            if (colCarretera < 0 || colKm < 0 || colTiempo < 0 || colCaseta < 0 || colAuto < 0)
                return Invalida("encabezado de ruta incompleto");

            var casetas = new List<CasetaRutaInfo>();
            var kmAcumulado = 0d;
            var ultimaColumna = Math.Max(colAuto, Math.Max(colCaseta, Math.Max(colKm, colTiempo)));
            foreach (var fila in filas.Skip(idxEncabezado + 1))
            {
                if (fila.All(string.IsNullOrWhiteSpace)) continue;
                if (fila.Count <= ultimaColumna) return Invalida("fila con columnas insuficientes");

                if (fila.Any(c => c.StartsWith("Totales", StringComparison.OrdinalIgnoreCase)))
                {
                    if (!TryNumero(fila[colKm], out var kmTotal) || kmTotal < 0)
                        return Invalida($"distancia total inválida: {fila[colKm]}");
                    if (!TryNumero(fila[colAuto], out var peajeTotal) || peajeTotal < 0)
                        return Invalida($"peaje total inválido: {fila[colAuto]}");
                    var tiempoTotal = fila[colTiempo];
                    if (!Regex.IsMatch(tiempoTotal, @"^\d{1,3}:\d{2}$"))
                        return Invalida($"tiempo total inválido: {tiempoTotal}");
                    return new ResultadoCasetasRuta(
                        EstadosCasetasRuta.Disponible,
                        casetas,
                        kmTotal,
                        tiempoTotal,
                        peajeTotal,
                        "SCT · Rutas Punto a Punto");
                }

                if (!TryNumero(fila[colKm], out var largo) || largo < 0)
                    return Invalida($"longitud de tramo inválida: {fila[colKm]}");
                kmAcumulado += largo;
                var plaza = fila[colCaseta];
                if (plaza.Length == 0) continue;
                if (!TryNumero(fila[colAuto], out var tarifa) || tarifa < 0)
                    return Invalida($"tarifa inválida para {plaza}: {fila[colAuto]}");

                var tramo = fila[0];
                var carretera = fila[colCarretera];
                var direccion = tramo.Length > 0 ? $"{tramo} · {carretera}".Trim(' ', '·') : carretera;
                casetas.Add(new CasetaRutaInfo(plaza, carretera, Math.Round(kmAcumulado, 1), tarifa, direccion));
            }

            return Invalida("tabla de ruta sin fila de totales");
        }

        return Invalida("no se encontró una tabla de ruta interpretable");
    }

    private static List<string> ExpandirCeldas(Match fila)
    {
        var celdas = new List<string>();
        foreach (Match celda in Regex.Matches(fila.Groups[1].Value, "(?s)<t[dh]([^>]*)>(.*?)</t[dh]>"))
        {
            var atributos = celda.Groups[1].Value;
            var colspanMatch = Regex.Match(atributos, "(?:^|\\s)colspan\\s*=\\s*[\\\"']?(\\d+)", RegexOptions.IgnoreCase);
            var colspan = colspanMatch.Success && int.TryParse(colspanMatch.Groups[1].Value, out var n) && n > 0 ? n : 1;
            celdas.Add(Limpiar(Regex.Replace(celda.Groups[2].Value, "<[^>]+>", " ")));
            for (var i = 1; i < colspan; i++) celdas.Add(string.Empty);
        }
        return celdas;
    }

    private static bool TryNumero(string texto, out double valor)
    {
        valor = 0;
        var limpio = Limpiar(texto)
            .Replace("$", string.Empty, StringComparison.Ordinal)
            .Replace("MXN", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("km", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace(" ", string.Empty, StringComparison.Ordinal);
        if (limpio.Length == 0) return false;

        var coma = limpio.LastIndexOf(',');
        var punto = limpio.LastIndexOf('.');
        if (coma >= 0 && punto >= 0)
        {
            limpio = coma > punto
                ? limpio.Replace(".", string.Empty, StringComparison.Ordinal).Replace(',', '.')
                : limpio.Replace(",", string.Empty, StringComparison.Ordinal);
        }
        else if (coma >= 0)
        {
            var partes = limpio.Split(',');
            var miles = partes.Length > 2 || (partes.Length == 2 && partes[1].Length == 3);
            limpio = miles ? string.Join(string.Empty, partes) : string.Join(".", partes);
        }
        else if (punto >= 0 && limpio.Count(c => c == '.') > 1)
        {
            limpio = limpio.Replace(".", string.Empty, StringComparison.Ordinal);
        }

        return double.TryParse(limpio, NumberStyles.Number, CultureInfo.InvariantCulture, out valor)
            && double.IsFinite(valor);
    }

    private static ResultadoCasetasRuta Invalida(string detalle)
    {
        Serilog.Log.Warning("SCT: respuesta inválida: {Detalle}", detalle);
        return SinOficial(EstadosCasetasRuta.RespuestaInvalida);
    }

    private static ResultadoCasetasRuta SinOficial(string estado) =>
        new(estado, [], null, null, null, string.Empty);
}
