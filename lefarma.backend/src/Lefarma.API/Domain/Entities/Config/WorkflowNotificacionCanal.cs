namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowNotificacionCanal
    {
        public int IdNotificacionCanal { get; set; }
        public int IdNotificacion { get; set; }
        public string CodigoCanal { get; set; } = null!;
        public string? AsuntoTemplate { get; set; }
        public string CuerpoTemplate { get; set; } = null!;
        public string? ListadoRowHtml { get; set; }
        public bool Activo { get; set; } = true;

        public virtual WorkflowNotificacion? Notificacion { get; set; }
    }
}
