namespace Lefarma.API.Domain.Entities.Config {
    public class WorkflowMapping
    {
        public int IdMapping { get; set; }
        public string CodigoProceso { get; set; } = null!;
        public int IdScopeType { get; set; }
        public int? ScopeId { get; set; }
        public int IdWorkflow { get; set; }
        public int PrioridadManual { get; set; } = 100;
        public bool Activo { get; set; } = true;
        public string? Observaciones { get; set; }
        public DateTime FechaCreacion { get; set; }
        public int? CreadoPor { get; set; }
        public DateTime? FechaActualizacion { get; set; }

        public virtual WorkflowScopeType ScopeType { get; set; } = null!;
        public virtual Workflow Workflow { get; set; } = null!;
    }
}