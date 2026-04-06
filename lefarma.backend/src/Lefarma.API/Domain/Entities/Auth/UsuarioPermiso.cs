namespace Lefarma.API.Domain.Entities.Auth;
public class UsuarioPermiso
{
    public int IdUsuarioPermiso { get; set; }
    public int IdUsuario { get; set; }
    public int IdPermiso { get; set; }
    public bool EsConcedido { get; set; } = true;
    public DateTime FechaAsignacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaExpiracion { get; set; }

    // Navigation
    public Usuario Usuario { get; set; } = null!;
    public Permiso Permiso { get; set; } = null!;
}
