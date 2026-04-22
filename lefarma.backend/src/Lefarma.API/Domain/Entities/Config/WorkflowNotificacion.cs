namespace Lefarma.API.Domain.Entities.Config {
public class WorkflowNotificacion
    {
        public int IdNotificacion { get; set; }
        public int IdAccion { get; set; }
        public int? IdPasoDestino { get; set; }
        public bool EnviarEmail { get; set; } = false;
        public bool EnviarWhatsapp { get; set; }
        public bool EnviarTelegram { get; set; }
        public bool AvisarAlCreador { get; set; }
        public bool AvisarAlSiguiente { get; set; } = true;
        public bool AvisarAlAnterior { get; set; }
        public bool AvisarAAutorizadoresPrevios { get; set; }
        public bool IncluirPartidas { get; set; }
        public bool Activo { get; set; } = true;

        public int? IdTipoNotificacion { get; set; }

        public virtual WorkflowAccion? Accion { get; set; }
        public virtual WorkflowPaso? PasoDestino { get; set; }
        public virtual WorkflowTipoNotificacion? TipoNotificacion { get; set; }
        public virtual List<WorkflowNotificacionCanal> Canales { get; set; } = new();
    }
}
