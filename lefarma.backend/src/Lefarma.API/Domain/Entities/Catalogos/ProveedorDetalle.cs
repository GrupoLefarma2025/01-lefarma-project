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

    /// <summary>
    /// OBSOLETO: la carátula ahora vive por cuenta en
    /// <see cref="ProveedorFormaPagoCuenta.CaratulaPath"/>. Conservada sólo para
    /// rollback/migración (la migration 025 copió los valores legacy a la primer
    /// cuenta activa). No escribir ni leer en código nuevo.
    /// </summary>
    [Obsolete("Use ProveedorFormaPagoCuenta.CaratulaPath instead. Scheduled for removal after caratulas-proveedor migration completes.")]
    public string? CaratulaPath { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaModificacion { get; set; }

    [ForeignKey("IdProveedor")]
    public virtual Proveedor Proveedor { get; set; } = null!;
}
