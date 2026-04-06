namespace Lefarma.API.Domain.Entities.Auth;
public class UsuarioRol
{
    public int IdUsuarioRol { get; set; }
    public int IdUsuario { get; set; }
    public int IdRol { get; set; }
    public DateTime FechaAsignacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaExpiracion { get; set; }

    // Navigation
    public Usuario Usuario { get; set; } = null!;
    public Rol Rol { get; set; } = null!;
}
