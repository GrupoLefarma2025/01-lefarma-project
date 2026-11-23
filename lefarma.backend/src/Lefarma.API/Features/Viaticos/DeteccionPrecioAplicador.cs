using System.Text.Json;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Infrastructure.Data;

namespace Lefarma.API.Features.Viaticos;

public static class DeteccionPrecioAplicador
{
    public static async Task<bool> AplicarAsync(
        ApplicationDbContext db,
        Solicitud solicitud,
        SolicitudOpcion opcion,
        DeteccionPrecioResult resultado,
        int userId,
        DateTime ahora,
        string origen,
        CancellationToken ct)
    {
        if (resultado.Elegido is null || string.IsNullOrWhiteSpace(resultado.RutaCaptura))
            return false;

        var elegido = resultado.Elegido;
        var precioAnterior = opcion.Precio;
        opcion.Linea = elegido.Linea;
        opcion.Precio = elegido.Precio;
        opcion.Moneda = elegido.Moneda;
        opcion.Fuente = elegido.Fuente ?? "deteccion automatica";
        opcion.UrlCompra = elegido.UrlCompra ?? opcion.UrlCompra;
        opcion.RutaCaptura = resultado.RutaCaptura;
        opcion.CapturadaEn = ahora;
        if (!string.IsNullOrWhiteSpace(resultado.CapturaAlcance))
        {
            opcion.DatosJson = TotalesCotizacion.MarcarAlcanceCaptura(
                opcion.DatosJson, resultado.CapturaAlcance);
        }
        opcion.DatosJson = TotalesCotizacion.MarcarPrecioReal(
            opcion.DatosJson,
            elegido.Salida?.ToString("HH:mm"),
            elegido.Llegada?.ToString("HH:mm"),
            ahora,
            userId);
        opcion.DatosJson = TotalesCotizacion.MarcarDeteccionGenerica(
            opcion.DatosJson, elegido, resultado.Opciones, origen, ahora);

        var totales = TotalesCotizacion.Calcular(solicitud.Opciones);
        solicitud.DatosJson = TotalesCotizacion.EscribirEnDatos(
            solicitud.DatosJson, totales.Cotizado, totales.Estimado, totales.Total);
        solicitud.FechaModificacion = ahora;

        db.SolicitudEventos.Add(new SolicitudEvento
        {
            IdSolicitud = solicitud.IdSolicitud,
            Tipo = "precio_real_detectado",
            PayloadJson = JsonSerializer.Serialize(new
            {
                id_opcion = opcion.IdOpcion,
                tipo = opcion.Tipo,
                linea = elegido.Linea,
                precio_anterior = precioAnterior,
                precio = elegido.Precio,
                moneda = elegido.Moneda,
                fuente = opcion.Fuente,
                ruta_captura = resultado.RutaCaptura,
                deteccion = resultado.Fuente,
                origen,
                opciones = resultado.Opciones.Count,
            }),
            IdUsuario = userId,
            FechaCreacion = ahora,
        });

        await db.SaveChangesAsync(ct);
        return true;
    }
}
