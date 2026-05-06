namespace Lefarma.API.Domain.Entities.Config {
public class WorkflowPaso
    {
        public int IdPaso { get; set; }
        public int IdWorkflow { get; set; }
        public int Orden { get; set; }
        public string NombrePaso { get; set; } = null!;
        public int? IdEstado { get; set; }      
        public string? DescripcionAyuda { get; set; }
        public bool EsInicio { get; set; }
        public bool EsFinal { get; set; }
        public bool Activo { get; set; } = true;
        public bool RequiereFirma { get; set; }
        public bool RequiereComentario { get; set; }
        public bool RequiereAdjunto { get; set; }
        public bool PermiteAdjunto { get; set; } = true;   // Si false, oculta el uploader libre en el modal

        public virtual Workflow? Workflow { get; set; }
        public virtual WorkflowEstados? Estado { get; set; }
        public virtual ICollection<WorkflowParticipante> Participantes { get; set; } = new List<WorkflowParticipante>();
        public virtual ICollection<WorkflowAccion> AccionesOrigen { get; set; } = new List<WorkflowAccion>();
        public virtual ICollection<WorkflowCondicion> Condiciones { get; set; } = new List<WorkflowCondicion>();
    }
}
