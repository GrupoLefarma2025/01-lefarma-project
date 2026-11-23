namespace Lefarma.API.Features.Config.Workflows.Handlers
{
    public interface IWorkflowActionHandler
    {
        string HandlerKey { get; }

        IReadOnlySet<string> TiposEntidadCompatibles { get; }
        Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson);
    }
}
