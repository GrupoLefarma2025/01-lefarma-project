using Lefarma.API.Features.Telemetria.Almacen;
using Lefarma.API.Features.Telemetria.Cola;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Telemetria.Escritor;

public sealed record EstadoEscritor(
    long LotesEscritos,
    long EventosEscritos,
    long LotesRepetidos,
    long EventosFallidos,
    string? UltimoError,
    DateTime? UltimoVaciado,
    DateTime? UltimaRetencion,
    string? UltimaRetencionDetalle);

/// <summary>
/// Vuelca la cola en SQL Server. Nunca escribe en el hilo de la petición: la
/// ingesta responde 202 al instante y este proceso hace el trabajo pesado con
/// lotes de hasta 500 eventos cada dos segundos.
/// </summary>
public class TelemetriaEscritor(
    TelemetriaCola cola,
    IServiceScopeFactory fabrica,
    IOptions<TelemetriaOpciones> opciones,
    ILogger<TelemetriaEscritor> log) : BackgroundService
{
    private const int MaximoEventosPorVuelta = 500;
    private static readonly TimeSpan EsperaMaxima = TimeSpan.FromSeconds(2);

    private long _lotesEscritos;
    private long _eventosEscritos;
    private long _lotesRepetidos;
    private long _eventosFallidos;
    private string? _ultimoError;
    private DateTime? _ultimoVaciado;
    private DateTime? _ultimaRetencion;
    private string? _ultimaRetencionDetalle;

    public EstadoEscritor ObtenerEstado() => new(
        Interlocked.Read(ref _lotesEscritos),
        Interlocked.Read(ref _eventosEscritos),
        Interlocked.Read(ref _lotesRepetidos),
        Interlocked.Read(ref _eventosFallidos),
        _ultimoError,
        _ultimoVaciado,
        _ultimaRetencion,
        _ultimaRetencionDetalle);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!opciones.Value.Habilitada)
        {
            log.LogInformation("La telemetría está deshabilitada: el escritor no arranca.");
            return;
        }

        await Task.WhenAll(BucleEscrituraAsync(stoppingToken), BucleRetencionAsync(stoppingToken));
    }

    /// <summary>Drena lo que haya en cola. Devuelve los eventos guardados.</summary>
    public async Task<int> ProcesarDisponiblesAsync(CancellationToken cancellationToken)
    {
        var lotes = new List<Modelo.LoteTelemetria>();
        var eventos = 0;

        while (eventos < MaximoEventosPorVuelta && cola.TryLeer(out var lote) && lote is not null)
        {
            lotes.Add(lote);
            eventos += lote.Eventos.Count;
        }

        if (lotes.Count == 0)
            return 0;

        using var scope = fabrica.CreateScope();
        var repositorio = scope.ServiceProvider.GetRequiredService<TelemetriaRepositorio>();

        var guardados = 0;
        foreach (var lote in lotes)
        {
            try
            {
                if (await repositorio.ExisteLoteAsync(lote.LoteId, cancellationToken))
                {
                    Interlocked.Increment(ref _lotesRepetidos);
                    continue;
                }

                guardados += await repositorio.GuardarLoteAsync(lote, cancellationToken);
                Interlocked.Increment(ref _lotesEscritos);
            }
            catch (Exception ex)
            {
                Interlocked.Add(ref _eventosFallidos, lote.Eventos.Count);
                _ultimoError = ex.Message;
                log.LogWarning(ex, "No se pudo guardar el lote de telemetría {LoteId}.", lote.LoteId);
            }
        }

        Interlocked.Add(ref _eventosEscritos, guardados);
        _ultimoVaciado = DateTime.UtcNow;
        return guardados;
    }

    private async Task BucleEscrituraAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var espera = Task.Delay(EsperaMaxima, cancellationToken);
                await Task.WhenAny(cola.EsperarDatosAsync(cancellationToken).AsTask(), espera);

                if (await ProcesarDisponiblesAsync(cancellationToken) == 0)
                    await espera;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _ultimoError = ex.Message;
                log.LogError(ex, "Error inesperado en el bucle de escritura de telemetría.");
                await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            }
        }
    }

    private async Task BucleRetencionAsync(CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(10), cancellationToken);

            while (!cancellationToken.IsCancellationRequested)
            {
                await EjecutarRetencionAsync(cancellationToken);
                await Task.Delay(TimeSpan.FromHours(24), cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Apagado normal.
        }
        catch (Exception ex)
        {
            _ultimoError = ex.Message;
            log.LogError(ex, "Error inesperado en el bucle de retención de telemetría.");
        }
    }

    /// <summary>Borra lo que ya cumplió su retención. Devuelve el detalle por tabla.</summary>
    public async Task<string> EjecutarRetencionAsync(CancellationToken cancellationToken)
    {
        using var scope = fabrica.CreateScope();
        var repositorio = scope.ServiceProvider.GetRequiredService<TelemetriaRepositorio>();
        var o = opciones.Value;

        var eliminados = await repositorio.LimpiarAntiguosAsync(
            o.RetencionDiasErrores,
            o.RetencionDiasClics,
            o.RetencionDiasMapaCalor,
            o.RetencionDiasVisitas,
            cancellationToken);

        _ultimaRetencion = DateTime.UtcNow;
        _ultimaRetencionDetalle = string.Join(", ", eliminados.Select(par => $"{par.Key}: {par.Value}"));
        log.LogInformation("Retención de telemetría ejecutada: {Detalle}.", _ultimaRetencionDetalle);

        return _ultimaRetencionDetalle;
    }
}
