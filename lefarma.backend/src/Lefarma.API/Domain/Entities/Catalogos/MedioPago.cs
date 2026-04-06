using Lefarma.API.Shared.Extensions;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Catalogos {
public class MedioPago
    {
        public int IdMedioPago { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; }
        public string? Descripcion { get; set; }
        public string? DescripcionNormalizada { get; set; }
        public string? Clave { get; set; }
        public string? CodigoSAT { get; set; }
        public bool RequiereReferencia { get; set; } = false;
        public bool RequiereAutorizacion { get; set; } = false;
        public decimal? LimiteMonto { get; set; }
        public int? PlazoMaximoDias { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

        // Métodos de dominio (opcional - DDD)
        public void Activar() => Activo = true;
        public void Desactivar() => Activo = false;
        public void ActualizarNombreNormalizado()
        {
            NombreNormalizado = Nombre?.ToLowerInvariant().RemoveDiacritics();
        }
    }
}
