namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowEstados
    {
        public int IdEstado { get; set; }
        public string? Codigo { get; set; }
        public string? Nombre { get; set; }
        public string? ColorHex { get; set; }
        public bool Activo { get; set; } = true;
    }
}
