using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Los enlaces <c>/book/flight</c> de Kayak pertenecen a una sesión de búsqueda
/// y caducan en minutos: al abrirlos después, Kayak responde "los resultados
/// caducaron". Para guardar y mostrar se usa la búsqueda estable de la ruta y
/// la fecha (el mismo formato que ya genera el cálculo de respaldo).
///
/// La conversión se hace al leer el detalle para que también corrija opciones
/// viejas que ya quedaron con un enlace efímero en la base.
/// </summary>
public static class EnlacesCompra
{
    private const string KayakBusqueda = "https://www.kayak.com.mx/flights";

    public static bool EsEnlaceKayakEfimero(string? url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;
        return uri.Host.Contains("kayak", StringComparison.OrdinalIgnoreCase)
            && uri.AbsolutePath.StartsWith("/book/flight", StringComparison.OrdinalIgnoreCase);
    }

    public static bool EsBusquedaKayak(string? url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;
        return uri.Host.Contains("kayak", StringComparison.OrdinalIgnoreCase)
            && uri.AbsolutePath.StartsWith("/flights", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Devuelve el enlace estable de búsqueda cuando <paramref name="url"/> es
    /// un enlace efímero de Kayak. Si no hay ruta/fecha suficiente, conserva el
    /// enlace original en lugar de inventar una búsqueda equivocada.
    /// </summary>
    public static string? Canonicalizar(
        string? url,
        JsonElement? datosSolicitud,
        string? datosOpcionJson)
    {
        if (!EsEnlaceKayakEfimero(url)
            || datosSolicitud is null
            || datosSolicitud.Value.ValueKind != JsonValueKind.Object)
        {
            return url;
        }

        var (tramo, de, a) = LeerOpcion(datosOpcionJson);
        var (origen, destino, fecha) = LeerContexto(datosSolicitud.Value, tramo, de, a);
        return ConstruirBusqueda(origen, destino, fecha) ?? url;
    }

    /// <summary>
    /// Reemplaza en el snapshot los enlaces efímeros que ya tienen una versión
    /// estable calculada por opción. Se recorre todo el JSON para alcanzar
    /// <c>calculo.ruta.nodos</c>, <c>calculo.tramos</c> y las opciones
    /// originales guardadas por el concentrado.
    /// </summary>
    public static JsonElement? ReemplazarEnlaces(
        JsonElement? datos,
        IReadOnlyDictionary<string, string> reemplazos)
    {
        if (datos is null
            || datos.Value.ValueKind != JsonValueKind.Object
            || reemplazos.Count == 0)
        {
            return datos;
        }

        JsonNode? nodo;
        try
        {
            nodo = JsonNode.Parse(datos.Value.GetRawText());
        }
        catch (JsonException)
        {
            return datos;
        }
        if (nodo is null) return datos;

        var cambio = false;
        Reemplazar(nodo, reemplazos, ref cambio);
        return cambio ? JsonSerializer.SerializeToElement(nodo) : datos;
    }

    private static string? ConstruirBusqueda(string? origen, string? destino, DateOnly? fecha)
    {
        if (fecha is null) return null;
        var iataOrigen = CalculoCostosRuta.IataDeCiudad(origen);
        var iataDestino = CalculoCostosRuta.IataDeCiudad(destino);
        if (iataOrigen is null || iataDestino is null || iataOrigen == iataDestino)
            return null;
        return $"{KayakBusqueda}/{iataOrigen}-{iataDestino}/{fecha.Value:yyyy-MM-dd}"
            + "?sort=bestflight_a&fs=cabin=e";
    }

    private static (int Tramo, string? De, string? A) LeerOpcion(string? datosOpcionJson)
    {
        if (string.IsNullOrWhiteSpace(datosOpcionJson)) return (0, null, null);
        try
        {
            using var doc = JsonDocument.Parse(datosOpcionJson);
            var raiz = doc.RootElement;
            if (raiz.ValueKind != JsonValueKind.Object) return (0, null, null);
            var tramo = 0;
            if (raiz.TryGetProperty("tramo", out var tramoEl)
                && tramoEl.ValueKind == JsonValueKind.Number
                && tramoEl.TryGetInt32(out var numero)
                && numero >= 0)
            {
                tramo = numero;
            }
            return (tramo, Texto(raiz, "de"), Texto(raiz, "a"));
        }
        catch (JsonException)
        {
            return (0, null, null);
        }
    }

    private static (string? Origen, string? Destino, DateOnly? Fecha) LeerContexto(
        JsonElement datos,
        int tramo,
        string? deOpcion,
        string? aOpcion)
    {
        string? origen = deOpcion;
        string? destino = aOpcion;
        DateOnly? fecha = null;

        if (datos.TryGetProperty("calculo", out var calculo)
            && calculo.ValueKind == JsonValueKind.Object
            && calculo.TryGetProperty("tramos", out var tramos)
            && tramos.ValueKind == JsonValueKind.Array
            && tramo < tramos.GetArrayLength())
        {
            var tramoCalculado = tramos[tramo];
            origen ??= Texto(tramoCalculado, "de");
            destino ??= Texto(tramoCalculado, "a");
            fecha = Fecha(tramoCalculado, "salida_fecha");
        }

        string? origenCiudad = null;
        if (datos.TryGetProperty("origen", out var origenEl))
            origenCiudad = LeerPunto(origenEl);

        string? destinoCiudad = null;
        if (datos.TryGetProperty("destinos", out var destinos)
            && destinos.ValueKind == JsonValueKind.Array
            && destinos.GetArrayLength() > 0)
        {
            var indice = Math.Clamp(tramo, 0, destinos.GetArrayLength() - 1);
            destinoCiudad = LeerPunto(destinos[indice]);
        }

        origen ??= tramo == 0 ? origenCiudad : destinoCiudad;
        destino ??= tramo == 0 ? destinoCiudad : origenCiudad;
        // El tramo de regreso del cálculo se llama "Regreso al origen": el
        // destino real es la ciudad de salida.
        if (EsRegreso(destino)) destino = origenCiudad;

        fecha ??= tramo == 0
            ? FechaPrimerDestino(datos) ?? FechaRango(datos, "inicio")
            : FechaRetorno(datos) ?? FechaRango(datos, "fin") ?? FechaPrimerDestino(datos);

        return (origen, destino, fecha);
    }

    private static string? LeerPunto(JsonElement contenedor)
    {
        if (contenedor.ValueKind != JsonValueKind.Object) return null;
        if (contenedor.TryGetProperty("punto", out var punto)
            && punto.ValueKind == JsonValueKind.Object)
        {
            return Texto(punto, "municipio") ?? Texto(punto, "nombre");
        }
        return Texto(contenedor, "municipio") ?? Texto(contenedor, "nombre");
    }

    private static DateOnly? FechaPrimerDestino(JsonElement datos)
    {
        if (!datos.TryGetProperty("destinos", out var destinos)
            || destinos.ValueKind != JsonValueKind.Array
            || destinos.GetArrayLength() == 0)
        {
            return null;
        }
        return Fecha(destinos[0], "debeEstarFecha");
    }

    private static DateOnly? FechaRetorno(JsonElement datos)
    {
        if (datos.TryGetProperty("retorno", out var retorno)
            && retorno.ValueKind == JsonValueKind.Object)
        {
            var fecha = Fecha(retorno, "llegadaRequeridaFecha");
            if (fecha is not null) return fecha;
        }

        if (datos.TryGetProperty("destinos", out var destinos)
            && destinos.ValueKind == JsonValueKind.Array)
        {
            for (var i = destinos.GetArrayLength() - 1; i >= 0; i--)
            {
                var fecha = Fecha(destinos[i], "saleFecha");
                if (fecha is not null) return fecha;
            }
        }
        return null;
    }

    private static DateOnly? FechaRango(JsonElement datos, string clave)
    {
        if (!datos.TryGetProperty("rango", out var rango) || rango.ValueKind != JsonValueKind.Object)
            return null;
        return Fecha(rango, clave);
    }

    private static DateOnly? Fecha(JsonElement objeto, string clave)
    {
        var texto = Texto(objeto, clave);
        if (string.IsNullOrWhiteSpace(texto)) return null;
        return DateOnly.TryParseExact(
            texto,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var fecha)
            ? fecha
            : null;
    }

    private static string? Texto(JsonElement objeto, string clave)
    {
        return objeto.TryGetProperty(clave, out var valor)
            && valor.ValueKind == JsonValueKind.String
            && !string.IsNullOrWhiteSpace(valor.GetString())
            ? valor.GetString()!.Trim()
            : null;
    }

    private static bool EsRegreso(string? destino)
    {
        return !string.IsNullOrWhiteSpace(destino)
            && (destino.Contains("regreso", StringComparison.OrdinalIgnoreCase)
                || destino.Contains("origen", StringComparison.OrdinalIgnoreCase));
    }

    private static void Reemplazar(
        JsonNode nodo,
        IReadOnlyDictionary<string, string> reemplazos,
        ref bool cambio)
    {
        if (nodo is JsonObject objeto)
        {
            foreach (var clave in objeto.Select(par => par.Key).ToList())
            {
                var valor = objeto[clave];
                if (clave.Equals("url_compra", StringComparison.OrdinalIgnoreCase)
                    && valor is JsonValue valorJson
                    && valorJson.TryGetValue<string>(out var url)
                    && reemplazos.TryGetValue(url, out var nuevo))
                {
                    objeto[clave] = nuevo;
                    cambio = true;
                }
                else if (valor is not null)
                {
                    Reemplazar(valor, reemplazos, ref cambio);
                }
            }
        }
        else if (nodo is JsonArray arreglo)
        {
            foreach (var item in arreglo)
            {
                if (item is not null) Reemplazar(item, reemplazos, ref cambio);
            }
        }
    }
}
