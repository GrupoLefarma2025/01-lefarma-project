namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Taller medico (aggregate root, ADR-00001 §1.2.6): una fila por taller con
/// hospital/ubicacion, logistica de la Matriz (FOR-005/006/008) y estado del
/// ciclo de firmas del papel. El factor cobertura_taller del ranking lee
/// estado = Realizado por id_hospital.
/// </summary>
public class Taller
{
    public const string EstadoCreada = "Creada";
    public const string EstadoElaborado = "Elaborado";
    public const string EstadoRevisado = "Revisado";
    public const string EstadoAutorizado = "Autorizado";
    public const string EstadoProgramado = "Programado";
    public const string EstadoEnCurso = "EnCurso";
    public const string EstadoRealizado = "Realizado";
    public const string EstadoCancelado = "Cancelado";

    public static readonly string[] EstadosValidos =
    [
        EstadoCreada, EstadoElaborado, EstadoRevisado, EstadoAutorizado,
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
    public string Estado { get; set; } = EstadoCreada;
    public string? Observaciones { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    // Matriz de talleres (ADR-00007): enlaces a la matriz individual (equipo + mes) y general (gerencia + mes)
    public int? IdMatrizIndividual { get; set; }
    public int? IdMatrizGeneral { get; set; }

    /// <summary>Fecha real de cierre del taller (estado Realizado); indicadores/cobertura (ADR-00008).</summary>
    public DateOnly? FechaRealizado { get; set; }
    /// <summary>1 = taller extraordinario (ADR-00011): hospital del catálogo fuera de la selección.</summary>
    public bool EsExtraordinario { get; set; }
    /// <summary>Motivo obligatorio del taller extraordinario (imprevisto operativo).</summary>
    public string? MotivoExtraordinario { get; set; }

    public virtual MatrizIndividual? MatrizIndividual { get; set; }
    public virtual MatrizGeneral? MatrizGeneral { get; set; }
    public virtual ICollection<TallerRecurso> Recursos { get; set; } = new List<TallerRecurso>();
    public virtual TallerMaterial? Material { get; set; }
    public virtual ICollection<TallerAsistencia> Asistencias { get; set; } = new List<TallerAsistencia>();
    public virtual ICollection<TallerEvidencia> Evidencias { get; set; } = new List<TallerEvidencia>();
    public virtual ICollection<TallerEstadoHistorial> EstadosHistorial { get; set; } = new List<TallerEstadoHistorial>();
}
