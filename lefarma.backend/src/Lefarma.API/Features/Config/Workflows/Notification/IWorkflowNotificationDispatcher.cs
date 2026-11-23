using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.Config.Workflows.Notification;

public interface IWorkflowNotificationDispatcher
{
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
        int? idUsuarioSolicitante = null,
        CancellationToken ct = default);
}
