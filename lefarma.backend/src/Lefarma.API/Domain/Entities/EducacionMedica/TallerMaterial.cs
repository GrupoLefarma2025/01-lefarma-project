namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Material del taller (FOR-007, 1:1 con talleres): paquete que el AEM entrega y el
/// EV confirma con firma digital (firma_url + fecha_recepcion + id_usuario_recepcion,
/// patrón bitácora del motor). ADR-00008.
/// </summary>
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

    /// <summary>Firma digital del EV al confirmar la recepción (URL/archivo de su firma de perfil).</summary>
    public string? FirmaUrl { get; set; }
    /// <summary>Fecha y hora de la confirmación de recepción por el EV.</summary>
    public DateTime? FechaRecepcion { get; set; }
    /// <summary>Usuario (EV) que confirmó la recepción.</summary>
    public int? IdUsuarioRecepcion { get; set; }

    public virtual Taller? Taller { get; set; }
}
