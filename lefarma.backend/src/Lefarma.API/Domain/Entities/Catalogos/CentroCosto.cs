using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos {
public class CentroCosto
    {
        public int IdCentroCosto { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; }
        public string? Descripcion { get; set; }
        public string? DescripcionNormalizada { get; set; }
        public decimal? LimitePresupuesto { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }
}
