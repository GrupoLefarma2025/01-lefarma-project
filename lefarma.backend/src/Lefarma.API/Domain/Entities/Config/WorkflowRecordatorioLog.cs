namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowRecordatorioLog
    {
        public int IdLog { get; set; }
        public int IdRecordatorio { get; set; }
        public int IdUsuario { get; set; }
        public int? IdOrden { get; set; }
        public int? OrdenesIncluidas { get; set; }
        public DateTime FechaEnvio { get; set; }
        public string Canal { get; set; } = string.Empty;
        public string Estado { get; set; } = "enviado";
        public string? DetalleError { get; set; }

        public virtual WorkflowRecordatorio? Recordatorio { get; set; }
    }
}
