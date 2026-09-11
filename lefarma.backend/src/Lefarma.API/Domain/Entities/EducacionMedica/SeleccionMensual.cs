namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class SeleccionMensual
{
    public const string EstadoBorrador = "Borrador";
    public const string EstadoEnRevision = "EnRevision";
    public const string EstadoAutorizada = "Autorizada";
    public const string EstadoCerrada = "Cerrada";

    public int IdSeleccionMensual { get; set; }
    public DateOnly FechaSeleccion { get; set; }
    public int? IdTipoGerencia { get; set; }
    public DateOnly? FechaInicioVigencia { get; set; }
    public DateOnly? FechaFinVigencia { get; set; }
    public int? TalleresObjetivoMes { get; set; }
    public string Estado { get; set; } = EstadoBorrador;
    public DateTime? FirmaGvFecha { get; set; }
    public DateTime? FirmaGgFecha { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
}
