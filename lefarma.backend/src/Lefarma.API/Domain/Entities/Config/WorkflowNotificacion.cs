namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowNotificacion
    {
        public int IdNotificacion { get; set; }
        public int IdAccion { get; set; }
        public int? IdPasoDestino { get; set; }
        public bool EnviarEmail { get; set; } = true;
        public bool EnviarWhatsapp { get; set; }
        public bool EnviarTelegram { get; set; }
        public bool AvisarAlCreador { get; set; }
        public bool AvisarAlSiguiente { get; set; } = true;
        public bool AvisarAlAnterior { get; set; }
        public string? AsuntoTemplate { get; set; }
        public string CuerpoTemplate { get; set; } = null!; // {{Folio}}, {{Solicitante}}, {{Monto}}

        public virtual WorkflowAccion? Accion { get; set; }
        public virtual WorkflowPaso? PasoDestino { get; set; }
    }
}
