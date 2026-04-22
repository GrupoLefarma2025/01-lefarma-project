namespace Lefarma.API.Domain.Entities.Config
{
    /// <summary>
    /// Catálogo de plantillas de referencia (sin FK). Se usa para pre-llenar el editor
    /// al crear/editar notificaciones o recordatorios. No se enlaza con ningún otro registro.
    /// </summary>
    public class WorkflowNotificacionesPlantillas
    {
        public int IdPlantilla { get; set; }
        public string Nombre { get; set; } = null!;
        /// <summary>NULL = aplica a cualquier tipo. Ej: 'aprobacion', 'rechazo', 'recordatorio'</summary>
        public string? CodigoTipoNotificacion { get; set; }
        /// <summary>'email' | 'in_app' | 'whatsapp' | 'telegram'</summary>
        public string CodigoCanal { get; set; } = null!;
        public string? AsuntoTemplate { get; set; }
        public string CuerpoTemplate { get; set; } = null!;
        /// <summary>HTML de fila del listado de órdenes. NULL = default del worker.</summary>
        public string? ListadoRowHtml { get; set; }
        public bool Activo { get; set; } = true;
    }
}
