namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class TallerMaterial
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
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public string? FirmaUrl { get; set; }
    public DateTime? FechaRecepcion { get; set; }
    public int? IdUsuarioRecepcion { get; set; }

    public virtual Taller? Taller { get; set; }
}
