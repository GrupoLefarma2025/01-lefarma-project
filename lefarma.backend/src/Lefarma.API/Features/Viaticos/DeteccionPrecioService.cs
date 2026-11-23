using Lefarma.API.Domain.Entities.Viaticos;

namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Precio detectado por cualquier fuente (Kayak, ClickBus, Google Hotels).
/// Es la unidad que aplica el endpoint y la cola de detección automática.
/// </summary>
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
    /// <summary>opcion (tarjeta recortada) | resultados (página completa).</summary>
    public string? CapturaAlcance { get; init; }
    public PrecioDetectado? Elegido { get; init; }
    public List<PrecioDetectado> Opciones { get; init; } = new();
}

/// <summary>
/// Fachada de detección: vuelos usan Kayak (servicio existente); autobuses y
/// hoteles usan el detector genérico de página (ClickBus/Primera Plus y Google
/// Hotels). La cola de Fase 2 depende de esta interfaz, no de un tipo concreto.
/// </summary>
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
            // La detección navega la búsqueda estable de Kayak, pero las
            // tarjetas traen enlaces /book/flight de sesión que caducan. Se
            // conserva la búsqueda para que el enlace guardado siga sirviendo.
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
