using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos {
public class Gasto
    {
        public int IdGasto { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; } 
        public string? Descripcion { get; set; } 
        public string? DescripcionNormalizada { get; set; } 
        public string? Clave { get; set; } 
        public string? Concepto { get; set; }
        public string? Cuenta { get; set; }
        public string? SubCuenta { get; set; }
        public string? Analitica { get; set; }
        public string? Integracion { get; set; }
        public string? CuentaCatalogo { get; set; }
        public bool RequiereComprobacionPago { get; set; }
        public bool RequiereComprobacionGasto { get; set; } 
        public bool PermiteSinDatosFiscales { get; set; } 
        public int DiasLimiteComprobacion { get; set; }
        public bool Activo { get; set; } 
        public DateTime FechaCreacion { get; set; } 
        public DateTime? FechaModificacion { get; set; }

        // Navigation properties
        public virtual ICollection<GastoUnidadMedida> GastoUnidadesMedida { get; set; } = new List<GastoUnidadMedida>();
    }
}
