using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos;

[Table("proveedor_forma_pago_cuentas", Schema = "staging")]
public class StagingProveedorFormaPagoCuenta
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int IdStagingCuenta { get; set; }

    [Required]
    public int IdStaging { get; set; }

    [Required]
    public int IdFormaPago { get; set; }

    [ForeignKey(nameof(IdFormaPago))]
    public FormaPago? FormaPago { get; set; }

    public int? IdBanco { get; set; }

    [ForeignKey(nameof(IdBanco))]
    public Banco? Banco { get; set; }

    [MaxLength(50)]
    public string? NumeroCuenta { get; set; }

    [MaxLength(18)]
    public string? Clabe { get; set; }

    [MaxLength(50)]
    public string? NumeroTarjeta { get; set; }

    [MaxLength(200)]
    public string? Beneficiario { get; set; }

    [MaxLength(200)]
    public string? CorreoNotificacion { get; set; }

    public bool Activo { get; set; } = true;

    [ForeignKey(nameof(IdStaging))]
    public StagingProveedor? StagingProveedor { get; set; }
}
