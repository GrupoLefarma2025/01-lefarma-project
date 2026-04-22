using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos;

[Table("proveedores", Schema = "staging")]
public class StagingProveedor
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int IdStaging { get; set; }

    [Required]
    public int IdProveedor { get; set; }

    [Required]
    [MaxLength(255)]
    public string RazonSocial { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? RazonSocialNormalizada { get; set; }

    [MaxLength(13)]
    public string? RFC { get; set; }

    [MaxLength(10)]
    public string? CodigoPostal { get; set; }

    public int? RegimenFiscalId { get; set; }

    [ForeignKey(nameof(RegimenFiscalId))]
    public RegimenFiscal? RegimenFiscal { get; set; }

    [MaxLength(10)]
    public string? UsoCfdi { get; set; }

    public bool SinDatosFiscales { get; set; }

    public int Estatus { get; set; } = 1;
    public int? CambioEstatusPor { get; set; }
    public DateTime FechaRegistro { get; set; }
    public DateTime? FechaModificacion { get; set; }
    public DateTime FechaStaging { get; set; } = DateTime.UtcNow;
    public int? EditadoPor { get; set; }

    public StagingProveedorDetalle? Detalle { get; set; }

    public ICollection<StagingProveedorFormaPagoCuenta> CuentasFormaPago { get; set; } = new List<StagingProveedorFormaPagoCuenta>();
}
