using System.ComponentModel.DataAnnotations;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

/// <summary>Ejecución de una acción del workflow sobre una entidad de Educación Médica (firmar, devolver, cancelar, enviar).</summary>
public class FirmarWorkflowRequest
{
    [Required(ErrorMessage = "La acción es obligatoria.")]
    [Range(1, int.MaxValue, ErrorMessage = "La acción es obligatoria.")]
    public int IdAccion { get; set; }

    [MaxLength(500)]
    public string? Comentario { get; set; }

    /// <summary>Valores de los campos dinámicos configurados en la acción (handlers Field/Document del workflow).</summary>
    public Dictionary<string, object>? DatosAdicionales { get; set; }
}

/// <summary>Estado de autorización de una versión de rutas (para la SPA).</summary>
public class RutaVersionDto
{
    public int IdRutaVersion { get; set; }
    public int Version { get; set; }
    public string Estado { get; set; } = string.Empty;
    public int? IdPasoActual { get; set; }
    public string? PasoNombre { get; set; }
    public bool EsEditable { get; set; }
    public bool EsFinal { get; set; }
    public List<AccionDisponibleResponse> Acciones { get; set; } = [];
}

/// <summary>Item de la Bandeja de Autorizaciones del módulo.</summary>
public class PendienteAprobacionDto
{
    public string Tipo { get; set; } = string.Empty;   // "seleccion" | "rutas"
    public int IdEntidad { get; set; }                 // idSeleccionMensual | idRutaVersion
    public int IdSeleccionMensual { get; set; }        // para navegar a la pantalla correspondiente
    /// <summary>Workflow del documento (para dibujar el flujo en el modal de historial).</summary>
    public int? IdWorkflow { get; set; }
    public int? IdPasoActual { get; set; }
    public string Documento { get; set; } = string.Empty;
    public string? Detalle { get; set; }
    public int? IdUsuarioCreador { get; set; }
    public string? NombreUsuarioCreador { get; set; }
    public string? PasoNombre { get; set; }
    /// <summary>Estado de dominio del documento (Borrador, EnRevision, Autorizada... / Draft, Confirmada...).</summary>
    public string? Estado { get; set; }
    /// <summary>Estado del workflow (config.workflow_estados); mismo criterio que Solicitudes de Personal.</summary>
    public int? IdEstado { get; set; }
    public string? EstadoNombre { get; set; }
    public string? EstadoColor { get; set; }
    /// <summary>Fecha de creación del documento (convención única para ambos tipos).</summary>
    public DateTime? Fecha { get; set; }
    /// <summary>Número de versión cuando el documento es de rutas (para abrir el detalle exacto).</summary>
    public int? VersionRutas { get; set; }
    /// <summary>Acciones del motor disponibles para el usuario en el paso actual; vacío si no es su turno.</summary>
    public List<AccionDisponibleResponse> Acciones { get; set; } = [];
}
