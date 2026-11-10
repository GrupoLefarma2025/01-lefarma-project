using Lefarma.API.Domain.Entities.Catalogos;

namespace Lefarma.API.Domain.Entities.Config
{
    /// <summary>
    /// Empresa que un usuario puede ver en la bandeja de órdenes de compra cuando
    /// tiene el permiso <c>orden_compra.puede_ver_por_empresa</c>. Varias filas por
    /// usuario; la baja es lógica con <see cref="Activo"/>.
    /// </summary>
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
