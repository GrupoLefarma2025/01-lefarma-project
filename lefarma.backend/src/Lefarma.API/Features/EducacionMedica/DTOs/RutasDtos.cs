using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class RutaDto
{
    public int IdRuta { get; set; }
    public int IdSeleccionMensual { get; set; }
    public int IdEquipo { get; set; }
    public string NombreEquipo { get; set; } = string.Empty;
    public int Version { get; set; }
    public string? Nombre { get; set; }
    public string Estado { get; set; } = string.Empty;
    public DateTime? FechaConfirmacion { get; set; }
    public List<RutaVisitaDto> Visitas { get; set; } = [];
}

public class RutaVisitaDto
{
    public int IdRutaVisita { get; set; }
    public int IdRuta { get; set; }
    public int IdSeleccionHospital { get; set; }
    public int? IdHospital { get; set; }
    public string? NombreHospital { get; set; }
    public DateOnly FechaVisita { get; set; }
    public int Orden { get; set; }
    public bool EsForanea { get; set; }
    public int? IdRegion { get; set; }
    public string? NombreRegion { get; set; }

    /// <summary>Aviso de intervención humana (p. ej. alta manual de hospital sin región/equipo asignado).</summary>
    public string? Aviso { get; set; }
}

public class GenerarRutasRequest
{
    /// <summary>
    /// Criterio de empaque del draft: "ciudad" (bloques por localidad, no fragmenta
    /// ciudades entre días) o "centroide" (orden clásico por distancia al centroide
    /// regional, llena los días al máximo aunque mezcle ciudades). Default: "ciudad".
    /// </summary>
    public string? Estrategia { get; set; }
}

public class GenerarRutasResponse
{
    public int Version { get; set; }
    public string Estrategia { get; set; } = string.Empty;
    public List<RutaDto> Rutas { get; set; } = [];
    public List<string> Avisos { get; set; } = [];
}

public class MoverVisitaRequest
{
    [Required(ErrorMessage = "La fecha de visita es obligatoria.")]
    public DateOnly FechaVisita { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "El orden debe ser mayor a cero.")]
    public int Orden { get; set; }
}

public class AgregarVisitaRequest
{
    [Required(ErrorMessage = "El hospital seleccionado es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El hospital seleccionado es obligatorio.")]
    public int IdSeleccionHospital { get; set; }

    [Required(ErrorMessage = "La fecha de visita es obligatoria.")]
    public DateOnly FechaVisita { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "El orden debe ser mayor a cero.")]
    public int Orden { get; set; }
}

public class CancelarRutasRequest
{
    [Required(ErrorMessage = "El motivo de la cancelación es obligatorio.")]
    [MinLength(5, ErrorMessage = "El motivo de la cancelación es obligatorio.")]
    public string Motivo { get; set; } = string.Empty;
}

public class AsignacionDto
{
    public int IdRutaVisita { get; set; }
    public int IdRuta { get; set; }
    public string? NombreRuta { get; set; }
    public int IdSeleccionMensual { get; set; }
    public DateOnly FechaVisita { get; set; }
    public int Orden { get; set; }
    public int? IdHospital { get; set; }
    public string? NombreHospital { get; set; }
    public string? NombreRegion { get; set; }
}
