using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Lefarma.API.Domain.Entities.Viaticos;

namespace Lefarma.API.Features.Viaticos;

public sealed record ContextoDeteccionOpcion(DateOnly Fecha, DateTime? Deadline, int MinutosTaxi);

public static class ContextoDeteccion
{
    public static ContextoDeteccionOpcion Leer(Solicitud solicitud, SolicitudOpcion opcion)
    {
        var fecha = DateOnly.FromDateTime(DateTime.UtcNow);
        DateTime? deadline = null;
        var minutosTaxi = 0;

        if (!string.IsNullOrWhiteSpace(opcion.UrlCompra)
            && Uri.TryCreate(opcion.UrlCompra, UriKind.Absolute, out var url))
        {
            var fechaUrl = Regex.Match(url.AbsolutePath, @"/(\d{4}-\d{2}-\d{2})(?:/|$)");
            if (fechaUrl.Success
                && DateOnly.TryParseExact(
                    fechaUrl.Groups[1].Value,
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var fechaDetectada))
            {
                fecha = fechaDetectada;
            }
        }

        var tramo = 0;
        if (!string.IsNullOrWhiteSpace(opcion.DatosJson))
        {
            try
            {
                using var docOpcion = JsonDocument.Parse(opcion.DatosJson);
                if (docOpcion.RootElement.TryGetProperty("tramo", out var tramoEl)
                    && tramoEl.ValueKind == JsonValueKind.Number
                    && tramoEl.TryGetInt32(out var numero))
                {
                    tramo = numero;
                }
                minutosTaxi = LeerEntero(docOpcion.RootElement, "minutos_taxi_destino")
                    ?? LeerEntero(docOpcion.RootElement, "minutos_taxi")
                    ?? 0;
            }
            catch (JsonException)
            {
            }
        }

        if (!string.IsNullOrWhiteSpace(solicitud.DatosJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(solicitud.DatosJson);
                var raiz = doc.RootElement;

                if (raiz.TryGetProperty("destinos", out var destinos)
                    && destinos.ValueKind == JsonValueKind.Array
                    && tramo >= 0
                    && destinos.GetArrayLength() > tramo)
                {
                    var destino = destinos[tramo];
                    fecha = LeerFecha(destino, "debeEstarFecha") ?? fecha;
                    var hora = LeerHora(destino, "debeEstarHora");
                    if (hora is not null) deadline = fecha.ToDateTime(hora.Value);
                }
                else if (raiz.TryGetProperty("retorno", out var retorno)
                         && retorno.ValueKind == JsonValueKind.Object)
                {
                    var fechaRetorno = LeerFecha(retorno, "llegadaRequeridaFecha");
                    if (fechaRetorno is not null) fecha = fechaRetorno.Value;
                    var hora = LeerHora(retorno, "llegadaRequeridaHora");
                    if (hora is not null) deadline = fecha.ToDateTime(hora.Value);
                }
            }
            catch (JsonException)
            {
            }
        }

        return new ContextoDeteccionOpcion(fecha, deadline, minutosTaxi);
    }

    private static DateOnly? LeerFecha(JsonElement objeto, string clave)
    {
        if (!objeto.TryGetProperty(clave, out var valor) || valor.ValueKind != JsonValueKind.String)
            return null;
        return DateOnly.TryParseExact(
            valor.GetString(),
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var fecha)
            ? fecha
            : null;
    }

    private static TimeOnly? LeerHora(JsonElement objeto, string clave)
    {
        if (!objeto.TryGetProperty(clave, out var valor) || valor.ValueKind != JsonValueKind.String)
            return null;
        var texto = valor.GetString();
        if (string.IsNullOrWhiteSpace(texto)) return null;
        return TimeOnly.TryParseExact(
            texto,
            new[] { "HH:mm", "HH:mm:ss" },
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var hora)
            ? hora
            : null;
    }

    private static int? LeerEntero(JsonElement objeto, string clave)
    {
        if (!objeto.TryGetProperty(clave, out var valor)) return null;
        return valor.ValueKind == JsonValueKind.Number && valor.TryGetInt32(out var numero)
            ? numero
            : null;
    }
}
