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
    public int CargaMes { get; set; }
    public bool TieneDiaConsecutivo { get; set; }
    public bool MismaInstitucion { get; set; }
    public string? Institucion { get; set; }
    public string? Region { get; set; }
    public bool HaVisitadoHospital { get; set; }
    public int VisitasRealizadasHospital { get; set; }
    public DateOnly? UltimaVisitaHospital { get; set; }
    public bool HaVisitadoInstitucion { get; set; }
    public int VisitasRealizadasInstitucion { get; set; }
    public DateOnly? UltimaVisitaInstitucion { get; set; }
    public bool HaVisitadoCiudad { get; set; }
    public int VisitasRealizadasCiudad { get; set; }
    public DateOnly? UltimaVisitaCiudad { get; set; }
    public bool HaVisitadoRegion { get; set; }
    public int VisitasRealizadasRegion { get; set; }
    public DateOnly? UltimaVisitaRegion { get; set; }
    public string Motivo { get; set; } = string.Empty;
}
