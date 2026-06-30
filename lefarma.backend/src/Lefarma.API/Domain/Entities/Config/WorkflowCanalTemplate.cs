namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowCanalTemplate
    {
        public int IdTemplate { get; set; }
        public string? CodigoProceso { get; set; }//Vincula el template a un codigo_proceso específico 
        public string CodigoCanal { get; set; } = null!; // 'email', 'in_app', 'whatsapp', 'telegram'
        public string Nombre { get; set; } = null!;
        public string? UrlButton { get; set; }
        public string LayoutHtml { get; set; } = null!;
        public bool Activo { get; set; } = true;
        public DateTime FechaModificacion { get; set; } = DateTime.UtcNow;
    }
}
