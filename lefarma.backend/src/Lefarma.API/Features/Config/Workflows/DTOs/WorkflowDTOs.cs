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
        public int? IdTipoNotificacion { get; set; }
        public bool EnviarEmail { get; set; }
        public bool EnviarWhatsapp { get; set; }
        public bool EnviarTelegram { get; set; }
        public bool AvisarAlCreador { get; set; }
        public bool AvisarAlSiguiente { get; set; }
        public bool AvisarAlAnterior { get; set; }
        public bool AvisarAAutorizadoresPrevios { get; set; }
        public bool IncluirPartidas { get; set; }
        public bool Activo { get; set; }
        public List<WorkflowNotificacionCanalDto> Canales { get; set; } = new();
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
        public List<WorkflowCampoResponse> Campos { get; set; } = new();
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
        public List<WorkflowAccionHandlerResponse> Handlers { get; set; } = new();
        public List<NotificacionResponse> Notificaciones { get; set; } = new();
    }

    public class WorkflowAccionHandlerResponse
    {
        public int IdHandler { get; set; }
        public string HandlerKey { get; set; } = string.Empty;
        public string? ConfiguracionJson { get; set; }
        public int OrdenEjecucion { get; set; }
        public bool Activo { get; set; }
        public int? IdWorkflowCampo { get; set; }
        public WorkflowCampoResponse? Campo { get; set; }
    }

    public class WorkflowCampoResponse
    {
        public int IdWorkflowCampo { get; set; }
        public int IdWorkflow { get; set; }
        public string NombreTecnico { get; set; } = string.Empty;
        public string EtiquetaUsuario { get; set; } = string.Empty;
        public string TipoControl { get; set; } = string.Empty;
        public string? SourceCatalog { get; set; }
        public string? PropiedadEntidad { get; set; }
        public bool ValidarFiscal { get; set; }
        public bool Activo { get; set; }
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

    public class CreateAccionHandlerRequest
    {
        public required string HandlerKey { get; set; }
        public string? ConfiguracionJson { get; set; }
        public int OrdenEjecucion { get; set; } = 1;
        public bool Activo { get; set; } = true;
        public int? IdWorkflowCampo { get; set; }
    }

    public class UpdateAccionHandlerRequest
    {
        public required string HandlerKey { get; set; }
        public string? ConfiguracionJson { get; set; }
        public int OrdenEjecucion { get; set; } = 1;
        public bool Activo { get; set; } = true;
        public int? IdWorkflowCampo { get; set; }
    }

    public class CreateWorkflowCampoRequest
    {
        public required string NombreTecnico { get; set; }
        public required string EtiquetaUsuario { get; set; }
        public required string TipoControl { get; set; }
        public string? SourceCatalog { get; set; }
        public string? PropiedadEntidad { get; set; }
        public bool ValidarFiscal { get; set; } = false;
        public bool Activo { get; set; } = true;
    }

    public class UpdateWorkflowCampoRequest
    {
        public required string NombreTecnico { get; set; }
        public required string EtiquetaUsuario { get; set; }
        public required string TipoControl { get; set; }
        public string? SourceCatalog { get; set; }
        public string? PropiedadEntidad { get; set; }
        public bool ValidarFiscal { get; set; } = false;
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
        public int? IdTipoNotificacion { get; set; }
        public bool EnviarEmail { get; set; }
        public bool EnviarWhatsapp { get; set; }
        public bool EnviarTelegram { get; set; }
        public bool AvisarAlCreador { get; set; }
        public bool AvisarAlSiguiente { get; set; }
        public bool AvisarAlAnterior { get; set; }
        public bool AvisarAAutorizadoresPrevios { get; set; }
        public bool IncluirPartidas { get; set; }
        public bool Activo { get; set; } = true;
        public List<WorkflowNotificacionCanalDto> Canales { get; set; } = new();
    }

    public class UpdateNotificacionRequest
    {
        public int? IdPasoDestino { get; set; }
        public int? IdTipoNotificacion { get; set; }
        public bool EnviarEmail { get; set; }
        public bool EnviarWhatsapp { get; set; }
        public bool EnviarTelegram { get; set; }
        public bool AvisarAlCreador { get; set; }
        public bool AvisarAlSiguiente { get; set; }
        public bool AvisarAlAnterior { get; set; }
        public bool AvisarAAutorizadoresPrevios { get; set; }
        public bool IncluirPartidas { get; set; }
        public bool Activo { get; set; } = true;
        public List<WorkflowNotificacionCanalDto> Canales { get; set; } = new();
    }

    // ============================================================================
    // Canal Template DTOs
    // ============================================================================
    public class WorkflowCanalTemplateResponse
    {
        public int IdTemplate { get; set; }
        public int IdWorkflow { get; set; }
        public string CodigoCanal { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string LayoutHtml { get; set; } = string.Empty;
        public bool Activo { get; set; }
        public DateTime FechaModificacion { get; set; }
    }

    public class UpsertCanalTemplateRequest
    {
        public required string Nombre { get; set; }
        public required string LayoutHtml { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class CreateCanalTemplateRequest
    {
        public required string CodigoCanal { get; set; }
        public required string Nombre { get; set; }
        public required string LayoutHtml { get; set; }
        public bool Activo { get; set; } = true;
    }

    // ============================================================================
    // Tipo Notificacion DTOs
    // ============================================================================
    public class WorkflowTipoNotificacionResponse
    {
        public int IdTipo { get; set; }
        public string Codigo { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string ColorTema { get; set; } = string.Empty;
        public string ColorClaro { get; set; } = string.Empty;
        public string Icono { get; set; } = string.Empty;
        public bool Activo { get; set; }
    }

    // ============================================================================
    // Recordatorio DTOs
    // ============================================================================
    public class WorkflowRecordatorioCanalDto
    {
        public int? IdRecordatorioCanal { get; set; }
        public string CodigoCanal { get; set; } = string.Empty;
        public string? AsuntoTemplate { get; set; }
        public string CuerpoTemplate { get; set; } = string.Empty;
        public string? ListadoRowHtml { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class WorkflowNotificacionCanalDto
    {
        public int? IdNotificacionCanal { get; set; }
        public string CodigoCanal { get; set; } = string.Empty;
        public string? AsuntoTemplate { get; set; }
        public string CuerpoTemplate { get; set; } = string.Empty;
        public string? ListadoRowHtml { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class WorkflowNotificacionesPlantillaResponse
    {
        public int IdPlantilla { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? CodigoTipoNotificacion { get; set; }
        public string CodigoCanal { get; set; } = string.Empty;
        public string? AsuntoTemplate { get; set; }
        public string CuerpoTemplate { get; set; } = string.Empty;
        public string? ListadoRowHtml { get; set; }
        public bool Activo { get; set; }
    }

    public class WorkflowRecordatorioResponse
    {
        public int IdRecordatorio { get; set; }
        public int IdWorkflow { get; set; }
        public int? IdPaso { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public bool Activo { get; set; }
        public string TipoTrigger { get; set; } = string.Empty;
        public TimeOnly? HoraEnvio { get; set; }
        public string? DiasSemana { get; set; }
        public int? IntervaloHoras { get; set; }
        public DateOnly? FechaEspecifica { get; set; }
        public int? MinOrdenesPendientes { get; set; }
        public int? MinDiasEnPaso { get; set; }
        public decimal? MontoMinimo { get; set; }
        public decimal? MontoMaximo { get; set; }
        public bool EscalarAJerarquia { get; set; }
        public int? DiasParaEscalar { get; set; }
        public bool EnviarAlResponsable { get; set; }
        public bool EnviarEmail { get; set; }
        public bool EnviarWhatsapp { get; set; }
        public bool EnviarTelegram { get; set; }
        public DateTime FechaCreacion { get; set; }
        public List<WorkflowRecordatorioCanalDto> Canales { get; set; } = new();
    }

    public class CreateRecordatorioRequest
    {
        public int? IdPaso { get; set; }
        public required string Nombre { get; set; }
        public bool Activo { get; set; } = true;
        public string TipoTrigger { get; set; } = "horario";
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
        public List<WorkflowRecordatorioCanalDto> Canales { get; set; } = new();
    }

    public class UpdateRecordatorioRequest
    {
        public int? IdPaso { get; set; }
        public required string Nombre { get; set; }
        public bool Activo { get; set; } = true;
        public string TipoTrigger { get; set; } = "horario";
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
        public List<WorkflowRecordatorioCanalDto> Canales { get; set; } = new();
    }
}
