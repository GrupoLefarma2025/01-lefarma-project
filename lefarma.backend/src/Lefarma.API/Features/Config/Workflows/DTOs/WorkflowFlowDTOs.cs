namespace Lefarma.API.Features.Config.Workflows.DTOs
{
    public class WorkflowFlowResponse
    {
        public int IdWorkflow { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string CodigoProceso { get; set; } = string.Empty;
        public int Version { get; set; }
        public bool Activo { get; set; }
        public List<WorkflowPasoFlowResponse> Pasos { get; set; } = new();
    }

    public class WorkflowPasoFlowResponse
    {
        public int IdPaso { get; set; }
        public int Orden { get; set; }
        public string NombrePaso { get; set; } = string.Empty;
        public int? IdEstado { get; set; }
        public string? DescripcionAyuda { get; set; }
        public bool EsInicio { get; set; }
        public bool EsFinal { get; set; }
        public bool Activo { get; set; }
        public bool RequiereFirma { get; set; }
        public bool RequiereComentario { get; set; }
        public bool RequiereAdjunto { get; set; }
        public bool PermiteAdjunto { get; set; }
    }
}
