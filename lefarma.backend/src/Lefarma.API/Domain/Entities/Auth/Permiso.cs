namespace Lefarma.API.Domain.Entities.Auth;
public class Permiso
{
    public int IdPermiso { get; set; }
    public string CodigoPermiso { get; set; } = string.Empty;
    public string NombrePermiso { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public string? Categoria { get; set; }
    public string? Recurso { get; set; }
    public string? Accion { get; set; }
    public bool EsActivo { get; set; } = true;
    public bool EsSistema { get; set; } = false;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<RolPermiso> RolesPermisos { get; set; } = new List<RolPermiso>();
    public ICollection<UsuarioPermiso> UsuariosPermisos { get; set; } = new List<UsuarioPermiso>();
}
