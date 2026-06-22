namespace Lefarma.API.Features.Config.Workflows.Handlers
{
    public interface IWorkflowActionHandler
    {
        string HandlerKey { get; }

        /// <summary>
        /// Tipos de entidad (CodigoProceso) con los que este handler es compatible.
        /// Usar ["*"] para handlers genéricos.
        /// </summary>
        IReadOnlySet<string> TiposEntidadCompatibles { get; }
        Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson);
    }
}
