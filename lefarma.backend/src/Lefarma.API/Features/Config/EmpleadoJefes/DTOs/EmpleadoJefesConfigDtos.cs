namespace Lefarma.API.Features.Config.EmpleadoJefes.DTOs
{
    public class EmpleadoJefeConfigItemDto
    {
        public int Nivel { get; set; }
        public bool Aplica { get; set; }
        public int? IdUsuarioJefeOverride { get; set; }
    }

    public class EmpleadoJefeNivelCompletoDto
    {
        public int Nivel { get; set; }
        public bool Aplica { get; set; }
        public int? IdUsuarioJefeOverride { get; set; }
        public string? NombreJefeOverride { get; set; }

        // Información de la vista (contexto para la UI)
        public long? NominaJefeVista { get; set; }
        public int? IdUsuarioJefeVista { get; set; }
        public string? NombreJefeVista { get; set; }
    }

    public class EmpleadoJefesConfigResponse
    {
        public int IdUsuario { get; set; }
        public bool EsConfigPorDefecto { get; set; }
        public List<EmpleadoJefeNivelCompletoDto> Niveles { get; set; } = new();
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
        public List<EmpleadoJefeNivelCompletoDto> Niveles { get; set; } = new();
        public List<JefeCadenaNivelDto> Cadena { get; set; } = new();
    }

    public class JefeCadenaNivelDto
    {
        public int Nivel { get; set; }
        public long? NominaJefe { get; set; }      // null = cadena rota en la vista
        public int? IdUsuarioJefe { get; set; }    // null = sin usuario en el sistema
        public string? NombreJefe { get; set; }
    }

    public class EmpleadoJefesCadenaResponse
    {
        public int IdUsuario { get; set; }
        public List<JefeCadenaNivelDto> Cadena { get; set; } = new();
    }
}