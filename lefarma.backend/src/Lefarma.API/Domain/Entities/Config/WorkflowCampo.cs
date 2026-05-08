namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowCampo
    {
        public int IdWorkflowCampo { get; set; }
        public string NombreTecnico { get; set; } = null!;
        public string EtiquetaUsuario { get; set; } = null!;
        public string TipoControl { get; set; } = "Texto";
        public string? SourceCatalog { get; set; }
        public string? PropiedadEntidad { get; set; }
        public bool ValidarFiscal { get; set; } = false;
        public bool Activo { get; set; } = true;
    }
}
