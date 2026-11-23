using Lefarma.API.Domain.Entities.Catalogos;

namespace Lefarma.API.Domain.Entities.Config
{
    public class UsuarioAlcanceEmpresa
    {
        public int IdUsuario { get; set; }
        public int IdEmpresa { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

        public virtual Empresa Empresa { get; set; } = null!;
    }
}
