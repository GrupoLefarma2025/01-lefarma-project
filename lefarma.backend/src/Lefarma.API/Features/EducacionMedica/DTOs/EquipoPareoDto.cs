namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class EquipoPareoDto
{
    public int IdEquipo { get; set; }
    public int IdRegion { get; set; }
    public string? NombreRegion { get; set; }
    public int IdEjecutivo { get; set; }
    public string NombreEjecutivo { get; set; } = string.Empty;
    public int IdEspecialista { get; set; }
    public string NombreEspecialista { get; set; } = string.Empty;
    public DateOnly FechaInicio { get; set; }
    public DateOnly? FechaFin { get; set; }
    public bool Activo { get; set; }
    public List<string> RegionesActuales { get; set; } = [];
}
