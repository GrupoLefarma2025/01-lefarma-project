using System.ComponentModel.DataAnnotations;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class FirmarWorkflowRequest
{
    [Required(ErrorMessage = "La acción es obligatoria.")]
    [Range(1, int.MaxValue, ErrorMessage = "La acción es obligatoria.")]
    public int IdAccion { get; set; }

    [MaxLength(500)]
    public string? Comentario { get; set; }

    public Dictionary<string, object>? DatosAdicionales { get; set; }
}

public class PendienteAprobacionDto
{
    public string Tipo { get; set; } = string.Empty;   
    public int IdEntidad { get; set; }                 
    public int IdSeleccionMensual { get; set; }        
    public int? IdMatrizGeneral { get; set; }

    public int? IdWorkflow { get; set; }
    public int? IdPasoActual { get; set; }
    public string Documento { get; set; } = string.Empty;
    public string? Detalle { get; set; }
    public int? IdUsuarioCreador { get; set; }
    public string? NombreUsuarioCreador { get; set; }
    public string? PasoNombre { get; set; }
    public string? Estado { get; set; }
    public int? IdEstado { get; set; }
    public string? EstadoNombre { get; set; }
    public string? EstadoColor { get; set; }
    public DateTime? Fecha { get; set; }
    public List<AccionDisponibleResponse> Acciones { get; set; } = [];
}
