using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

/// <summary>Recurso del taller tal como lo ve la SPA (FOR-005 "Costo por Recurso").</summary>
public class TallerRecursoDto
{
    public int IdTallerRecurso { get; set; }
    public string TipoRecurso { get; set; } = string.Empty;
    public string? IdProducto { get; set; }
    public string? Descripcion { get; set; }
    public string? TipoEnvio { get; set; }
    public int? Cantidad { get; set; }
    public decimal? CostoUnitario { get; set; }
    public decimal? Subtotal { get; set; }
    public string? Observaciones { get; set; }
}

/// <summary>Taller de la Matriz (FOR-005), con sus recursos.</summary>
public class TallerDto
{
    public int IdTaller { get; set; }
    public int? IdSeleccionHospital { get; set; }
    public int? IdHospital { get; set; }
    public string? NombreHospital { get; set; }
    public string? Region { get; set; }
    public string? EntidadFederativa { get; set; }
    public string? CiudadMunicipio { get; set; }
    public int? NumeroParticipantes { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public string? UnidadMedica { get; set; }
    public string? Lugar { get; set; }
    public DateOnly? FechaTaller { get; set; }
    public TimeOnly? HoraTaller { get; set; }
    public bool? RequiereEquipoProyeccion { get; set; }
    public string? TipoEquipoProyeccion { get; set; }
    public string Estado { get; set; } = string.Empty;
    public string? Observaciones { get; set; }
    public int? IdMatrizIndividual { get; set; }
    public int? IdMatrizGeneral { get; set; }
    public List<TallerRecursoDto> Recursos { get; set; } = [];
    /// <summary>Suma de los subtotales de los recursos (calculada en el servicio).</summary>
    public decimal CostoTotal { get; set; }
}

/// <summary>Matriz individual de un equipo de pareo (equipo + mes).</summary>
public class MatrizIndividualDto
{
    public int IdMatrizIndividual { get; set; }
    public int IdEquipo { get; set; }
    public DateOnly Periodo { get; set; }
    public string Estado { get; set; } = string.Empty;
    public DateTime? FechaGeneracion { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public int TotalTalleres { get; set; }
}

/// <summary>Respuesta de "Mis talleres": equipo, matriz individual del mes y talleres capturados.</summary>
public class MisTalleresResponse
{
    public int? IdEquipo { get; set; }
    public string? NombreRegion { get; set; }
    public DateOnly Periodo { get; set; }
    public MatrizIndividualDto? Matriz { get; set; }
    public List<TallerDto> Talleres { get; set; } = [];
}

/// <summary>Recurso capturado por el equipo (sin costos; los costos los registra el AEM).</summary>
public class GuardarTallerRecursoRequest
{
    [Required(ErrorMessage = "El tipo de recurso es obligatorio.")]
    [MaxLength(15)]
    public string TipoRecurso { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? IdProducto { get; set; }

    [MaxLength(200)]
    public string? Descripcion { get; set; }

    [MaxLength(10)]
    public string? TipoEnvio { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "La cantidad no puede ser negativa.")]
    public int? Cantidad { get; set; }

    [MaxLength(300)]
    public string? Observaciones { get; set; }
}

/// <summary>Alta de un taller (campos FOR-005 1–12; hospital/región se derivan de la selección).</summary>
public class CrearTallerRequest
{
    [Required(ErrorMessage = "El hospital de la selección es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El hospital de la selección es obligatorio.")]
    public int IdSeleccionHospital { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "El número de participantes no puede ser negativo.")]
    public int? NumeroParticipantes { get; set; }

    [MaxLength(160)]
    public string? UnidadMedica { get; set; }

    [MaxLength(200)]
    public string? Lugar { get; set; }

    public DateOnly? FechaTaller { get; set; }
    public TimeOnly? HoraTaller { get; set; }
    public bool? RequiereEquipoProyeccion { get; set; }

    [MaxLength(10)]
    public string? TipoEquipoProyeccion { get; set; }

    [MaxLength(500)]
    public string? Observaciones { get; set; }

    public List<GuardarTallerRecursoRequest>? Recursos { get; set; }
}

/// <summary>Edición de un taller (la liga a la selección/hospital no cambia).</summary>
public class ActualizarTallerRequest
{
    [Range(0, int.MaxValue, ErrorMessage = "El número de participantes no puede ser negativo.")]
    public int? NumeroParticipantes { get; set; }

    [MaxLength(160)]
    public string? UnidadMedica { get; set; }

    [MaxLength(200)]
    public string? Lugar { get; set; }

    public DateOnly? FechaTaller { get; set; }
    public TimeOnly? HoraTaller { get; set; }
    public bool? RequiereEquipoProyeccion { get; set; }

    [MaxLength(10)]
    public string? TipoEquipoProyeccion { get; set; }

    [MaxLength(500)]
    public string? Observaciones { get; set; }

    public List<GuardarTallerRecursoRequest>? Recursos { get; set; }
}
