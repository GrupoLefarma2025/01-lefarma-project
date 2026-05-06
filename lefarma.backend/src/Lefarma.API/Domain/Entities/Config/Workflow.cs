namespace Lefarma.API.Domain.Entities.Config {
public class Workflow
    {
        public int IdWorkflow { get; set; }
        public string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public string CodigoProceso { get; set; } = null!; // Ej: 'ORDEN_COMPRA', 'SOLICITUD_VIATICOS'
        public int Version { get; set; } = 1;
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }

        public virtual ICollection<WorkflowPaso> Pasos { get; set; } = new List<WorkflowPaso>();
        public virtual ICollection<WorkflowCampo> Campos { get; set; } = new List<WorkflowCampo>();

    }
}
