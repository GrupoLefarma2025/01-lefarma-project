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
    public int? IdSeleccionHospital { get; set; }
    public int? IdHospital { get; set; }
    public string? NombreHospital { get; set; }
    public DateOnly FechaVisita { get; set; }
    public int Orden { get; set; }
    public TimeOnly? HoraSalida { get; set; }
    public TimeOnly? HoraLlegada { get; set; }
    public bool EsForanea { get; set; }
    /// <summary>1 = visita extraordinaria (ADR-00011): hospital del catálogo fuera de la selección.</summary>
    public bool EsExtraordinaria { get; set; }
    public int? IdRegion { get; set; }
    public string? NombreRegion { get; set; }

    /// <summary>Aviso de intervención humana (p. ej. alta manual de hospital sin región/equipo asignado).</summary>
    public string? Aviso { get; set; }

    /// <summary>Avisos no bloqueantes del modo ajuste (p. ej. capacidad 3/día o 8/semana excedida).</summary>
    public List<string> Avisos { get; set; } = [];
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

    /// <summary>Motivo del ajuste post-cierre (obligatorio cuando la versión está Cerrada; ADR-00010).</summary>
    [MaxLength(500)]
    public string? Motivo { get; set; }
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

    /// <summary>Motivo del ajuste post-cierre (obligatorio cuando la versión está Cerrada; ADR-00010).</summary>
    [MaxLength(500)]
    public string? Motivo { get; set; }
}

/// <summary>Edición de horas de una visita (normal en Creada; ajuste auditado en Cerrada; ADR-00010).</summary>
public class EditarHorasVisitaRequest
{
    public TimeOnly? HoraSalida { get; set; }
    public TimeOnly? HoraLlegada { get; set; }

    /// <summary>Motivo del ajuste post-cierre (obligatorio cuando la versión está Cerrada).</summary>
    [MaxLength(500)]
    public string? Motivo { get; set; }
}

/// <summary>Alta de visita extraordinaria: hospital del catálogo (FOR-002) fuera de la selección (ADR-00011).</summary>
public class VisitaExtraordinariaRequest
{
    [Required(ErrorMessage = "El equipo es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El equipo es obligatorio.")]
    public int IdEquipo { get; set; }

    [Required(ErrorMessage = "El hospital del catálogo es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El hospital del catálogo es obligatorio.")]
    public int IdHospital { get; set; }

    [Required(ErrorMessage = "La fecha de visita es obligatoria.")]
    public DateOnly FechaVisita { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "El orden debe ser mayor a cero.")]
    public int? Orden { get; set; }

    [Required(ErrorMessage = "El motivo de la visita extraordinaria es obligatorio.")]
    [MinLength(5, ErrorMessage = "El motivo de la visita extraordinaria es obligatorio.")]
    [MaxLength(500)]
    public string Motivo { get; set; } = string.Empty;
}

/// <summary>
/// Hospital elegible para la captura asistida (ADR-00011): hospitales de la selección del
/// equipo con ruta Cerrada, con snapshots para el buscador.
/// </summary>
public class HospitalElegibleDto
{
    public int IdSeleccionHospital { get; set; }
    public int IdSeleccionMensual { get; set; }
    public int? IdHospital { get; set; }
    public string? NombreHospital { get; set; }
    public string? Region { get; set; }
    public string? EntidadFederativa { get; set; }
    public string? CiudadMunicipio { get; set; }
    public int IdRuta { get; set; }
    public DateOnly FechaVisita { get; set; }
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
    public int? IdSeleccionHospital { get; set; }
    public DateOnly FechaVisita { get; set; }
    public int Orden { get; set; }
    public int? IdHospital { get; set; }
    public string? NombreHospital { get; set; }
    public string? NombreRegion { get; set; }
    public string? EntidadFederativa { get; set; }
    public string? CiudadMunicipio { get; set; }
    public string? Institucion { get; set; }
    /// <summary>1 = visita extraordinaria: hospital del catálogo fuera de la selección (ADR-00011).</summary>
    public bool EsExtraordinaria { get; set; }
    /// <summary>Ubicación del hospital (snapshot de la selección; respaldo del catálogo Asokam).</summary>
    public decimal? Latitud { get; set; }
    public decimal? Longitud { get; set; }
    public string? Calle { get; set; }
    public string? Colonia { get; set; }
    public string? CodigoPostal { get; set; }
    public string? Email { get; set; }
}
