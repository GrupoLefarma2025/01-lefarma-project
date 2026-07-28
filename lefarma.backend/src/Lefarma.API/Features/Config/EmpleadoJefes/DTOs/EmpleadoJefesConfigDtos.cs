namespace Lefarma.API.Features.Config.EmpleadoJefes.DTOs
{
    public class EmpleadoJefeConfigItemDto
    {
        public int Nivel { get; set; }
        public bool Aplica { get; set; }
    }

    public class EmpleadoJefesConfigResponse
    {
        public int IdUsuario { get; set; }
        public bool EsConfigPorDefecto { get; set; }  // true = sin filas, rige default legacy (nivel 1)
        public List<EmpleadoJefeConfigItemDto> Niveles { get; set; } = new();
    }

    public class UpdateEmpleadoJefesConfigRequest
    {
        public List<EmpleadoJefeConfigItemDto> Niveles { get; set; } = new();
    }

    public class WorkflowJefesExcluidosResponse
    {
        public int IdWorkflow { get; set; }
        public List<int> IdUsuariosJefe { get; set; } = new();
    }

    public class UpdateWorkflowJefesExcluidosRequest
    {
        public List<int> IdUsuariosJefe { get; set; } = new();
    }

    public class EmpleadoJefesConfigListItem
    {
        public int IdUsuario { get; set; }
        public string? NumeroEmpleado { get; set; }
        public string? NombreCompleto { get; set; }
        public string? Puesto { get; set; }
        public List<EmpleadoJefeConfigItemDto> Niveles { get; set; } = new();
    }
}
