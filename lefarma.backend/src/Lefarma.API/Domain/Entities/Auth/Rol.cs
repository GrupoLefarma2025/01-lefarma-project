namespace Lefarma.API.Domain.Entities.Auth;
public class Rol
{
    public int IdRol { get; set; }
    public string NombreRol { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public bool EsActivo { get; set; } = true;
    public bool EsSistema { get; set; } = false;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<RolPermiso> RolesPermisos { get; set; } = new List<RolPermiso>();
    public ICollection<UsuarioRol> UsuariosRoles { get; set; } = new List<UsuarioRol>();
}
