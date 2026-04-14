namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowCanalTemplate
    {
        public int IdTemplate { get; set; }
        public int IdWorkflow { get; set; }
        public string CodigoCanal { get; set; } = null!; // 'email', 'in_app', 'whatsapp', 'telegram'
        public string Nombre { get; set; } = null!;
        public string LayoutHtml { get; set; } = null!;
        public bool Activo { get; set; } = true;
        public DateTime FechaModificacion { get; set; } = DateTime.UtcNow;

        public virtual Workflow? Workflow { get; set; }
    }
}
