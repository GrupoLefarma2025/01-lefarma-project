using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos {
public class Sucursal
    {
        public int IdSucursal { get; set; }
        public int IdEmpresa { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; }
        public string? Descripcion { get; set; } 
        public string? DescripcionNormalizada { get; set; } 
        public string? Clave { get; set; } 
        public string? ClaveContable { get; set; }
        public string? Direccion { get; set; }
        public string? CodigoPostal { get; set; }
        public string? Ciudad { get; set; }
        public string? Estado { get; set; }
        public string? Telefono { get; set; }
        public decimal Latitud { get; set; }
        public decimal Longitud { get; set; }
        public int NumeroEmpleados { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

        // Navegación
        public virtual Empresa? Empresa { get; set; } 
    }
}
