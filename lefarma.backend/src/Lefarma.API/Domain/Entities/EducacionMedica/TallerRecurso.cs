namespace Lefarma.API.Domain.Entities.EducacionMedica;

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
