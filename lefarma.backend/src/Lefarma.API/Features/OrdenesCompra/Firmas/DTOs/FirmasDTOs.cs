namespace Lefarma.API.Features.OrdenesCompra.Firmas.DTOs
{
public class FirmarRequest
    {
        public required int IdAccion { get; set; }
        public string? Comentario { get; set; }
        // Datos espec�ficos por firma: Firma3 ? CentroCosto, CuentaContable
        //                              Firma4 ? RequiereComprobacionPago, RequiereComprobacionGasto
        public Dictionary<string, object>? DatosAdicionales { get; set; }
    }

    public class FirmarResponse
    {
        public bool Exitoso { get; set; }
        public string Folio { get; set; } = string.Empty;
        public string EstadoAnterior { get; set; } = string.Empty;
        public string? NuevoEstado { get; set; }
        public string? Mensaje { get; set; }
    }

    public class AccionDisponibleResponse
    {
        public int IdAccion { get; set; }
        public int IdTipoAccion { get; set; }
        public string? TipoAccionCodigo { get; set; }
        public string? TipoAccionNombre { get; set; }
        public bool? TipoAccionCambiaEstado { get; set; }
        
        // Handlers y campos para construir el modal dinámico
        public List<AccionHandlerMetadataResponse> Handlers { get; set; } = new();
        public List<WorkflowCampoMetadataResponse> CamposWorkflow { get; set; } = new();
        public List<string> CamposRequeridos { get; set; } = new();
        
        // Requisitos del paso origen
        public bool RequiereComentario { get; set; }
        public bool RequiereAdjunto { get; set; }
        public bool PermiteAdjunto { get; set; }
    }

    public class AccionHandlerMetadataResponse
    {
        public int IdHandler { get; set; }
        public string HandlerKey { get; set; } = string.Empty;
        public bool Requerido { get; set; } = true;
        public string? ConfiguracionJson { get; set; }
        public int OrdenEjecucion { get; set; }
    }

    public class WorkflowCampoMetadataResponse
    {
        public int IdWorkflowCampo { get; set; }
        public string NombreTecnico { get; set; } = string.Empty;
        public string EtiquetaUsuario { get; set; } = string.Empty;
        public string TipoControl { get; set; } = string.Empty;
        public string? SourceCatalog { get; set; }
    }

    public class AccionMetadataResponse
    {
        public int IdOrden { get; set; }
        public int IdAccion { get; set; }
        public int IdTipoAccion { get; set; }
        public string? TipoAccionCodigo { get; set; }
        public string? TipoAccionNombre { get; set; }
        public bool? TipoAccionCambiaEstado { get; set; }
        public bool RequiereComentario { get; set; }
        public bool RequiereAdjunto { get; set; }
        public bool PermiteAdjunto { get; set; }
        public List<AccionHandlerMetadataResponse> Handlers { get; set; } = new();
        public List<WorkflowCampoMetadataResponse> CamposWorkflow { get; set; } = new();
        public List<string> CamposRequeridos { get; set; } = new();
    }

    // ── Envío Concentrado ─────────────────────────────────────────────────────

    public class EnvioConcentradoRequest
    {
        /// <summary>IDs de las órdenes en paso 4 a avanzar.</summary>
        public required List<int> IdsOrdenes { get; set; }

        /// <summary>Comentario que quedará en la bitácora de cada orden.</summary>
        public string? Comentario { get; set; }
    }

    public class EnvioConcentradoItemResult
    {
        public int IdOrden { get; set; }
        public string Folio { get; set; } = string.Empty;
        public bool Exitoso { get; set; }
        public string? NuevoEstado { get; set; }
        public string? Error { get; set; }
    }

    public class EnvioConcentradoResponse
    {
        public int Total { get; set; }
        public int Exitosas { get; set; }
        public int Fallidas { get; set; }
        public List<EnvioConcentradoItemResult> Resultados { get; set; } = new();
    }

    public class HistorialWorkflowItemResponse
    {
        public int IdEvento { get; set; }
        public int IdOrden { get; set; }
        public int IdPaso { get; set; }
        public string? NombrePaso { get; set; }
        public int IdAccion { get; set; }
        public string? NombreAccion { get; set; }
        public int IdUsuario { get; set; }
        public string? NombreUsuario { get; set; }
        public string? Comentario { get; set; }
        public string? DatosSnapshot { get; set; }
        public DateTime FechaEvento { get; set; }
    }
}
