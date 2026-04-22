using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos;

public class Proveedor
{
    public int IdProveedor { get; set; }
    public string RazonSocial { get; set; } = null!;
    public string? RazonSocialNormalizada { get; set; }
    public string? RFC { get; set; }
    public string? CodigoPostal { get; set; }
    public int? RegimenFiscalId { get; set; }
    public string? UsoCfdi { get; set; }
    public bool SinDatosFiscales { get; set; }
    public int Estatus { get; set; } = 1;
    public int? CambioEstatusPor { get; set; }
    public DateTime FechaRegistro { get; set; }
    public DateTime? FechaModificacion { get; set; }

    [ForeignKey("RegimenFiscalId")]
    public virtual RegimenFiscal? RegimenFiscal { get; set; }

    public virtual ICollection<ProveedorFormaPagoCuenta> CuentasFormaPago { get; set; } = new List<ProveedorFormaPagoCuenta>();

    public virtual ProveedorDetalle? Detalle { get; set; }
}
