using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.Config.Workflows.Notification;

/// <summary>
/// Envía las notificaciones de workflow después de que una firma es ejecutada exitosamente.
/// Resuelve destinatarios desde workflow_participantes y reemplaza los tags del template.
/// </summary>
public interface IWorkflowNotificationDispatcher
{
    /// <summary>
    /// Despacha la notificación configurada para la acción ejecutada.
    /// </summary>
    /// <param name="notificacion">Plantilla resuelta por ResolveWorkflowNotification.</param>
    /// <param name="tipoEntidad">Código del proceso (ej: "ORDEN_COMPRA", "SOLICITUD_PERSONAL").</param>
    /// <param name="idEntidad">ID de la entidad (IdOrden, IdSolicitud, etc.).</param>
    /// <param name="folio">Folio legible (ej: "OC-2026-00001").</param>
    /// <param name="idUsuarioCreador">Creador de la entidad (para notificar al siguiente).</param>
    /// <param name="variablesExtra">Variables adicionales del contexto (Folio, Total, Proveedor, etc.).</param>
    /// <param name="idPasoDestino">Nuevo paso al que pasó la entidad.</param>
    /// <param name="idUsuarioActual">Usuario que ejecutó la acción.</param>
    /// <param name="comentario">Comentario capturado en el paso.</param>
    /// <param name="contenidoAdicionalHtml">HTML extra (ej: tabla de partidas de OC).</param>
    Task DispatchAsync(
        WorkflowNotificacion? notificacion,
        string tipoEntidad,
        int idEntidad,
        string folio,
        int idUsuarioCreador,
        Dictionary<string, string>? variablesExtra,
        int? idPasoDestino,
        int idUsuarioActual,
        string? comentario,
        string? contenidoAdicionalHtml = null,
        CancellationToken ct = default);
}
