using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

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
    public bool Confirmado { get; set; }
}

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

public class ConfirmarMaterialRequest
{
    [MaxLength(200)]
    public string? NombreEjecutivoRecepcion { get; set; }
}

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

public class CambiarEstadoTallerRequest
{
    [Required(ErrorMessage = "El nuevo estado es obligatorio.")]
    [MaxLength(15)]
    public string NuevoEstado { get; set; } = string.Empty;

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

public class TallerSolicitudCambioResumenDto
{
    public int IdSolicitud { get; set; }
    public string? DatosJson { get; set; }
    public int? IdSolicitante { get; set; }
    public string? NombreSolicitante { get; set; }
    public DateTime Fecha { get; set; }
}

public class CrearSolicitudCambioRequest
{
    [Required(ErrorMessage = "El motivo de la solicitud es obligatorio.")]
    [MinLength(5, ErrorMessage = "El motivo de la solicitud es obligatorio.")]
    [MaxLength(500)]
    public string Motivo { get; set; } = string.Empty;

    public DateOnly? FechaVisita { get; set; }
    public DateOnly? FechaTaller { get; set; }
    public TimeOnly? HoraTaller { get; set; }

    [MaxLength(200)]
    public string? Lugar { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "El n�mero de participantes no puede ser negativo.")]
    public int? NumeroParticipantes { get; set; }
    public int? IdEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
}

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
