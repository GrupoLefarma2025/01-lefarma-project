using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos {
public class CuentaContable
    {
        public int IdCuentaContable { get; set; }
        public string Cuenta { get; set; } = null!;
        public string Descripcion { get; set; } = null!;
        public string? DescripcionNormalizada { get; set; }
        public string Nivel1 { get; set; } = null!;
        public string Nivel2 { get; set; } = null!;
        public int? IdEmpresa { get; set; }
        public int? CentroCostoId { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

        [ForeignKey("CentroCostoId")]
        public virtual CentroCosto? CentroCosto { get; set; }

        [ForeignKey("IdEmpresa")]
        public virtual Empresa? Empresa { get; set; }
    }
}
