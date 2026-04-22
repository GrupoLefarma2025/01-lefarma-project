namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowRecordatorio
    {
        public int IdRecordatorio { get; set; }
        public int IdWorkflow { get; set; }
        public int? IdPaso { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public bool Activo { get; set; } = true;
        public string TipoTrigger { get; set; } = "horario"; // horario|recurrente|fecha_especifica
        public TimeOnly? HoraEnvio { get; set; }
        public string? DiasSemana { get; set; }
        public int? IntervaloHoras { get; set; }
        public DateOnly? FechaEspecifica { get; set; }
        public int? MinOrdenesPendientes { get; set; }
        public int? MinDiasEnPaso { get; set; }
        public decimal? MontoMinimo { get; set; }
        public decimal? MontoMaximo { get; set; }
        public bool EscalarAJerarquia { get; set; } = false;
        public int? DiasParaEscalar { get; set; }
        public bool EnviarAlResponsable { get; set; } = true;
        public bool EnviarEmail { get; set; } = true;
        public bool EnviarWhatsapp { get; set; } = false;
        public bool EnviarTelegram { get; set; } = false;
        public DateTime FechaCreacion { get; set; }

        public virtual Workflow? Workflow { get; set; }
        public virtual WorkflowPaso? Paso { get; set; }
        public virtual List<WorkflowRecordatorioLog> Logs { get; set; } = new();
        public virtual List<WorkflowRecordatorioCanal> Canales { get; set; } = new();
    }
}
