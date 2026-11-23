using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Lefarma.API.Domain.Entities.Viaticos;

namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Reglas de precio de una cotizacion de viaticos.
///
/// <c>precio</c> es SIEMPRE el precio real de la pagina o proveedor. Un
/// estimado del motor (formula de vuelo, tarifa de taxi, tabulador de hotel)
/// no es un precio cotizado: su valor vive en <c>datos.precio_estimado</c> y
/// se suma aparte para mostrarse como referencia. La autorizacion solo puede
/// usar el total cotizado; el vuelo elegido que siga sin precio real bloquea
/// la autorizacion (ver <c>AprobacionesController</c>).
/// </summary>
public static class TotalesCotizacion
{
    public const string TipoCotizado = "cotizado";
    public const string TipoEstimado = "estimado";
    public const string TipoReferenciaTabulador = "referencia_tabulador";

    /// <summary>
    /// Suma de las opciones ELEGIDAS. <c>cotizado</c> solo cuenta precios
    /// reales; <c>estimado</c> cuenta la referencia. Las opciones sin importe
    /// quedan fuera: no se inventa un cero.
    /// </summary>
    public static (decimal? Cotizado, decimal? Estimado, decimal? Total) Calcular(
        IEnumerable<SolicitudOpcion> opciones) =>
        Calcular(opciones
            .Where(o => o.FueElegida)
            .Select(o => (o.Precio, o.DatosJson, o.Fuente)));

    /// <summary>
    /// Misma regla sobre una proyeccion (bandeja): se usa cuando las opciones
    /// ya vienen filtradas por <c>fue_elegida</c>.
    /// </summary>
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

    /// <summary>
    /// Vuelos elegidos que aun no tienen precio real. Se calcula sobre la
    /// version que se va a autorizar (opciones nuevas o las vigentes).
    /// </summary>
    public static List<SolicitudOpcion> VuelosSinPrecioReal(IEnumerable<SolicitudOpcion> opciones) =>
        opciones
            .Where(o => o.FueElegida
                        && VueloSinPrecioReal(o.Tipo, o.Precio, o.DatosJson, o.Fuente))
            .ToList();

    public static bool EsVuelo(string? tipo) =>
        NormalizarTipo(tipo) is "vuelo" or "avion";

    /// <summary>Tipo con detección automática de precio: vuelo, autobús u hotel.</summary>
    public static bool EsTipoDetectable(string? tipo) =>
        NormalizarTipo(tipo) is "vuelo" or "avion" or "autobus" or "hotel";

    /// <summary>
    /// Tipo en minúsculas y sin acentos, para comparar "Autobús"/"autobus" y
    /// "Avión"/"avion" sin depender de cómo lo escribió el proveedor.
    /// </summary>
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

    /// <summary>
    /// Vuelo elegido que no puede autorizarse: no es cotizado o le falta el
    /// importe real. Se usa tanto en la entidad como en las proyecciones.
    /// </summary>
    public static bool VueloSinPrecioReal(
        string? tipo,
        decimal? precio,
        string? datosJson,
        string? fuente = null) =>
        EsVuelo(tipo) && (!EsCotizada(datosJson, fuente) || precio is null);

    /// <summary>
    /// Una opcion es cotizada cuando su <c>datos.tipo_precio</c> es
    /// <c>cotizado</c> o no existe (cotizaciones importadas antes de este
    /// contrato). Si la fuente se declara estimada, nunca cuenta como real.
    /// </summary>
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

        // Filas legadas guardaban el estimado en `precio` (taxis/renta antes
        // de separar las capas). Se rescata como referencia, jamas como real.
        return opcion.Precio;
    }

    /// <summary>Lee <c>total_cotizado</c>, <c>total_estimado</c> y <c>total</c> de datos_json.</summary>
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

    /// <summary>
    /// Escribe los tres totales sin perder el resto del snapshot (calculo,
    /// destinos, origen, etc.). Los valores nulos se escriben como null para
    /// que el frontend distinga "sin cotizacion" de un cero inventado.
    /// </summary>
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

    /// <summary>
    /// Actualiza solo el desglose real/referencia y deja intacto el total que
    /// ya traia el snapshot (p. ej. el presupuesto con conceptos del motor).
    /// </summary>
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

    /// <summary>Estado de la detección automática en la cola de Fase 2.</summary>
    public static string MarcarEstadoDeteccion(string? datosJson, string estado, string? mensaje = null)
    {
        var raiz = ParsearObjeto(datosJson);
        raiz["deteccion_estado"] = estado;
        raiz["deteccion_actualizada_en"] = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
        if (mensaje is null) raiz.Remove("deteccion_mensaje");
        else raiz["deteccion_mensaje"] = mensaje;
        return raiz.ToJsonString();
    }

    /// <summary>
    /// Indica si la captura es de la tarjeta de la opción o de la página de
    /// resultados. Así el detalle no presenta una captura general como si
    /// fuera la evidencia exacta de la opción.
    /// </summary>
    public static string MarcarAlcanceCaptura(string? datosJson, string? alcance)
    {
        if (string.IsNullOrWhiteSpace(alcance)) return datosJson ?? "{}";
        var raiz = ParsearObjeto(datosJson);
        raiz["captura_alcance"] = alcance;
        raiz["captura_alcance_en"] = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
        return raiz.ToJsonString();
    }

    /// <summary>
    /// Sella el precio detectado por la cola (vuelo, autobús o hotel) y las
    /// alternativas que devolvió la fuente. No sustituye la captura.
    /// </summary>
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

    /// <summary>
    /// Marca una opcion con su precio real. Conserva <c>precio_estimado</c> (la
    /// referencia que se mostraba) y deja rastro de quien lo capturo y cuando.
    /// </summary>
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
                // Snapshot invalido: se reemplaza por uno minimo sin romper.
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

    /// <summary>
    /// El estimado puede venir como numero o como texto numerico (filas viejas
    /// escritas por el wizard). Solo se usa para la referencia, nunca para el
    /// total cotizado.
    /// </summary>
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
