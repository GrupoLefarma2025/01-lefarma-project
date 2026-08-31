namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowJefeExcluido
    {
        public int IdExclusion { get; set; }
        public int IdWorkflow { get; set; }
        public int IdUsuarioJefe { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }
}
