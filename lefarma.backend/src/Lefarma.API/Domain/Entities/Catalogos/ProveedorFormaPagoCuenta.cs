using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos;

public class ProveedorFormaPagoCuenta
{
    public int IdCuen { get; set; }
    public int IdProveedor { get; set; }
    public int IdFormaPago { get; set; }
    public int? IdBanco { get; set; }
    public string? NumeroCuenta { get; set; }
    public string? Clabe { get; set; }
    public string? NumeroTarjeta { get; set; }
    public string? Beneficiario { get; set; }
    public string? CorreoNotificacion { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaModificacion { get; set; }

    [ForeignKey("IdProveedor")]
    public virtual Proveedor? Proveedor { get; set; }

    [ForeignKey("IdFormaPago")]
    public virtual FormaPago? FormaPago { get; set; }

    [ForeignKey("IdBanco")]
    public virtual Banco? Banco { get; set; }
}
