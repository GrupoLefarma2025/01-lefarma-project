namespace Lefarma.API.Features.Config.Workflows.Notification
{
    public class WorkflowNotificationContext
    {
        public string TipoEntidad { get; init; } = null!;
        public string TipoProceso { get; init; } = "";        // "Orden de Compra" | "Solicitud de Personal"
        public string NombreProceso { get; init; } = "";     // "Sistema de Autorizaciones"
        public int IdEntidad { get; init; }
        public string Folio { get; init; } = "";
        public int IdUsuarioCreador { get; init; }
        public string UrlEntidad { get; init; } = "";
        public Dictionary<string, string> Variables { get; init; } = new();
        public string? TablaHtml { get; init; }
    }
}
