namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowRecordatorioCanal
    {
        public int IdRecordatorioCanal { get; set; }
        public int IdRecordatorio { get; set; }
        public string CodigoCanal { get; set; } = null!;
        public string? AsuntoTemplate { get; set; }
        public string CuerpoTemplate { get; set; } = null!;
        public string? ListadoRowHtml { get; set; }
        public bool Activo { get; set; } = true;

        public virtual WorkflowRecordatorio? Recordatorio { get; set; }
    }
}
