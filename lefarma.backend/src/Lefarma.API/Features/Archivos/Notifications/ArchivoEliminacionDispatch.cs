using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.API.Features.Archivos.Notifications;

public static class ArchivoEliminacionDispatch
{
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
