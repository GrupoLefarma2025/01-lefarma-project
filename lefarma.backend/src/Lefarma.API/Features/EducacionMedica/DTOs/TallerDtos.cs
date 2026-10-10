using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

/// <summary>Recurso del taller tal como lo ve la SPA (FOR-005 "Costo por Recurso").</summary>
public class TallerRecursoDto
{
    public int IdTallerRecurso { get; set; }
    public string TipoRecurso { get; set; } = string.Empty;
    public string? IdProducto { get; set; }
    /// <summary>Nombre visible del producto (catálogo Asokam); solo para recursos tipo Producto.</summary>
    public string? NombreProducto { get; set; }
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
    /// <summary>Fecha real de cierre (estado Realizado; ADR-00008).</summary>
    public DateOnly? FechaRealizado { get; set; }
    /// <summary>1 = taller extraordinario (ADR-00011): hospital del catálogo fuera de la selección.</summary>
    public bool EsExtraordinario { get; set; }
    public string? MotivoExtraordinario { get; set; }
    /// <summary>"Capturado por" cuando el usuario no pertenece al equipo (captura asistida CEM; ADR-00011).</summary>
    public int? IdUsuarioCreacion { get; set; }
    public string? CapturadoPor { get; set; }
    /// <summary>Solicitud de cambio pendiente del equipo (join; ADR-00010 decisión 15).</summary>
    public TallerSolicitudCambioResumenDto? SolicitudCambioPendiente { get; set; }
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
    /// <summary>0 = captura abierta; 1 = captura bloqueada (generada por el equipo).</summary>
    public bool EsBloqueado { get; set; }
    public DateTime? FechaBloqueo { get; set; }
    public DateTime? FechaDesbloqueo { get; set; }
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
    public string? NombreEjecutivo { get; set; }
    public string? NombreEspecialista { get; set; }
    public DateOnly Periodo { get; set; }
    public MatrizIndividualDto? Matriz { get; set; }
    /// <summary>Estado real del workflow de la matriz general (la entidad que firman GV→AEM→CA→DC).</summary>
    public string? EstadoMatrizGeneral { get; set; }
    /// <summary>Color del estado del workflow (catálogo config.workflow_estados).</summary>
    public string? EstadoMatrizGeneralColor { get; set; }
    /// <summary>Paso actual del workflow de la matriz general.</summary>
    public string? PasoActualMatrizGeneral { get; set; }
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
    /// <summary>Hospital de la selección; obligatorio en el modo normal (null en extraordinario).</summary>
    [Range(1, int.MaxValue, ErrorMessage = "El hospital de la selección es obligatorio.")]
    public int? IdSeleccionHospital { get; set; }

    /// <summary>Equipo explícito para la captura asistida del CEM (ADR-00011); null = el del hospital.</summary>
    public int? IdEquipo { get; set; }

    /// <summary>Modo extraordinario (ADR-00011): hospital del catálogo fuera de la selección.</summary>
    public bool EsExtraordinario { get; set; }

    /// <summary>Hospital del catálogo Asokam; obligatorio en el modo extraordinario.</summary>
    public int? IdHospital { get; set; }

    /// <summary>Motivo obligatorio del taller extraordinario.</summary>
    [MaxLength(500)]
    public string? MotivoExtraordinario { get; set; }

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

    /// <summary>Motivo del ajuste post-cierre (obligatorio con el taller Autorizado/Programado; ADR-00010).</summary>
    [MaxLength(500)]
    public string? Motivo { get; set; }

    public List<GuardarTallerRecursoRequest>? Recursos { get; set; }
}
