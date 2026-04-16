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
        public string NombreAccion { get; set; } = string.Empty;
        public string TipoAccion { get; set; } = string.Empty;
        public string ClaseEstetica { get; set; } = string.Empty; // Para el color del bot�n en el frontend
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
        public string NombreAccion { get; set; } = string.Empty;
        public string TipoAccion { get; set; } = string.Empty;
        public bool RequiereComentario { get; set; }
        public bool RequiereAdjunto { get; set; }
        public bool PermiteAdjunto { get; set; }
        public List<AccionHandlerMetadataResponse> Handlers { get; set; } = new();
        public List<WorkflowCampoMetadataResponse> CamposWorkflow { get; set; } = new();
        public List<string> CamposRequeridos { get; set; } = new();
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
