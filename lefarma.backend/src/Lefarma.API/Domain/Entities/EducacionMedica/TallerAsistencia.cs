namespace Lefarma.API.Domain.Entities.EducacionMedica;

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
