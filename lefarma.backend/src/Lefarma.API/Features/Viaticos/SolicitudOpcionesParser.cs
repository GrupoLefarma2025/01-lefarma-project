using System.Text.Json;
using Lefarma.API.Domain.Entities.Viaticos;

namespace Lefarma.API.Features.Viaticos;

public static class SolicitudOpcionesParser
{
    public static (List<SolicitudOpcion> Opciones, string? Error) Parsear(
        int idSolicitud,
        JsonElement opciones,
        DateTime ahora)
    {
        if (opciones.ValueKind != JsonValueKind.Array)
        {
            return ([], "El campo 'opciones' debe ser un array.");
        }

        var nuevas = new List<SolicitudOpcion>();
        var indice = 0;
        foreach (var op in opciones.EnumerateArray())
        {
            if (op.ValueKind != JsonValueKind.Object)
            {
                return ([], $"opciones[{indice}] debe ser un objeto.");
            }

            string? urlCompra = null;
            if (op.TryGetProperty("url_compra", out var urlEl))
            {
                switch (urlEl.ValueKind)
                {
                    case JsonValueKind.String:
                        var url = urlEl.GetString()?.Trim();
                        urlCompra = string.IsNullOrWhiteSpace(url) ? null : url;
                        break;
                    case JsonValueKind.Null:
                    case JsonValueKind.Undefined:
                        urlCompra = null;
                        break;
                    default:
                        return ([], $"opciones[{indice}].url_compra debe ser texto o null.");
                }
            }

            if (!op.TryGetProperty("fuente", out var fuenteEl)
                || fuenteEl.ValueKind != JsonValueKind.String
                || string.IsNullOrWhiteSpace(fuenteEl.GetString()))
            {
                return ([], $"opciones[{indice}].fuente es obligatorio.");
            }

            var fuente = fuenteEl.GetString()!.Trim();

            decimal? precio = null;
            if (op.TryGetProperty("precio", out var precioEl) && precioEl.ValueKind == JsonValueKind.Number)
            {
                precio = precioEl.GetDecimal();
            }
            else if (op.TryGetProperty("precio", out var precioElNull) && precioElNull.ValueKind == JsonValueKind.Null)
            {
                precio = null;
            }
            else if (op.TryGetProperty("precio", out _))
            {
                return ([], $"opciones[{indice}].precio debe ser numérico o null.");
            }

            if (precio is null && fuente.IndexOf("estimado", StringComparison.OrdinalIgnoreCase) < 0)
            {
                return ([], $"opciones[{indice}].precio solo puede ser null si la fuente es estimada.");
            }

            var tipo = op.TryGetProperty("tipo", out var tipoEl) && tipoEl.ValueKind == JsonValueKind.String
                ? tipoEl.GetString()!
                : "vuelo";
            var linea = op.TryGetProperty("linea", out var lineaEl) && lineaEl.ValueKind == JsonValueKind.String
                ? lineaEl.GetString()!
                : "(sin línea)";
            var moneda = op.TryGetProperty("moneda", out var monEl) && monEl.ValueKind == JsonValueKind.String
                ? monEl.GetString()
                : null;
            var fueElegida = op.TryGetProperty("fue_elegida", out var feEl) && feEl.ValueKind == JsonValueKind.True;
            var rutaCaptura = op.TryGetProperty("ruta_captura", out var rcEl) && rcEl.ValueKind == JsonValueKind.String
                ? rcEl.GetString()
                : null;
            var datosJson = op.TryGetProperty("datos", out var dEl) && dEl.ValueKind == JsonValueKind.Object
                ? dEl.GetRawText()
                : null;

            nuevas.Add(new SolicitudOpcion
            {
                IdSolicitud = idSolicitud,
                Tipo = tipo,
                Linea = linea,
                DatosJson = datosJson,
                Precio = precio,
                Moneda = moneda,
                UrlCompra = urlCompra,
                Fuente = fuente,
                FueElegida = fueElegida,
                RutaCaptura = rutaCaptura,
                CapturadaEn = rutaCaptura is not null ? (DateTime?)ahora : null,
            });
            indice++;
        }

        return (nuevas, null);
    }
}
