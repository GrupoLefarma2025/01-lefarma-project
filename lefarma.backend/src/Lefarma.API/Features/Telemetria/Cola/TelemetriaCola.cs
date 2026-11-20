using System.Threading.Channels;
using Lefarma.API.Features.Telemetria.Modelo;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Telemetria.Cola;

/// <summary>Foto de la cola en memoria, para el panel de estado.</summary>
public sealed record EstadoCola(long Encolados, long Descartados, long Pendientes, int Capacidad);

/// <summary>
/// Cola acotada entre la petición HTTP (que responde 202 al instante) y el escritor
/// en segundo plano. Si el escritor se atrasa, se descartan lotes nuevos en lugar de
/// crecer sin límite: el descarte se cuenta y se ve en el estado.
/// </summary>
public sealed class TelemetriaCola
{
    private readonly Channel<LoteTelemetria> _canal;
    private readonly int _capacidad;
    private long _encolados;
    private long _descartados;

    public TelemetriaCola(IOptions<TelemetriaOpciones> opciones)
    {
        _capacidad = Math.Max(1, opciones.Value.ColaMaximaEventos);
        _canal = Channel.CreateBounded<LoteTelemetria>(new BoundedChannelOptions(_capacidad)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false,
            AllowSynchronousContinuations = false
        });
    }

    /// <summary>Intenta encolar; devuelve <c>false</c> si la cola está llena (lote descartado).</summary>
    public bool Encolar(LoteTelemetria lote)
    {
        if (_canal.Writer.TryWrite(lote))
        {
            Interlocked.Increment(ref _encolados);
            return true;
        }

        Interlocked.Increment(ref _descartados);
        return false;
    }

    public ValueTask<bool> EsperarDatosAsync(CancellationToken cancelacion) =>
        _canal.Reader.WaitToReadAsync(cancelacion);

    public bool TryLeer(out LoteTelemetria lote) => _canal.Reader.TryRead(out lote!);

    public EstadoCola ObtenerEstado() => new(
        Encolados: Interlocked.Read(ref _encolados),
        Descartados: Interlocked.Read(ref _descartados),
        Pendientes: _canal.Reader.Count,
        Capacidad: _capacidad);

    public void Completar() => _canal.Writer.TryComplete();
}
