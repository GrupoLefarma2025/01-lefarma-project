namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
{
    public interface IWorkflowActionHandler
    {
        string HandlerKey { get; }
        Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson);
    }
}
