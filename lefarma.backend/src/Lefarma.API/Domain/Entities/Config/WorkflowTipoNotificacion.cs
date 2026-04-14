namespace Lefarma.API.Domain.Entities.Config {
    public class WorkflowTipoNotificacion
    {
        public int IdTipo { get; set; }
        public string Codigo { get; set; } = null!;        // 'aprobacion', 'rechazo', 'pendiente', 'pago', 'devolucion', 'info'
        public string Nombre { get; set; } = null!;
        public string ColorTema { get; set; } = null!;     // '#16a34a'
        public string ColorClaro { get; set; } = null!;    // '#dcfce7'
        public string Icono { get; set; } = null!;         // emoji
        public bool Activo { get; set; } = true;
        public virtual ICollection<WorkflowNotificacion> Notificaciones { get; set; } = [];
    }
}
