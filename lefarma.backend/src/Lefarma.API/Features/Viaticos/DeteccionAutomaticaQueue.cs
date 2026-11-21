using System.Text.Json;
using System.Threading.Channels;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Viaticos;

public sealed record DeteccionAutomaticaJob(int IdSolicitud, int IdOpcion, int IdUsuario);

/// <summary>Cola en memoria de la Fase 2. Un job por opción pendiente.</summary>
public interface IDeteccionAutomaticaQueue
{
    ValueTask EnqueueAsync(DeteccionAutomaticaJob job, CancellationToken ct = default);
    IAsyncEnumerable<DeteccionAutomaticaJob> LeerAsync(CancellationToken ct);
}

public sealed class DeteccionAutomaticaQueue : IDeteccionAutomaticaQueue
{
    private readonly Channel<DeteccionAutomaticaJob> _canal =
        Channel.CreateUnbounded<DeteccionAutomaticaJob>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    public ValueTask EnqueueAsync(DeteccionAutomaticaJob job, CancellationToken ct = default) =>
        _canal.Writer.WriteAsync(job, ct);

    public IAsyncEnumerable<DeteccionAutomaticaJob> LeerAsync(CancellationToken ct) =>
        _canal.Reader.ReadAllAsync(ct);
}

/// <summary>
/// Worker de Fase 2: al guardar una cotización se encolan las opciones con
/// precio pendiente (vuelo, autobús u hotel). Procesa una por una para no
/// saturar Playwright/Firecrawl, actualiza la opción con el precio real y
/// guarda la captura. Si falla, deja la opción pendiente y registra el motivo;
/// el respaldo manual sigue disponible.
/// </summary>
public sealed class DeteccionAutomaticaHostedService : BackgroundService
{
    private readonly IDeteccionAutomaticaQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DeteccionAutomaticaHostedService> _logger;

    public DeteccionAutomaticaHostedService(
        IDeteccionAutomaticaQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<DeteccionAutomaticaHostedService> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await EncolarPendientesAsync(stoppingToken);

        await foreach (var job in _queue.LeerAsync(stoppingToken))
        {
            try
            {
                await ProcesarAsync(job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Detección automática falló para solicitud {Id} opción {Opcion}",
                    job.IdSolicitud, job.IdOpcion);
            }
        }
    }

    /// <summary>
    /// Al arrancar, reencola las opciones que quedaron pendientes (reinicio o
    /// despliegue a media detección). Sin esto, la UI esperaría un precio que
    /// ya nadie va a buscar.
    /// </summary>
    private async Task EncolarPendientesAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var pendientes = await (
                    from o in db.SolicitudOpciones.AsNoTracking()
                    join s in db.Solicitudes.AsNoTracking() on o.IdSolicitud equals s.IdSolicitud
                    where s.Activo
                          && o.FueElegida
                          && (o.Tipo == "vuelo" || o.Tipo == "autobus" || o.Tipo == "hotel")
                          && o.UrlCompra != null
                          && o.UrlCompra != ""
                          && o.DatosJson != null
                          && (o.DatosJson.Contains("\"deteccion_estado\":\"pendiente\"")
                              || o.DatosJson.Contains("\"deteccion_estado\":\"en_proceso\""))
                    select new
                    {
                        o.IdSolicitud,
                        o.IdOpcion,
                        s.IdUsuarioSolicitante,
                    })
                .Take(200)
                .ToListAsync(ct);

            foreach (var pendiente in pendientes)
            {
                await _queue.EnqueueAsync(
                    new DeteccionAutomaticaJob(
                        pendiente.IdSolicitud,
                        pendiente.IdOpcion,
                        pendiente.IdUsuarioSolicitante),
                    ct);
            }

