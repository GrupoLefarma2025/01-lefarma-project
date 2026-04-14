using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Firmas;

/// <summary>
/// Envía las notificaciones de workflow después de que una firma es ejecutada exitosamente.
/// Resuelve destinatarios desde workflow_participantes y reemplaza los tags del template.
/// </summary>
public interface IWorkflowNotificationDispatcher
{
    /// <summary>
    /// Despacha la notificación configurada para la acción ejecutada.
    /// </summary>
    /// <param name="notificacion">Plantilla resuelta por ResolveWorkflowNotification; si es null no hace nada.</param>
    /// <param name="orden">Orden de compra ya actualizada con el nuevo estado.</param>
    /// <param name="idPasoDestino">Nuevo paso al que pasó la orden (null si no hubo transición).</param>
    /// <param name="idUsuarioActual">Usuario que ejecutó la acción (firmante).</param>
    /// <param name="comentario">Comentario capturado en el paso (puede ser null).</param>
    Task DispatchAsync(
        WorkflowNotificacion? notificacion,
        OrdenCompra orden,
        int? idPasoDestino,
        int idUsuarioActual,
        string? comentario,
        CancellationToken ct = default);
}
