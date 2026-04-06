using Lefarma.API.Shared.Extensions;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos {
public class Empresa
    {
        public int IdEmpresa { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; }
        public string? Descripcion { get; set; }
        public string? DescripcionNormalizada { get; set; }
        public string? Clave { get; set; }
        public string? RazonSocial { get; set; }
        public string? RFC { get; set; }
        public string? Direccion { get; set; }
        public string? Colonia { get; set; }
        public string? Ciudad { get; set; }
        public string? Estado { get; set; }
        public string? CodigoPostal { get; set; }
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        public string? PaginaWeb { get; set; }
        public int? NumeroEmpleados { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

        public virtual ICollection<Sucursal> Sucursales { get; set; } = new List<Sucursal>();
        public virtual ICollection<Area> Areas { get; set; } = new List<Area>();

        // Métodos de dominio (opcional - DDD)
        public void Activar() => Activo = true;
        public void Desactivar() => Activo = false;
        public void ActualizarNombreNormalizado()
        {
            NombreNormalizado = Nombre?.ToLowerInvariant().RemoveDiacritics();
        }
    }
}
