namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Taller medico (aggregate root, ADR-00001 §1.2.6): una fila por taller con
/// hospital/ubicacion, logistica de la Matriz (FOR-005/006/008) y estado del
/// ciclo de firmas del papel. El factor cobertura_taller del ranking lee
/// estado = Realizado por id_hospital.
/// </summary>
public class Taller
{
    public const string EstadoBorrador = "Borrador";
    public const string EstadoElaborado = "Elaborado";
    public const string EstadoRevisado = "Revisado";
    public const string EstadoAutorizado = "Autorizado";
    public const string EstadoProgramado = "Programado";
    public const string EstadoEnCurso = "EnCurso";
    public const string EstadoRealizado = "Realizado";
    public const string EstadoCancelado = "Cancelado";

    public static readonly string[] EstadosValidos =
    [
        EstadoBorrador, EstadoElaborado, EstadoRevisado, EstadoAutorizado,
        EstadoProgramado, EstadoEnCurso, EstadoRealizado, EstadoCancelado,
    ];

    public int IdTaller { get; set; }
    public int? IdSeleccionHospital { get; set; }
    public int? IdHospital { get; set; }
    public string? Region { get; set; }
    public string? EntidadFederativa { get; set; }
    public string? CiudadMunicipio { get; set; }
    public int? NumeroParticipantes { get; set; }
    public int? IdEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? UnidadMedica { get; set; }
    public string? Lugar { get; set; }
    public DateOnly? FechaTaller { get; set; }
    public TimeOnly? HoraTaller { get; set; }
    public bool? RequiereEquipoProyeccion { get; set; }
    public string? TipoEquipoProyeccion { get; set; }
    public string Estado { get; set; } = EstadoBorrador;
    public string? Observaciones { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
}
