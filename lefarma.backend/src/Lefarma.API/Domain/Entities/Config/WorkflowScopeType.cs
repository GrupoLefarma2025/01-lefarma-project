namespace Lefarma.API.Domain.Entities.Config {
    public class WorkflowScopeType
    {
        public int IdScopeType { get; set; }
        public string Codigo { get; set; } = null!;
        public string Nombre { get; set; } = null!;
        public int NivelPrioridad { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }

        public virtual ICollection<WorkflowMapping> Mappings { get; set; } = new List<WorkflowMapping>();
    }
}