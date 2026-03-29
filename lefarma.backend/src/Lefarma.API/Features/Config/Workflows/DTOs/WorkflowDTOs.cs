namespace Lefarma.API.Features.Config.Workflows.DTOs
{
    // ============================================================================
    // Response DTOs auxiliares (deben estar antes de WorkflowResponse)
    // ============================================================================
    public class CondicionResponse
    {
        public int IdCondicion { get; set; }
        public int IdPaso { get; set; }
        public string CampoEvaluacion { get; set; } = string.Empty;
        public string Operador { get; set; } = string.Empty;
        public string ValorComparacion { get; set; } = string.Empty;
        public int IdPasoSiCumple { get; set; }
        public bool Activo { get; set; }
    }

    public class ParticipanteResponse
    {
        public int IdParticipante { get; set; }
        public int IdPaso { get; set; }
        public int? IdRol { get; set; }
        public int? IdUsuario { get; set; }
        public bool Activo { get; set; }
    }

    public class NotificacionResponse
    {
        public int IdNotificacion { get; set; }
        public int IdAccion { get; set; }
        public int? IdPasoDestino { get; set; }
        public bool EnviarEmail { get; set; }
        public bool EnviarWhatsapp { get; set; }
        public bool EnviarTelegram { get; set; }
        public bool AvisarAlCreador { get; set; }
        public bool AvisarAlSiguiente { get; set; }
        public bool AvisarAlAnterior { get; set; }
        public bool Activo { get; set; }
        public string AsuntoTemplate { get; set; } = string.Empty;
        public string CuerpoTemplate { get; set; } = string.Empty;
    }

    // ============================================================================
    // Main Response DTOs
    // ============================================================================
    public class WorkflowResponse
    {
        public int IdWorkflow { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public string CodigoProceso { get; set; } = string.Empty;
        public int Version { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public List<WorkflowPasoResponse> Pasos { get; set; } = new();
        public WorkflowStatsResponse? Stats { get; set; }
    }

    public class WorkflowStatsResponse
    {
        public int TotalPasos { get; set; }
        public int TotalAcciones { get; set; }
        public int TotalCondiciones { get; set; }
        public int TotalNotificaciones { get; set; }
    }

    public class WorkflowPasoResponse
    {
        public int IdPaso { get; set; }
        public int Orden { get; set; }
        public string NombrePaso { get; set; } = string.Empty;
        public string? CodigoEstado { get; set; }
        public string? DescripcionAyuda { get; set; }
        public string? HandlerKey { get; set; }
        public bool EsInicio { get; set; }
        public bool EsFinal { get; set; }
        public bool Activo { get; set; }
        public bool RequiereFirma { get; set; }
        public bool RequiereComentario { get; set; }
        public bool RequiereAdjunto { get; set; }
        public List<WorkflowAccionResponse> Acciones { get; set; } = new();
        public List<CondicionResponse> Condiciones { get; set; } = new();
        public List<ParticipanteResponse> Participantes { get; set; } = new();
    }

    public class WorkflowAccionResponse
    {
        public int IdAccion { get; set; }
        public string NombreAccion { get; set; } = string.Empty;
        public string TipoAccion { get; set; } = string.Empty;
        public string ClaseEstetica { get; set; } = string.Empty;
        public int? IdPasoDestino { get; set; }
        public bool Activo { get; set; }
        public List<NotificacionResponse> Notificaciones { get; set; } = new();
    }

    public class WorkflowRequest
    {
        public string? CodigoProceso { get; set; }
        public bool? Activo { get; set; }
    }

    public class CreateWorkflowRequest
    {
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public required string CodigoProceso { get; set; }
    }

    public class UpdateWorkflowRequest
    {
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; }
    }

    public class UpdatePasoRequest
    {
        public required string NombrePaso { get; set; }
        public int Orden { get; set; }
        public string? CodigoEstado { get; set; }
        public string? DescripcionAyuda { get; set; }
        public string? HandlerKey { get; set; }
        public bool EsInicio { get; set; }
        public bool EsFinal { get; set; }
        public bool Activo { get; set; } = true;
        public bool RequiereFirma { get; set; }
        public bool RequiereComentario { get; set; }
        public bool RequiereAdjunto { get; set; }
    }

    public class CreatePasoRequest
    {
        public required string NombrePaso { get; set; }
        public int Orden { get; set; }
        public string? CodigoEstado { get; set; }
        public string? DescripcionAyuda { get; set; }
        public string? HandlerKey { get; set; }
        public bool EsInicio { get; set; }
        public bool EsFinal { get; set; }
        public bool Activo { get; set; } = true;
        public bool RequiereFirma { get; set; }
        public bool RequiereComentario { get; set; }
        public bool RequiereAdjunto { get; set; }
    }

    // ============================================================================
    // Accion DTOs
    // ============================================================================
    public class CreateAccionRequest
    {
        public required string NombreAccion { get; set; }
        public required string TipoAccion { get; set; }
        public required string ClaseEstetica { get; set; }
        public int? IdPasoDestino { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateAccionRequest
    {
        public required string NombreAccion { get; set; }
        public required string TipoAccion { get; set; }
        public required string ClaseEstetica { get; set; }
        public int? IdPasoDestino { get; set; }
        public bool Activo { get; set; } = true;
    }

    // ============================================================================
    // Condicion DTOs
    // ============================================================================
    public class CreateCondicionRequest
    {
        public required string CampoEvaluacion { get; set; }
        public required string Operador { get; set; }
        public required string ValorComparacion { get; set; }
        public int IdPasoSiCumple { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateCondicionRequest
    {
        public required string CampoEvaluacion { get; set; }
        public required string Operador { get; set; }
        public required string ValorComparacion { get; set; }
        public int IdPasoSiCumple { get; set; }
        public bool Activo { get; set; } = true;
    }

    // ============================================================================
    // Participante DTOs
    // ============================================================================
    public class CreateParticipanteRequest
    {
        public int? IdRol { get; set; }
        public int? IdUsuario { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateParticipanteRequest
    {
        public int? IdRol { get; set; }
        public int? IdUsuario { get; set; }
        public bool Activo { get; set; } = true;
    }

    // ============================================================================
    // Notificacion DTOs
    // ============================================================================
    public class CreateNotificacionRequest
    {
        public int? IdPasoDestino { get; set; }
        public bool EnviarEmail { get; set; }
        public bool EnviarWhatsapp { get; set; }
        public bool EnviarTelegram { get; set; }
        public bool AvisarAlCreador { get; set; }
        public bool AvisarAlSiguiente { get; set; }
        public bool AvisarAlAnterior { get; set; }
        public bool Activo { get; set; } = true;
        public required string AsuntoTemplate { get; set; }
        public required string CuerpoTemplate { get; set; }
    }

    public class UpdateNotificacionRequest
    {
        public int? IdPasoDestino { get; set; }
        public bool EnviarEmail { get; set; }
        public bool EnviarWhatsapp { get; set; }
        public bool EnviarTelegram { get; set; }
        public bool AvisarAlCreador { get; set; }
        public bool AvisarAlSiguiente { get; set; }
        public bool AvisarAlAnterior { get; set; }
        public bool Activo { get; set; } = true;
        public required string AsuntoTemplate { get; set; }
        public required string CuerpoTemplate { get; set; }
    }
}
