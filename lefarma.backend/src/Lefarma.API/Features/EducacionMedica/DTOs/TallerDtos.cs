using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class TallerRecursoDto
{
    public int IdTallerRecurso { get; set; }
    public string TipoRecurso { get; set; } = string.Empty;
    public string? IdProducto { get; set; }
    public string? NombreProducto { get; set; }
    public string? Descripcion { get; set; }
    public string? TipoEnvio { get; set; }
    public int? Cantidad { get; set; }
    public decimal? CostoUnitario { get; set; }
    public decimal? Subtotal { get; set; }
    public string? Observaciones { get; set; }
}

public class TallerDto
{
    public int IdTaller { get; set; }
    public int? IdRutaVisita { get; set; }
    public int? IdTipoVisita { get; set; }
    public string? TipoVisita { get; set; }
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
    public string? Tema { get; set; }
    public DateOnly? FechaRealizado { get; set; }
    public bool EsExtraordinario { get; set; }
    public string? MotivoExtraordinario { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public string? CapturadoPor { get; set; }
    public TallerSolicitudCambioResumenDto? SolicitudCambioPendiente { get; set; }
    public List<TallerRecursoDto> Recursos { get; set; } = [];
    public decimal CostoTotal { get; set; }
}

public class MatrizIndividualDto
{
    public int IdMatrizIndividual { get; set; }
    public int IdEquipo { get; set; }
    public DateOnly Periodo { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public int TotalTalleres { get; set; }
}

public class MisTalleresResponse
{
    public int? IdEquipo { get; set; }
    public string? NombreRegion { get; set; }
    public string? NombreEjecutivo { get; set; }
    public string? NombreEspecialista { get; set; }
    public DateOnly Periodo { get; set; }
    public MatrizIndividualDto? Matriz { get; set; }
    public string? EstadoMatrizGeneral { get; set; }
    public string? EstadoMatrizGeneralColor { get; set; }
    public string? PasoActualMatrizGeneral { get; set; }
    public List<TallerDto> Talleres { get; set; } = [];
}

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

public class CrearTallerRequest
{
    public int? IdRutaVisita { get; set; }

    public int? IdTipoVisita { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "El hospital de la selección es obligatorio.")]
    public int? IdSeleccionHospital { get; set; }

    public int? IdEquipo { get; set; }

    public bool EsExtraordinario { get; set; }

    public int? IdHospital { get; set; }

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

    [MaxLength(500)]
    public string? MotivoAjuste { get; set; }

    public bool? RequiereEquipoProyeccion { get; set; }

    [MaxLength(10)]
    public string? TipoEquipoProyeccion { get; set; }

    [MaxLength(500)]
    public string? Observaciones { get; set; }

[MaxLength(200)]
    public string? Tema { get; set; }
    public List<GuardarTallerRecursoRequest>? Recursos { get; set; }
}

public class ActualizarTallerRequest
{
    public int? IdTipoVisita { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "El n�mero de participantes no puede ser negativo.")]
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

    [MaxLength(200)]
    public string? Tema { get; set; }

    [MaxLength(500)]
    public string? Motivo { get; set; }

    public List<GuardarTallerRecursoRequest>? Recursos { get; set; }
}
