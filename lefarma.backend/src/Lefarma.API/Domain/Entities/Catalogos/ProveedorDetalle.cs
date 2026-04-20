using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos;

public class ProveedorDetalle
{
    public int IdDetalle { get; set; }
    public int IdProveedor { get; set; }
    public string? PersonaContactoNombre { get; set; }
    public string? ContactoTelefono { get; set; }
    public string? ContactoEmail { get; set; }
    public string? Comentario { get; set; }
    public string? CaratulaPath { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaModificacion { get; set; }

    [ForeignKey("IdProveedor")]
    public virtual Proveedor Proveedor { get; set; } = null!;
}
