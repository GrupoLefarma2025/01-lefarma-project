using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos;

[Table("proveedores_detalles", Schema = "staging")]
public class StagingProveedorDetalle
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int IdStagingDetalle { get; set; }

    [Required]
    public int IdStaging { get; set; }

    [Required]
    public int IdDetalle { get; set; }

    [MaxLength(255)]
    public string? PersonaContactoNombre { get; set; }

    [MaxLength(20)]
    public string? ContactoTelefono { get; set; }

    [MaxLength(255)]
    public string? ContactoEmail { get; set; }

    public string? Comentario { get; set; }

    public DateTime? FechaCreacion { get; set; }
    public DateTime? FechaModificacion { get; set; }

    [MaxLength(500)]
    public string? CaratulaPath { get; set; }

    [ForeignKey(nameof(IdStaging))]
    public StagingProveedor? StagingProveedor { get; set; }

    [ForeignKey(nameof(IdDetalle))]
    public ProveedorDetalle? ProveedorDetalle { get; set; }
}