            if (pendientes.Count > 0)
            {
                _logger.LogInformation(
                    "Detección automática: {Total} opción(es) pendiente(s) reencolada(s) al arrancar.",
                    pendientes.Count);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Si la BD aún no está migrada, el servicio sigue escuchando la cola.
            _logger.LogWarning(ex, "No se pudieron reencolar las detecciones pendientes al arrancar.");
        }
    }

    private async Task ProcesarAsync(DeteccionAutomaticaJob job, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var solicitud = await db.Solicitudes
            .Include(s => s.Opciones)
            .Include(s => s.Eventos)
            .FirstOrDefaultAsync(s => s.IdSolicitud == job.IdSolicitud && s.Activo, ct);
        if (solicitud is null) return;

        var opcion = solicitud.Opciones.FirstOrDefault(o => o.IdOpcion == job.IdOpcion);
        if (opcion is null || string.IsNullOrWhiteSpace(opcion.UrlCompra)) return;

        var estado = LeerEstado(opcion.DatosJson);
        if (estado is "aplicado") return;

        if (string.Equals(opcion.Tipo?.Trim(), "hotel", StringComparison.OrdinalIgnoreCase)
            && opcion.Linea.StartsWith("Hotel en ", StringComparison.OrdinalIgnoreCase))
        {
            opcion.DatosJson = TotalesCotizacion.MarcarEstadoDeteccion(
                opcion.DatosJson,
                "sin_opcion",
                "La opción es una referencia de tabulador, no un hotel concreto. " +
                "Elige un hotel con nombre o captura el precio manualmente.");
            await db.SaveChangesAsync(ct);
            return;
        }

        if (!Uri.TryCreate(opcion.UrlCompra, UriKind.Absolute, out var urlOpcion)
            || (urlOpcion.Scheme != Uri.UriSchemeHttp && urlOpcion.Scheme != Uri.UriSchemeHttps))
        {
            opcion.DatosJson = TotalesCotizacion.MarcarEstadoDeteccion(
                opcion.DatosJson,
                "sin_opcion",
                "La opción no tiene una URL http/https válida para consultar el precio.");
            await db.SaveChangesAsync(ct);
            return;
        }

        if (!UrlsNavegables.EsPermitida(urlOpcion))
        {
            opcion.DatosJson = TotalesCotizacion.MarcarEstadoDeteccion(
                opcion.DatosJson,
                "sin_opcion",
                "La URL de la opción apunta a una red interna y no se puede consultar.");
            await db.SaveChangesAsync(ct);
            return;
        }

        if (CapturasService.EsDominioProhibido(urlOpcion.Host))
        {
            opcion.DatosJson = TotalesCotizacion.MarcarEstadoDeteccion(
                opcion.DatosJson,
                "sin_opcion",
                "La URL apunta a un dominio que el plan no permite consultar (Booking/Expedia).");
            await db.SaveChangesAsync(ct);
            return;
        }

        // Una solicitud ya autorizada no se vuelve a cotizar: el precio real
        // forma parte de lo que se aprobó. La opción queda cerrada para que la
        // UI no siga esperando.
        if (solicitud.Estado is not (SolicitudesController.EstadoBorrador or SolicitudesController.EstadoEnviada))
        {
            opcion.DatosJson = TotalesCotizacion.MarcarEstadoDeteccion(
                opcion.DatosJson,
                "sin_opcion",
                "La solicitud ya no está en borrador o enviada; no se actualizó el precio.");
            await db.SaveChangesAsync(ct);
            return;
        }

        opcion.DatosJson = TotalesCotizacion.MarcarEstadoDeteccion(opcion.DatosJson, "en_proceso");
        await db.SaveChangesAsync(ct);

        var contexto = ContextoDeteccion.Leer(solicitud, opcion);
        var nombre = CapturasService.NombreSugerido(
            solicitud.Folio,
            solicitud.IdSolicitud,
            opcion.IdOpcion,
            CapturasService.DestinoDeDatos(opcion.DatosJson),
            opcion.Linea,
            "auto");

        try
        {
            var detector = scope.ServiceProvider.GetRequiredService<IDeteccionPrecioService>();
            var resultado = await detector.DetectarAsync(
                opcion,
                contexto.Fecha,
                contexto.Deadline,
                contexto.MinutosTaxi,
                nombre,
                ct);

            if (resultado.Elegido is not null
                && !string.IsNullOrWhiteSpace(resultado.RutaCaptura)
                && await DeteccionPrecioAplicador.AplicarAsync(
                    db, solicitud, opcion, resultado, job.IdUsuario,
                    DateTime.UtcNow, "automatica", ct))
            {
                _logger.LogInformation(
                    "Detección automática aplicada: solicitud {Id} opción {Opcion} · {Linea} · {Precio}",
                    solicitud.IdSolicitud, opcion.IdOpcion, resultado.Elegido.Linea, resultado.Elegido.Precio);
                return;
            }

            opcion.DatosJson = TotalesCotizacion.MarcarEstadoDeteccion(
                opcion.DatosJson,
                "sin_opcion",
                resultado.Error ?? "No se detectó un precio aplicable.");
            await db.SaveChangesAsync(ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            opcion.DatosJson = TotalesCotizacion.MarcarEstadoDeteccion(
                opcion.DatosJson, "error", Recortar(ex.Message, 300));
            await db.SaveChangesAsync(ct);
            throw;
        }
    }

    private static string? LeerEstado(string? datosJson)
    {
        if (string.IsNullOrWhiteSpace(datosJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(datosJson);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                   && doc.RootElement.TryGetProperty("deteccion_estado", out var estado)
                   && estado.ValueKind == JsonValueKind.String
                ? estado.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string Recortar(string? texto, int maximo) =>
        string.IsNullOrEmpty(texto)
            ? string.Empty
            : texto.Length <= maximo ? texto : texto[..maximo];
}
