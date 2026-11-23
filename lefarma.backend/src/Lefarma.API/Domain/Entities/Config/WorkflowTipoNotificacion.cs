namespace Lefarma.API.Domain.Entities.Config {
    public class WorkflowTipoNotificacion
    {
        public int IdTipo { get; set; }
        public string Codigo { get; set; } = null!;        
        public string Nombre { get; set; } = null!;
        public string ColorTema { get; set; } = null!;     
        public string ColorClaro { get; set; } = null!;    
        public string Icono { get; set; } = null!;         
        public bool Activo { get; set; } = true;
        public virtual ICollection<WorkflowNotificacion> Notificaciones { get; set; } = [];
    }
}
