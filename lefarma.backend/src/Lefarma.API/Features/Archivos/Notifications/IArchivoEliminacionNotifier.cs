namespace Lefarma.API.Features.Archivos.Notifications;

public interface IArchivoEliminacionNotifier
{
    Task NotificarAsync(ArchivoEliminadoEvento evento, CancellationToken ct = default);
}
