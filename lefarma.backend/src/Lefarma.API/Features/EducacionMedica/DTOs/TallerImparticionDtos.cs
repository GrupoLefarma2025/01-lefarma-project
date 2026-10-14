using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

// ----- Material (FOR-007, 1:1) -----

/// <summary>Material del taller (FOR-007) con la confirmación de recepción del EV.</summary>
public class TallerMaterialDto
{
    public int IdTallerMaterial { get; set; }
    public int IdTaller { get; set; }
    public DateOnly? FechaEntrega { get; set; }
    public string? CargoPuesto { get; set; }
    public string? NombreProducto { get; set; }
    public int? CantidadProducto { get; set; }
    public bool? IncluyeListaAsistencia { get; set; }
    public bool? IncluyeFlayers { get; set; }
    public bool? IncluyeEquipoComputo { get; set; }
    public bool? IncluyeProyector { get; set; }
    public bool? IncluyeDulces { get; set; }
    public bool? IncluyeModeloAnatomico { get; set; }
    public string? NombreEjecutivoRecepcion { get; set; }
    public string? Observaciones { get; set; }
    public string? FirmaUrl { get; set; }
    public DateTime? FechaRecepcion { get; set; }
    public int? IdUsuarioRecepcion { get; set; }
    public string? NombreUsuarioRecepcion { get; set; }
    /// <summary>true cuando el EV ya confirmó la recepción (firma + fecha + usuario).</summary>
    public bool Confirmado { get; set; }
}

/// <summary>Registro/edición de la entrega de material por el AEM (FOR-007).</summary>
public class GuardarTallerMaterialRequest
{
    public DateOnly? FechaEntrega { get; set; }

    [MaxLength(120)]
    public string? CargoPuesto { get; set; }

    [MaxLength(160)]
    public string? NombreProducto { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "La cantidad no puede ser negativa.")]
    public int? CantidadProducto { get; set; }

    public bool? IncluyeListaAsistencia { get; set; }
    public bool? IncluyeFlayers { get; set; }
    public bool? IncluyeEquipoComputo { get; set; }
    public bool? IncluyeProyector { get; set; }
    public bool? IncluyeDulces { get; set; }
    public bool? IncluyeModeloAnatomico { get; set; }

    [MaxLength(200)]
    public string? NombreEjecutivoRecepcion { get; set; }

    [MaxLength(500)]
    public string? Observaciones { get; set; }
}

/// <summary>Confirmación de recepción del material por el EV (firma + fecha + usuario del perfil).</summary>
public class ConfirmarMaterialRequest
{
    [MaxLength(200)]
    public string? NombreEjecutivoRecepcion { get; set; }
}

// ----- Asistencias (FOR-008, 1:N máx. 20) -----

public class TallerAsistenciaDto
{
    public int IdAsistencia { get; set; }
    public int IdTaller { get; set; }
    public int Numero { get; set; }
    public string NombreMedico { get; set; } = string.Empty;
    public string? CedulaProfesional { get; set; }
    public string? PuestoMedico { get; set; }
    public string? TelefonoCelular { get; set; }
    public string? CorreoElectronico { get; set; }
    public string? Observaciones { get; set; }
}

public class GuardarTallerAsistenciaRequest
{
    [Range(1, 20, ErrorMessage = "El número en la lista debe estar entre 1 y 20.")]
    public int Numero { get; set; }

