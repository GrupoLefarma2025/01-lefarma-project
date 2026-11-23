namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers;

public class AlertaWorkflowHandler : IWorkflowActionHandler
{
    public string HandlerKey => "Alerta";

    public Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson)
    {
        return Task.FromResult(HandlerResult.Ok());
    }
}
