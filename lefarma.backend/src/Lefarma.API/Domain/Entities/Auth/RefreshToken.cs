namespace Lefarma.API.Domain.Entities.Auth;
public class RefreshToken
{
    public long IdRefreshToken { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public string JtiAccess { get; set; } = string.Empty;
    public int IdUsuario { get; set; }
    public long? IdSesion { get; set; }
    public string? ClientId { get; set; }
    public string? Scope { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime FechaExpiracion { get; set; }
    public DateTime? FechaUso { get; set; }
    public bool EsRevocado { get; set; }
    public DateTime? FechaRevocacion { get; set; }
    public string? MotivoRevocacion { get; set; }

    // Navigation
    public Usuario Usuario { get; set; } = null!;
    public Sesion? Sesion { get; set; }
}
