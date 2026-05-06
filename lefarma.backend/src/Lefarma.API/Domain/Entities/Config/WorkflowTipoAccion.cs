namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowTipoAccion
    {
        public int IdTipoAccion { get; set; }
        public string? Codigo { get; set; }
        public string? Nombre { get; set; }
        public string? Descripcion { get; set; }
        public bool CambiaEstado { get; set; }
        public bool Activo { get; set; }
    }
}
