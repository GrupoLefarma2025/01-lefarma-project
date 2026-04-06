using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos {
public class Area
    {
        public int IdArea { get; set; }
        public int IdEmpresa { get; set; }
        public int? IdSupervisorResponsable { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; }
        public string? Descripcion { get; set; }
        public string? DescripcionNormalizada { get; set; }
        public string? Clave { get; set; }
        public int NumeroEmpleados { get; set; }
        public bool Activo { get; set; } 
        public DateTime FechaCreacion { get; set; } 
        public DateTime? FechaModificacion { get; set; }

        public virtual Empresa? Empresa { get; set; }
    }
}
