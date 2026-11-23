using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Lefarma.API.Domain.Entities.Viaticos;

namespace Lefarma.API.Features.Viaticos;

public static class TotalesCotizacion
{
    public const string TipoCotizado = "cotizado";
    public const string TipoEstimado = "estimado";
    public const string TipoReferenciaTabulador = "referencia_tabulador";

    public static (decimal? Cotizado, decimal? Estimado, decimal? Total) Calcular(
        IEnumerable<SolicitudOpcion> opciones) =>
        Calcular(opciones
            .Where(o => o.FueElegida)
            .Select(o => (o.Precio, o.DatosJson, o.Fuente)));

    public static (decimal? Cotizado, decimal? Estimado, decimal? Total) Calcular(
        IEnumerable<(decimal? Precio, string? DatosJson, string? Fuente)> opciones)
    {
        decimal? cotizado = null;
        decimal? estimado = null;

        foreach (var (precio, datosJson, fuente) in opciones)
        {
            if (EsCotizada(datosJson, fuente))
            {
                if (precio is { } valorReal) cotizado = (cotizado ?? 0m) + valorReal;
                continue;
            }

            var referencia = LeerPrecioEstimado(datosJson) ?? precio;
            if (referencia is { } valor) estimado = (estimado ?? 0m) + valor;
        }

        var total = cotizado is null && estimado is null
            ? (decimal?)null
            : (cotizado ?? 0m) + (estimado ?? 0m);
        return (cotizado, estimado, total);
    }

    public static List<SolicitudOpcion> VuelosSinPrecioReal(IEnumerable<SolicitudOpcion> opciones) =>
        opciones
            .Where(o => o.FueElegida
                        && VueloSinPrecioReal(o.Tipo, o.Precio, o.DatosJson, o.Fuente))
            .ToList();

    public static bool EsVuelo(string? tipo) =>
        NormalizarTipo(tipo) is "vuelo" or "avion";

    public static bool EsTipoDetectable(string? tipo) =>
        NormalizarTipo(tipo) is "vuelo" or "avion" or "autobus" or "hotel";

