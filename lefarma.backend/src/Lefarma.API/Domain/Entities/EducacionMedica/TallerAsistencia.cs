namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Asistente del taller (FOR-008, 1:N máx. 20): la lista se llena a mano en sitio y el
/// equipo la transcribe al sistema; la hoja firmada se adjunta como evidencia del taller
/// (taller_evidencias), sin firma digital por asistente. ADR-00008.
/// </summary>
public class TallerAsistencia
{
    public const int MaximoAsistentes = 20;

    public int IdAsistencia { get; set; }
    public int IdTaller { get; set; }
    public int Numero { get; set; }
    public string NombreMedico { get; set; } = string.Empty;
    public string? CedulaProfesional { get; set; }
    public string? PuestoMedico { get; set; }
    public string? TelefonoCelular { get; set; }
    public string? CorreoElectronico { get; set; }
    public string? Observaciones { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public virtual Taller? Taller { get; set; }
}
