namespace Lefarma.API.Domain.Entities.Config
{
    /// <summary>
    /// Template específico por canal para una <see cref="WorkflowNotificacion"/>.
    /// Todo el contenido (asunto + cuerpo) vive aquí; el dispatcher usa siempre el canal correspondiente.
    /// </summary>
    public class WorkflowNotificacionCanal
    {
        public int IdNotificacionCanal { get; set; }
        public int IdNotificacion { get; set; }
        /// <summary>'email' | 'in_app' | 'whatsapp' | 'telegram'</summary>
        public string CodigoCanal { get; set; } = null!;
        public string? AsuntoTemplate { get; set; }
        public string CuerpoTemplate { get; set; } = null!;
        /// <summary>HTML de fila del listado para este canal. NULL = default del dispatcher.</summary>
        public string? ListadoRowHtml { get; set; }
        public bool Activo { get; set; } = true;

        public virtual WorkflowNotificacion? Notificacion { get; set; }
    }
}
