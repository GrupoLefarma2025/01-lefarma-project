namespace Lefarma.API.Features.Config.Workflows.Handlers;

public class AlertaWorkflowHandler : IWorkflowActionHandler
{
    public string HandlerKey => "Alerta";
    public IReadOnlySet<string> TiposEntidadCompatibles => new HashSet<string> { "ALL" };

    public Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson)
    {
        return Task.FromResult(HandlerResult.Ok());
    }
}
