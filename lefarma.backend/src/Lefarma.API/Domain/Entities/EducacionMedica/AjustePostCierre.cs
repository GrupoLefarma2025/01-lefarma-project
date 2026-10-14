namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Bitácora de ajustes post-cierre (ADR-00010): cambios puntuales de fecha/hora/logística
/// sobre rutas Cerrada y talleres Autorizado/Programado, sin re-ejecutar el workflow ni
/// firma. Permiso exclusivo del CEM + motivo obligatorio; valores antes/después en JSON.
/// También audita la cancelación de versión (CANCELAR_VERSION).
/// </summary>
public class AjustePostCierre
{
    public const string EntidadRutaVisita = "RUTA_VISITA";
    public const string EntidadRutaVersion = "RUTA_VERSION";
    public const string EntidadTaller = "TALLER";

    public const string AccionMoverVisita = "MOVER_VISITA";
    public const string AccionEditarHoras = "EDITAR_HORAS";
    public const string AccionAltaVisita = "ALTA_VISITA";
    public const string AccionBajaVisita = "BAJA_VISITA";
    public const string AccionEditarTaller = "EDITAR_TALLER";
    public const string AccionCancelarVersion = "CANCELAR_VERSION";

    public int IdAjuste { get; set; }
    public string EntidadTipo { get; set; } = string.Empty;
    public int IdEntidad { get; set; }
    public string Accion { get; set; } = string.Empty;
    public string? ValoresAntes { get; set; }
    public string? ValoresDespues { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public int IdUsuario { get; set; }
    public DateTime FechaAjuste { get; set; }
}
