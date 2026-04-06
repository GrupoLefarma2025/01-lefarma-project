namespace Lefarma.API.Domain.Entities.Config {
public class WorkflowParticipante
    {
        public int IdParticipante { get; set; }
        public int IdPaso { get; set; }
        public int? IdRol { get; set; }
        public int? IdUsuario { get; set; }
        public bool Activo { get; set; } = true;

        public virtual WorkflowPaso? Paso { get; set; }
    }
}
