namespace Lefarma.API.Domain.Entities.Config {
public class WorkflowAccion
    {
        public int IdAccion { get; set; }
        public int IdPasoOrigen { get; set; }
        public int? IdPasoDestino { get; set; }
        public int IdTipoAccion { get; set; }
        public bool EnviaConcentrado { get; set; } = false;
        public bool Activo { get; set; } = true;

        public virtual WorkflowTipoAccion? TipoAccion { get; set; }
        public virtual WorkflowPaso? PasoOrigen { get; set; }
        public virtual WorkflowPaso? PasoDestino { get; set; }
        public virtual ICollection<WorkflowAccionHandler> AccionHandlers { get; set; } = new List<WorkflowAccionHandler>();
        public virtual ICollection<WorkflowNotificacion> Notificaciones { get; set; } = new List<WorkflowNotificacion>();
        public virtual ICollection<WorkflowBitacora> Bitacora { get; set; } = new List<WorkflowBitacora>();
    }
}
