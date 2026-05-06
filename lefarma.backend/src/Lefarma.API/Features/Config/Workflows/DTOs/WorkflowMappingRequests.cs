namespace Lefarma.API.Features.Config.Workflows.DTOs
{
    public class CreateWorkflowMappingRequest
    {
        public required string CodigoProceso { get; set; }
        public int IdScopeType { get; set; }
        public int? ScopeId { get; set; }
        public int IdWorkflow { get; set; }
        public int PrioridadManual { get; set; } = 100;
        public bool Activo { get; set; } = true;
        public string? Observaciones { get; set; }
        public int? CreadoPor { get; set; }
    }

    public class UpdateWorkflowMappingRequest
    {
        public string? CodigoProceso { get; set; }
        public int IdScopeType { get; set; }
        public int? ScopeId { get; set; }
        public int IdWorkflow { get; set; }
        public int PrioridadManual { get; set; } = 100;
        public bool Activo { get; set; } = true;
        public string? Observaciones { get; set; }
    }
}
