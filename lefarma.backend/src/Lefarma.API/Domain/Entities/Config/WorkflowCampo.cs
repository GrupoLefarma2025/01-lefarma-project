namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowCampo
    {
        public int IdWorkflowCampo { get; set; }
        public int IdWorkflow { get; set; }
        public string NombreTecnico { get; set; } = null!;
        public string EtiquetaUsuario { get; set; } = null!;
        public string TipoControl { get; set; } = "Texto";
        public string? SourceCatalog { get; set; }
        /// <summary>Nombre exacto de la propiedad C# en OrdenCompra (para reflexión en FieldUpdater). NULL para campos tipo Archivo.</summary>
        public string? PropiedadEntidad { get; set; }
        /// <summary>Solo para campos tipo Archivo: si true, valida con webservice fiscal (CFDI). Imágenes siempre se omiten.</summary>
        public bool ValidarFiscal { get; set; } = false;
        public bool Activo { get; set; } = true;

        public virtual Workflow? Workflow { get; set; }
    }
}
