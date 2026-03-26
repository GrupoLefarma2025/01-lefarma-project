namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowAccion
    {
        public int IdAccion { get; set; }
        public int IdPasoOrigen { get; set; }
        public int? IdPasoDestino { get; set; }
        public string NombreAccion { get; set; } = null!;  // 'Autorizar', 'Rechazar', 'Corregir'
        public string TipoAccion { get; set; } = null!;    // 'APROBACION', 'RECHAZO', 'RETORNO'
        public string ClaseEstetica { get; set; } = "primary"; // success, danger, warning

        public virtual WorkflowPaso? PasoOrigen { get; set; }
        public virtual WorkflowPaso? PasoDestino { get; set; }
        public virtual ICollection<WorkflowNotificacion> Notificaciones { get; set; } = new List<WorkflowNotificacion>();
        public virtual ICollection<WorkflowBitacora> Bitacora { get; set; } = new List<WorkflowBitacora>();
    }
}
