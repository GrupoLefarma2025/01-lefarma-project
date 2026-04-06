namespace Lefarma.API.Domain.Entities.Auth;
public class Sesion
{
    public long IdSesion { get; set; }
    public int IdUsuario { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string? ClientId { get; set; }
    public string? UserAgent { get; set; }
    public string? IpAddress { get; set; }
    public string? DeviceInfo { get; set; }
    public DateTime FechaInicio { get; set; } = DateTime.UtcNow;
    public DateTime FechaUltimaActividad { get; set; } = DateTime.UtcNow;
    public DateTime? FechaExpiracion { get; set; }
    public DateTime? FechaCierre { get; set; }
    public bool EsActiva { get; set; } = true;

    // Navigation
    public Usuario Usuario { get; set; } = null!;
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
