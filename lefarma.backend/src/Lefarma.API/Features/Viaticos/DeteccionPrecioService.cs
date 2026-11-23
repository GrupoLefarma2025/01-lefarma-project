using Lefarma.API.Domain.Entities.Viaticos;

namespace Lefarma.API.Features.Viaticos;

public sealed record PrecioDetectado(
    string Tipo,
    string Linea,
    decimal Precio,
    string Moneda,
    string? Fuente,
    string? UrlCompra,
    string? Detalle,
    DateOnly? Fecha = null,
    TimeOnly? Salida = null,
    TimeOnly? Llegada = null,
    int DiasLlegada = 0,
    int? DuracionMin = null,
    int? Asientos = null,
    int? Noches = null,
    bool Patrocinado = false);

public sealed class DeteccionPrecioResult
{
    public bool Ok { get; init; }
    public string? Error { get; init; }
    public bool Bloqueado { get; init; }
    public string? Fuente { get; init; }
    public string? RutaCaptura { get; init; }
    public string? CapturaAlcance { get; init; }
    public PrecioDetectado? Elegido { get; init; }
    public List<PrecioDetectado> Opciones { get; init; } = new();
}

public interface IDeteccionPrecioService
{
    Task<DeteccionPrecioResult> DetectarAsync(
        SolicitudOpcion opcion,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi,
        string nombre,
        CancellationToken ct,
        bool capturar = true);
}

public sealed class DeteccionPrecioService : IDeteccionPrecioService
{
    private readonly IDeteccionPrecioVueloService _vuelos;
    private readonly IDeteccionPrecioOtrosService _otros;

    public DeteccionPrecioService(
        IDeteccionPrecioVueloService vuelos,
        IDeteccionPrecioOtrosService otros)
    {
        _vuelos = vuelos;
        _otros = otros;
    }

    public async Task<DeteccionPrecioResult> DetectarAsync(
        SolicitudOpcion opcion,
        DateOnly fecha,
        DateTime? deadline,
        int minutosTaxi,
        string nombre,
        CancellationToken ct,
        bool capturar = true)
    {
        var tipo = TotalesCotizacion.NormalizarTipo(opcion.Tipo);

        if (TotalesCotizacion.EsVuelo(tipo))
        {
            if (string.IsNullOrWhiteSpace(opcion.UrlCompra))
            {
                return new DeteccionPrecioResult
                {
                    Ok = false,
                    Error = "La opción no tiene URL para consultar el vuelo.",
                };
            }

            var vuelo = await _vuelos.DetectarAsync(
                opcion.UrlCompra, fecha, deadline, minutosTaxi, nombre, capturar, ct);
            var opciones = vuelo.Opciones.Select(ADetectado).ToList();
            var elegido = vuelo.Elegido is null ? null : ADetectado(vuelo.Elegido);
            if (EnlacesCompra.EsBusquedaKayak(opcion.UrlCompra))
            {
                opciones = opciones
                    .Select(o => o with { UrlCompra = opcion.UrlCompra })
                    .ToList();
                elegido = elegido is null
                    ? null
                    : elegido with { UrlCompra = opcion.UrlCompra };
            }
            return new DeteccionPrecioResult
            {
                Ok = vuelo.Ok,
                Error = vuelo.Error,
                Bloqueado = vuelo.Bloqueado,
                Fuente = vuelo.Fuente,
                RutaCaptura = vuelo.RutaCaptura,
                CapturaAlcance = vuelo.CapturaAlcance,
                Elegido = elegido,
                Opciones = opciones,
            };
        }

        if (tipo is "autobus" or "hotel")
        {
            if (string.IsNullOrWhiteSpace(opcion.UrlCompra))
            {
                return new DeteccionPrecioResult
                {
                    Ok = false,
                    Error = "La opción no tiene URL para consultar el precio.",
                };
            }

            return await _otros.DetectarAsync(
                tipo,
                opcion.UrlCompra,
                opcion.Linea,
                fecha,
                deadline,
                minutosTaxi,
                nombre,
                capturar,
                ct);
        }

        return new DeteccionPrecioResult
        {
            Ok = false,
            Error = $"El tipo '{opcion.Tipo}' no tiene detección automática.",
        };
    }

    private static PrecioDetectado ADetectado(VueloDetectado vuelo)
    {
        var dia = vuelo.DiasLlegada > 0 ? $" +{vuelo.DiasLlegada}d" : string.Empty;
        return new PrecioDetectado(
            Tipo: "vuelo",
            Linea: $"{vuelo.Aerolinea} {vuelo.Salida:HH:mm}–{vuelo.Llegada:HH:mm}{dia}",
            Precio: vuelo.Precio,
            Moneda: vuelo.Moneda,
            Fuente: "kayak.com.mx",
            UrlCompra: vuelo.UrlCompra,
            Detalle: string.Join(" · ", new[] { vuelo.Escalas, vuelo.DuracionMin is null ? null : $"{vuelo.DuracionMin} min" }.Where(x => !string.IsNullOrWhiteSpace(x))),
            Fecha: null,
            Salida: vuelo.Salida,
            Llegada: vuelo.Llegada,
            DiasLlegada: vuelo.DiasLlegada,
            DuracionMin: vuelo.DuracionMin,
            Patrocinado: vuelo.Patrocinado);
    }
}
