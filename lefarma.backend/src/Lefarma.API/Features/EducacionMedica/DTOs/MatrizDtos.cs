using System.ComponentModel.DataAnnotations;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

/// <summary>Resumen de una matriz general (lista por gerencia/mes).</summary>
public class MatrizGeneralResumenDto
{
    public int IdMatrizGeneral { get; set; }
    public int IdTipoGerencia { get; set; }
    public string? Gerencia { get; set; }
    public DateOnly Periodo { get; set; }
    public int? IdWorkflow { get; set; }
    public int? IdPasoActual { get; set; }
    public string? PasoNombre { get; set; }
    public int? IdEstado { get; set; }
    public string? EstadoNombre { get; set; }
    public string? EstadoColor { get; set; }
    public int TotalTalleres { get; set; }
    public decimal CostoTotal { get; set; }
}

/// <summary>Detalle de la matriz general: talleres con recursos, totales y acciones del workflow.</summary>
public class MatrizTalleresDetalleDto : MatrizGeneralResumenDto
{
    public bool EsEditable { get; set; }
    public bool EsFinal { get; set; }
    public List<TallerDto> Talleres { get; set; } = [];
    public List<AccionDisponibleResponse> Acciones { get; set; } = [];
}

/// <summary>Panel "Matrices por equipo" de la concentración (estado de cada matriz individual).</summary>
public class ConcentracionEquipoDto
{
    public int IdMatrizIndividual { get; set; }
    public int IdEquipo { get; set; }
    public string? NombreRegion { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public int TotalTalleres { get; set; }
}

/// <summary>Recurso con costo capturado por el AEM en el paso de costos.</summary>
public class GuardarCostoRecursoRequest
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

    [Range(0, 999999999, ErrorMessage = "El costo unitario no puede ser negativo.")]
    public decimal? CostoUnitario { get; set; }

    [MaxLength(300)]
    public string? Observaciones { get; set; }
}

/// <summary>Reemplazo del conjunto de recursos/costos de un taller (paso del AEM).</summary>
public class ActualizarCostosTallerRequest
{
    public List<GuardarCostoRecursoRequest> Recursos { get; set; } = [];
}

/// <summary>Documento imprimible de la matriz (layout FOR-005).</summary>
public class MatrizDocumentoDto
{
    public string Titulo { get; set; } = string.Empty;
    public string? Gerencia { get; set; }
    public DateOnly Periodo { get; set; }
    public string? PasoNombre { get; set; }
    public string? EstadoNombre { get; set; }
    public List<TallerDto> Talleres { get; set; } = [];
    public decimal CostoTotal { get; set; }
    public List<MatrizDocumentoFirmaDto> Firmas { get; set; } = [];
}

public class MatrizDocumentoFirmaDto
{
    public string? PasoNombre { get; set; }
    public int IdUsuario { get; set; }
    public string? NombreUsuario { get; set; }
    public string? Comentario { get; set; }
    public DateTime Fecha { get; set; }
}

/// <summary>Revisión previa al envío de la matriz: cobertura de talleres y avisos no bloqueantes.</summary>
public class MatrizRevisionDto
{
    public int IdMatrizGeneral { get; set; }
    public int IdTipoGerencia { get; set; }
    public string? Gerencia { get; set; }
    public DateOnly Periodo { get; set; }
    public bool CapturaAbierta { get; set; }
    public int? IdSeleccionMensual { get; set; }
    public int? IdRutaVersion { get; set; }
    public int? Version { get; set; }
    public string? EstadoRutaVersion { get; set; }
    public int TotalVisitas { get; set; }
    public int VisitasTipoTaller { get; set; }
    public int VisitasConTaller { get; set; }
    public int VisitasSinTaller { get; set; }
    public int VisitasNoTaller { get; set; }
    public int TotalTalleres { get; set; }
    public int TalleresSinRecursos { get; set; }
    public int TalleresSinCosto { get; set; }
    public int TalleresFueraVersionActiva { get; set; }
    public int TalleresExtraordinarios { get; set; }
    public int SolicitudesPendientes { get; set; }
    public List<VisitaSinTallerDto> VisitasSinTallerDetalle { get; set; } = [];
    public List<AdvertenciaMatrizDto> Advertencias { get; set; } = [];
}

public class VisitaSinTallerDto
{
    public int IdRutaVisita { get; set; }
    public int IdRuta { get; set; }
    public int? IdHospital { get; set; }
    public string? Hospital { get; set; }
    public string? Region { get; set; }
    public DateOnly FechaVisita { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public string? EstadoRuta { get; set; }
}

public class AdvertenciaMatrizDto
{
    public string Codigo { get; set; } = string.Empty;
    public string Severidad { get; set; } = "info";
    public string Mensaje { get; set; } = string.Empty;
    public int Total { get; set; }
}