    public static string NormalizarTipo(string? tipo)
    {
        var descompuesto = (tipo ?? string.Empty).Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(descompuesto.Length);
        foreach (var caracter in descompuesto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(caracter) != UnicodeCategory.NonSpacingMark)
                builder.Append(caracter);
        }
        return builder.ToString();
    }

    public static bool VueloSinPrecioReal(
        string? tipo,
        decimal? precio,
        string? datosJson,
        string? fuente = null) =>
        EsVuelo(tipo) && (!EsCotizada(datosJson, fuente) || precio is null);

    public static bool EsCotizada(SolicitudOpcion opcion) =>
        EsCotizada(opcion.DatosJson, opcion.Fuente);

    public static bool EsCotizada(string? datosJson, string? fuente = null)
    {
        var tipo = LeerTipoPrecio(datosJson);
        if (tipo is not null) return string.Equals(tipo, TipoCotizado, StringComparison.OrdinalIgnoreCase);
        return !FuenteEsEstimada(fuente);
    }

    public static decimal? PrecioReferencia(SolicitudOpcion opcion)
    {
        var guardado = LeerPrecioEstimado(opcion.DatosJson);
        if (guardado is not null) return guardado;

        return opcion.Precio;
    }

    public static (decimal? Cotizado, decimal? Estimado, decimal? Total) LeerDeDatos(JsonElement? datos)
    {
        if (datos is not { ValueKind: JsonValueKind.Object } raiz) return (null, null, null);
        return (
            LeerDecimal(raiz, "total_cotizado"),
            LeerDecimal(raiz, "total_estimado"),
            LeerDecimal(raiz, "total"));
    }

    public static (decimal? Cotizado, decimal? Estimado, decimal? Total) LeerDeDatos(string? datosJson)
    {
        if (string.IsNullOrWhiteSpace(datosJson)) return (null, null, null);
        try
        {
            using var doc = JsonDocument.Parse(datosJson);
            return LeerDeDatos(doc.RootElement);
        }
        catch (JsonException)
        {
            return (null, null, null);
        }
    }

    public static string EscribirEnDatos(
        string? datosJson,
        decimal? cotizado,
        decimal? estimado,
        decimal? total)
    {
        var raiz = ParsearObjeto(datosJson);
        EscribirSplit(raiz, cotizado, estimado);
        raiz["total"] = total is null ? null : JsonValue.Create(total.Value);
        return raiz.ToJsonString();
    }

    public static string EscribirSplitEnDatos(
        string? datosJson,
        decimal? cotizado,
        decimal? estimado)
    {
        var raiz = ParsearObjeto(datosJson);
        EscribirSplit(raiz, cotizado, estimado);
        return raiz.ToJsonString();
    }

    private static void EscribirSplit(JsonObject raiz, decimal? cotizado, decimal? estimado)
    {
        raiz["total_cotizado"] = cotizado is null ? null : JsonValue.Create(cotizado.Value);
        raiz["total_estimado"] = estimado is null ? null : JsonValue.Create(estimado.Value);
    }

    public static string MarcarEstadoDeteccion(string? datosJson, string estado, string? mensaje = null)
    {
        var raiz = ParsearObjeto(datosJson);
        raiz["deteccion_estado"] = estado;
        raiz["deteccion_actualizada_en"] = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
        if (mensaje is null) raiz.Remove("deteccion_mensaje");
        else raiz["deteccion_mensaje"] = mensaje;
        return raiz.ToJsonString();
    }

    public static string MarcarAlcanceCaptura(string? datosJson, string? alcance)
    {
        if (string.IsNullOrWhiteSpace(alcance)) return datosJson ?? "{}";
        var raiz = ParsearObjeto(datosJson);
        raiz["captura_alcance"] = alcance;
        raiz["captura_alcance_en"] = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
        return raiz.ToJsonString();
    }

    public static string MarcarDeteccionGenerica(
        string? datosJson,
        PrecioDetectado elegido,
        IEnumerable<PrecioDetectado> opciones,
        string origen,
        DateTime ahora)
    {
        var raiz = ParsearObjeto(datosJson);
        raiz["detectado_por"] = elegido.Fuente ?? origen;
        raiz["deteccion_origen"] = origen;
        raiz["detectado_en"] = ahora.ToString("o", CultureInfo.InvariantCulture);
        raiz["deteccion_estado"] = "aplicado";
        if (!string.IsNullOrWhiteSpace(elegido.Detalle)) raiz["deteccion_detalle"] = elegido.Detalle;
        var lista = new JsonArray();
        foreach (var opcion in opciones.Take(5))
        {
            lista.Add(new JsonObject
            {
                ["tipo"] = opcion.Tipo,
                ["linea"] = opcion.Linea,
                ["precio"] = opcion.Precio,
                ["moneda"] = opcion.Moneda,
                ["fuente"] = opcion.Fuente,
                ["detalle"] = opcion.Detalle,
            });
        }
        raiz["opciones_detectadas"] = lista;
        return raiz.ToJsonString();
    }

    public static string MarcarPrecioReal(
        string? datosJson,
        string? salida,
        string? llegada,
        DateTime ahora,
        int idUsuario)
    {
        var raiz = ParsearObjeto(datosJson);
        raiz["tipo_precio"] = TipoCotizado;
        raiz["precio_real_capturado_en"] = ahora.ToString("o", CultureInfo.InvariantCulture);
        raiz["precio_real_capturado_por"] = idUsuario;
        if (!string.IsNullOrWhiteSpace(salida)) raiz["salida"] = salida.Trim();
        if (!string.IsNullOrWhiteSpace(llegada)) raiz["llegada"] = llegada.Trim();
        return raiz.ToJsonString();
    }

    private static JsonObject ParsearObjeto(string? datosJson)
    {
        if (!string.IsNullOrWhiteSpace(datosJson))
        {
            try
            {
                if (JsonNode.Parse(datosJson) is JsonObject objeto) return objeto;
            }
            catch (JsonException)
            {
            }
        }
        return new JsonObject();
    }

    private static string? LeerTipoPrecio(string? datosJson)
    {
        if (string.IsNullOrWhiteSpace(datosJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(datosJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object
                || !doc.RootElement.TryGetProperty("tipo_precio", out var tipo)
                || tipo.ValueKind != JsonValueKind.String)
            {
                return null;
            }
            var texto = tipo.GetString()?.Trim();
            return string.IsNullOrWhiteSpace(texto) ? null : texto;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static decimal? LeerPrecioEstimado(string? datosJson)
    {
        if (string.IsNullOrWhiteSpace(datosJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(datosJson);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                ? LeerDecimalTolerante(doc.RootElement, "precio_estimado")
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static decimal? LeerDecimal(JsonElement objeto, string clave)
    {
        if (!objeto.TryGetProperty(clave, out var valor)) return null;
        return valor.ValueKind == JsonValueKind.Number && valor.TryGetDecimal(out var numero)
            ? numero
            : null;
    }

    private static decimal? LeerDecimalTolerante(JsonElement objeto, string clave)
    {
        if (!objeto.TryGetProperty(clave, out var valor)) return null;
        if (valor.ValueKind == JsonValueKind.Number && valor.TryGetDecimal(out var numero)) return numero;
        if (valor.ValueKind == JsonValueKind.String
            && decimal.TryParse(valor.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var texto))
        {
            return texto;
        }
        return null;
    }

    private static bool FuenteEsEstimada(string? fuente) =>
        !string.IsNullOrWhiteSpace(fuente)
        && fuente.Contains("estimado", StringComparison.OrdinalIgnoreCase);
}
