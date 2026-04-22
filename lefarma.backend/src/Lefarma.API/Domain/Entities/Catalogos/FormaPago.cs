namespace Lefarma.API.Domain.Entities.Catalogos {
public class FormaPago
    {
        public int IdFormaPago { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; }
        public string? Descripcion { get; set; }
        public string? DescripcionNormalizada { get; set; }
        public string? Clave { get; set; }
        public bool RequiereCuenta { get; set; } = true;
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

        public virtual ICollection<ProveedorFormaPagoCuenta> ProveedorCuentas { get; set; } = new List<ProveedorFormaPagoCuenta>();
    }
}
