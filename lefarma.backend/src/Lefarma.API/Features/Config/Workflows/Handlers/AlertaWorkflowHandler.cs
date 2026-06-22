namespace Lefarma.API.Features.Config.Workflows.Handlers;

/// <summary>
/// Handler puramente informativo. Muestra un mensaje de alerta en el modal de firma
/// pero NUNCA bloquea la accion. Util para avisos, recordatorios y advertencias no bloqueantes.
///
/// Configuracion JSON esperada:
/// {
///   "mensaje": "Recuerda verificar el presupuesto.",
///   "tipo": "warning"       // opcional: "info" (azul), "warning" (ambar), "error" (rojo)
/// }
/// </summary>
public class AlertaWorkflowHandler : IWorkflowActionHandler
{
    public string HandlerKey => "Alerta";
    public IReadOnlySet<string> TiposEntidadCompatibles => new HashSet<string> { "ALL" };

    public Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson)
    {
        // Nunca bloquea. El GetAccionesAsync ya evaluo y devolvio el mensaje al frontend.
        return Task.FromResult(HandlerResult.Ok());
    }
}
