namespace Lefarma.API.Features.Archivos.Notifications;

/// <summary>
/// Envía el aviso por correo cuando se elimina un archivo de una orden de compra.
/// </summary>
public interface IArchivoEliminacionNotifier
{
    /// <summary>
    /// Notifica la eliminación del archivo al creador de la OC y a los correos
    /// adicionales configurados. No lanza si el envío falla: el borrado ya ocurrió.
    /// </summary>
    Task NotificarAsync(ArchivoEliminadoEvento evento, CancellationToken ct = default);
}
