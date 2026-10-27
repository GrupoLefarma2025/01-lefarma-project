using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class AsignarEspecialistaVisitaRequest
{
    [Required(ErrorMessage = "El especialista es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El especialista es obligatorio.")]
    public int IdEspecialista { get; set; }
}

public class SugerenciaEspecialistaDto
{
    public int IdRutaVisita { get; set; }
    public int? IdHospital { get; set; }
    public string? NombreHospital { get; set; }
    public string? CiudadMunicipio { get; set; }
    public DateOnly FechaVisita { get; set; }
    public int IdEspecialista { get; set; }
    public string NombreEspecialista { get; set; } = string.Empty;
    public int CargaDia { get; set; }
    public int CargaSemana { get; set; }
    public string Motivo { get; set; } = string.Empty;
}
