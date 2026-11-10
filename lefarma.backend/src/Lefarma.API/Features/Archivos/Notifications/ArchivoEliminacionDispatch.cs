using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.API.Features.Archivos.Notifications;

/// <summary>
/// Encola el aviso de eliminación fuera del ciclo del request. El correo no debe
/// retrasar ni tumbar el borrado del archivo, así que se ejecuta con su propio
/// scope (mismo patrón que la notificación de firmas de workflow).
/// </summary>
public static class ArchivoEliminacionDispatch
{
    /// <summary>Encola el aviso y regresa de inmediato.</summary>
    public static void Enviar(IServiceScopeFactory scopeFactory, ArchivoEliminadoEvento evento)
    {
        _ = Task.Run(async () =>
        {
            using var scope = scopeFactory.CreateScope();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<ArchivoEliminacionNotifier>>();

            try
            {
                var notifier = scope.ServiceProvider.GetRequiredService<IArchivoEliminacionNotifier>();
                await notifier.NotificarAsync(evento, CancellationToken.None);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "No se pudo enviar el aviso de eliminación del archivo {IdArchivo}.",
                    evento.IdArchivo);
            }
        });
    }
}
