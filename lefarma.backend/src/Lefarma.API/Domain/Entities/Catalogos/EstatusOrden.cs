using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos {
public class EstatusOrden
    {
        public int IdEstatusOrden { get; set; }
        public string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public int? SiguienteEstatusId { get; set; }
        public bool RequiereAccion { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }

        [ForeignKey("SiguienteEstatusId")]
        public virtual EstatusOrden? SiguienteEstatus { get; set; }
    }
}
