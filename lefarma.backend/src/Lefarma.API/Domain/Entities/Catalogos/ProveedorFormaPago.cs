using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Domain.Entities.Catalogos;

public class ProveedorFormaPago
{
    [Key]
    public int IdVinculacion { get; set; }
    public int IdProveedor { get; set; }
    public int IdFormaPago { get; set; }
    public DateTime FechaCreacion { get; set; }

    public virtual Proveedor Proveedor { get; set; } = null!;
    public virtual FormaPago FormaPago { get; set; } = null!;
}