    [Required(ErrorMessage = "El nombre del médico es obligatorio.")]
    [MaxLength(150)]
    public string NombreMedico { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? CedulaProfesional { get; set; }

    [MaxLength(120)]
    public string? PuestoMedico { get; set; }

    [MaxLength(30)]
    public string? TelefonoCelular { get; set; }

    [MaxLength(150)]
    [EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
    public string? CorreoElectronico { get; set; }

    [MaxLength(300)]
    public string? Observaciones { get; set; }
}

// ----- Evidencias (1:N) -----

public class TallerEvidenciaDto
{
    public int IdEvidencia { get; set; }
    public int IdTaller { get; set; }
    public string TipoEvidencia { get; set; } = string.Empty;
    public string ArchivoUrl { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public DateOnly? FechaEvidencia { get; set; }
}

public class GuardarTallerEvidenciaRequest
{
    [Required(ErrorMessage = "El tipo de evidencia es obligatorio.")]
    [MaxLength(10)]
    public string TipoEvidencia { get; set; } = string.Empty;

    [Required(ErrorMessage = "El archivo es obligatorio.")]
    [MaxLength(500)]
    public string ArchivoUrl { get; set; } = string.Empty;

    [MaxLength(300)]
    public string? Descripcion { get; set; }

    public DateOnly? FechaEvidencia { get; set; }
}

// ----- Estados del taller (ADR-00008 revisado) -----

/// <summary>Transición manual del taller: EnCurso, Realizado o Cancelado (solo transiciones permitidas).</summary>
public class CambiarEstadoTallerRequest
{
    [Required(ErrorMessage = "El nuevo estado es obligatorio.")]
    [MaxLength(15)]
    public string NuevoEstado { get; set; } = string.Empty;

    /// <summary>Motivo obligatorio en cancelaciones.</summary>
    [MaxLength(500)]
    public string? Motivo { get; set; }
}

public class TallerEstadoHistorialDto
{
    public int IdHistorial { get; set; }
    public string? EstadoAnterior { get; set; }
    public string EstadoNuevo { get; set; } = string.Empty;
    public string Origen { get; set; } = string.Empty;
    public string? Motivo { get; set; }
    public int? IdUsuario { get; set; }
    public string? NombreUsuario { get; set; }
    public DateTime Fecha { get; set; }
}

// ----- Imprimibles (FOR-007 / FOR-008) -----

public class TallerDocumentoMaterialDto
{
    public TallerDto Taller { get; set; } = null!;
    public TallerMaterialDto? Material { get; set; }
}

public class TallerDocumentoAsistenciaDto
{
    public TallerDto Taller { get; set; } = null!;
    public List<TallerAsistenciaDto> Asistencias { get; set; } = [];
}

// ----- Solicitudes de cambio del equipo (ADR-00010, decisiones 13-15) -----

/// <summary>Resumen de la solicitud pendiente que el DTO del taller expone por join (sin listado aparte).</summary>
public class TallerSolicitudCambioResumenDto
{
    public int IdSolicitud { get; set; }
    public string? DatosJson { get; set; }
    public int? IdSolicitante { get; set; }
    public string? NombreSolicitante { get; set; }
    public DateTime Fecha { get; set; }
}

/// <summary>Solicitud de cambio del equipo (diff antes/después + motivo en datos_json).</summary>
public class CrearSolicitudCambioRequest
{
    [Required(ErrorMessage = "El motivo de la solicitud es obligatorio.")]
    [MinLength(5, ErrorMessage = "El motivo de la solicitud es obligatorio.")]
    [MaxLength(500)]
    public string Motivo { get; set; } = string.Empty;

    public DateOnly? FechaTaller { get; set; }
    public TimeOnly? HoraTaller { get; set; }

    [MaxLength(200)]
    public string? Lugar { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "El número de participantes no puede ser negativo.")]
    public int? NumeroParticipantes { get; set; }
}

/// <summary>Resolución del CEM sobre una solicitud: aprobar (aplica el ajuste) o rechazar (solo motivo).</summary>
public class ResolverSolicitudCambioRequest
{
    public bool Aprobar { get; set; }

    [Required(ErrorMessage = "El motivo de la resolución es obligatorio.")]
    [MinLength(5, ErrorMessage = "El motivo de la resolución es obligatorio.")]
    [MaxLength(500)]
    public string Motivo { get; set; } = string.Empty;
}

public class TallerSolicitudCambioDto
{
    public int IdSolicitud { get; set; }
    public int IdTaller { get; set; }
    public string Estado { get; set; } = string.Empty;
    public string? DatosJson { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public string? NombreUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
    public string? NombreUsuarioModificacion { get; set; }
}
