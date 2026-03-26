namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowBitacora
    {
        public int IdEvento { get; set; }
        public int IdOrden { get; set; }
        public int IdWorkflow { get; set; }
        public int IdPaso { get; set; }
        public int IdAccion { get; set; }
        public int IdUsuario { get; set; }
        public string? Comentario { get; set; }
        public string? DatosSnapshot { get; set; } // JSON del estado de la OC

        public DateTime FechaEvento { get; set; }

        public virtual Workflow? Workflow { get; set; }
        public virtual WorkflowPaso? Paso { get; set; }
        public virtual WorkflowAccion? Accion { get; set; }
    }
}
