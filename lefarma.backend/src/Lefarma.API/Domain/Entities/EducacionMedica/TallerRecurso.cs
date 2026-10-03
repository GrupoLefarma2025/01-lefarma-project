namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Recurso polimórfico del taller (FOR-005 "Costo por Recurso"): muestras/producto,
/// folletos, envío y box lunch (una fila por tipo). El subtotal lo calcula el servicio
/// (cantidad × costo_unitario); el costo lo captura el AEM en el paso de costos (ADR-00007).
/// </summary>
public class TallerRecurso
{
    public const string RecursoProducto = "Producto";
    public const string RecursoFolleto = "Folleto";
    public const string RecursoEnvio = "Envio";
    public const string RecursoBoxLunch = "BoxLunch";

    public static readonly string[] TiposValidos = [RecursoProducto, RecursoFolleto, RecursoEnvio, RecursoBoxLunch];

    public int IdTallerRecurso { get; set; }
    public int IdTaller { get; set; }
    public string TipoRecurso { get; set; } = RecursoProducto;
    public string? IdProducto { get; set; }
    public string? Descripcion { get; set; }
    public string? TipoEnvio { get; set; }
    public int? Cantidad { get; set; }
    public decimal? CostoUnitario { get; set; }
    public decimal? Subtotal { get; set; }
    public string? Observaciones { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public virtual Taller? Taller { get; set; }
}
