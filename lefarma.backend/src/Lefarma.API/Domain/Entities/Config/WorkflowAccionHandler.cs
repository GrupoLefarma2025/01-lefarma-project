namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowAccionHandler
    {
        public int IdHandler { get; set; }
        public int IdAccion { get; set; }
        public string HandlerKey { get; set; } = null!;   // 'Field' | 'Document'
        public bool Requerido { get; set; } = true;
        public string? ConfiguracionJson { get; set; }
        public int OrdenEjecucion { get; set; } = 1;
        public bool Activo { get; set; } = true;
        public int? IdWorkflowCampo { get; set; }

        public virtual WorkflowAccion? Accion { get; set; }
        public virtual WorkflowCampo? Campo { get; set; }
    }
}
