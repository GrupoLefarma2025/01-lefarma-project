namespace Lefarma.API.Domain.Entities.Auth;
public class Usuario
{
    public int IdUsuario { get; set; }
    public string? SamAccountName { get; set; }
    public string? Dominio { get; set; }
    public string? NombreCompleto { get; set; }
    public string? Correo { get; set; }
    public string? Puesto { get; set; }
    public bool EsAnonimo { get; set; }
    public bool EsActivo { get; set; } = true;
    public bool EsRobot { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? UltimoLogin { get; set; }
    public string? MetadataJson { get; set; }

    // Navigation
    public ICollection<UsuarioRol> UsuariosRoles { get; set; } = new List<UsuarioRol>();
    public ICollection<UsuarioPermiso> UsuariosPermisos { get; set; } = new List<UsuarioPermiso>();
    public ICollection<Sesion> Sesiones { get; set; } = new List<Sesion>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
