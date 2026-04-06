namespace Lefarma.API.Domain.Entities.Auth;
public class RolPermiso
{
    public int IdRolPermiso { get; set; }
    public int IdRol { get; set; }
    public int IdPermiso { get; set; }
    public DateTime FechaAsignacion { get; set; } = DateTime.UtcNow;

    // Navigation
    public Rol Rol { get; set; } = null!;
    public Permiso Permiso { get; set; } = null!;
}
